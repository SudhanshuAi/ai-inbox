import { IngestNoteRequest, IngestUrlRequest } from '@ai-inbox/contracts';
import { fetchAndExtract } from '../adapters/urlFetcher.js';
import { createEmbeddings } from '../adapters/aiClient.js';
import { createItem, updateItemStatus, saveChunks, getChunkCountForItem } from '../adapters/repository.js';
import { chunkText } from './chunker.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { Item } from '../domain/index.js';

function deriveTitle(content: string): string {
  const firstLine = content.split('\n')[0]?.trim() ?? '';
  return firstLine.slice(0, 100) || 'Untitled Note';
}

export async function ingestNote(req: IngestNoteRequest, requestId: string): Promise<Item> {
  const title = req.title?.trim() || deriveTitle(req.content);
  const rawContent = req.content.trim();

  const item = createItem({ sourceType: 'note', sourceUrl: null, title, rawContent });
  logger.info({ event: 'ingest_note_start', requestId, itemId: item.id, contentLength: rawContent.length });

  try {
    await indexContent(item.id, rawContent, requestId);
    updateItemStatus(item.id, 'ready');
    logger.info({ event: 'ingest_note_done', requestId, itemId: item.id, chunks: getChunkCountForItem(item.id) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Indexing failed';
    updateItemStatus(item.id, 'failed', message);
    logger.error({ event: 'ingest_note_failed', requestId, itemId: item.id, err });
    throw err;
  }

  return { ...item, status: 'ready' };
}

export async function ingestUrl(req: IngestUrlRequest, requestId: string): Promise<Item> {
  logger.info({ event: 'ingest_url_start', requestId, host: new URL(req.url).hostname });

  // Fetch and extract first (may throw FetchError / ExtractionError)
  const page = await fetchAndExtract(req.url);
  const normalizedUrl = page.url;

  const item = createItem({
    sourceType: 'url',
    sourceUrl: normalizedUrl,
    title: page.title,
    rawContent: page.text,
  });

  logger.info({ event: 'ingest_url_fetched', requestId, itemId: item.id, textLength: page.text.length });

  try {
    await indexContent(item.id, page.text, requestId);
    updateItemStatus(item.id, 'ready');
    logger.info({ event: 'ingest_url_done', requestId, itemId: item.id, chunks: getChunkCountForItem(item.id) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Indexing failed';
    updateItemStatus(item.id, 'failed', message);
    logger.error({ event: 'ingest_url_failed', requestId, itemId: item.id, err });
    throw err;
  }

  return { ...item, status: 'ready', title: page.title };
}

async function indexContent(itemId: string, content: string, requestId: string): Promise<void> {
  const textChunks = chunkText(content);
  if (textChunks.length === 0) {
    throw new Error('Content produced no indexable chunks');
  }

  logger.debug({ event: 'chunks_created', requestId, itemId, count: textChunks.length });

  const chunkTexts = textChunks.map((c) => c.content);
  const embeddings = await createEmbeddings(chunkTexts);

  const chunksToSave = textChunks.map((chunk, i) => ({
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    startOffset: chunk.startOffset,
    endOffset: chunk.endOffset,
    embedding: embeddings[i],
    embeddingModel: config.embeddingModel,
  }));

  saveChunks(itemId, chunksToSave);
}
