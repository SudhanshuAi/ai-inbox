import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db.js';
import { Item, ItemStatus, Chunk } from '../domain/index.js';
import { logger } from '../config/logger.js';

// ─── Row types ─────────────────────────────────────────────────────────────

interface ItemRow {
  id: string;
  source_type: string;
  source_url: string | null;
  title: string;
  raw_content: string;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface ChunkRow {
  id: string;
  item_id: string;
  chunk_index: number;
  content: string;
  start_offset: number;
  end_offset: number;
  embedding: Uint8Array | Buffer;
  embedding_model: string;
  created_at: string;
}

// ─── Mappers ───────────────────────────────────────────────────────────────

function rowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    sourceType: row.source_type as Item['sourceType'],
    sourceUrl: row.source_url,
    title: row.title,
    rawContent: row.raw_content,
    status: row.status as ItemStatus,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToChunk(row: ChunkRow): Chunk {
  const buf = Buffer.from(row.embedding);
  const float32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  return {
    id: row.id,
    itemId: row.item_id,
    chunkIndex: Number(row.chunk_index),
    content: row.content,
    startOffset: Number(row.start_offset),
    endOffset: Number(row.end_offset),
    embedding: Array.from(float32),
    embeddingModel: row.embedding_model,
    createdAt: row.created_at,
  };
}

function embeddingToBuffer(embedding: number[]): Uint8Array {
  const float32 = new Float32Array(embedding);
  return new Uint8Array(float32.buffer);
}

// ─── Item Repository ───────────────────────────────────────────────────────

export function createItem(data: {
  sourceType: Item['sourceType'];
  sourceUrl: string | null;
  title: string;
  rawContent: string;
}): Item {
  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO items (id, source_type, source_url, title, raw_content, status)
    VALUES (?, ?, ?, ?, ?, 'processing')
  `).run(id, data.sourceType, data.sourceUrl, data.title, data.rawContent);
  return getItemById(id)!;
}

export function getItemById(id: string): Item | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemRow | undefined;
  return row ? rowToItem(row) : null;
}

export function updateItemStatus(
  id: string,
  status: ItemStatus,
  errorMessage?: string,
): void {
  const db = getDb();
  db.prepare(`
    UPDATE items SET status = ?, error_message = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(status, errorMessage ?? null, id);
}

export function getAllItems(): Item[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM items ORDER BY created_at DESC').all() as ItemRow[];
  return rows.map(rowToItem);
}

export function getReadyItemCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM items WHERE status = 'ready'").get() as { count: number | bigint };
  return Number(row?.count ?? 0);
}

// ─── Chunk Repository ──────────────────────────────────────────────────────

export function saveChunks(
  itemId: string,
  chunks: Array<{
    chunkIndex: number;
    content: string;
    startOffset: number;
    endOffset: number;
    embedding: number[];
    embeddingModel: string;
  }>,
): void {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO chunks (id, item_id, chunk_index, content, start_offset, end_offset, embedding, embedding_model)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN TRANSACTION;');
  try {
    for (const chunk of chunks) {
      insert.run(
        uuidv4(),
        itemId,
        chunk.chunkIndex,
        chunk.content,
        chunk.startOffset,
        chunk.endOffset,
        embeddingToBuffer(chunk.embedding),
        chunk.embeddingModel,
      );
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  logger.debug({ event: 'chunks_saved', itemId, count: chunks.length });
}

export function getAllChunksWithItems(): Array<{ chunk: Chunk; item: Pick<Item, 'id' | 'title' | 'sourceType' | 'sourceUrl'> }> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      c.id, c.item_id, c.chunk_index, c.content, c.start_offset, c.end_offset, c.embedding, c.embedding_model, c.created_at,
      i.title as item_title, i.source_type as item_source_type, i.source_url as item_source_url
    FROM chunks c
    JOIN items i ON c.item_id = i.id
    WHERE i.status = 'ready'
  `).all() as Array<ChunkRow & { item_title: string; item_source_type: string; item_source_url: string | null }>;

  return rows.map((row) => ({
    chunk: rowToChunk(row),
    item: {
      id: row.item_id,
      title: row.item_title,
      sourceType: row.item_source_type as Item['sourceType'],
      sourceUrl: row.item_source_url,
    },
  }));
}

export function getChunkCountForItem(itemId: string): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM chunks WHERE item_id = ?').get(itemId) as { count: number | bigint };
  return Number(row?.count ?? 0);
}
