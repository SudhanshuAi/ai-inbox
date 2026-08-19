import { ChunkWithScore, Item, Chunk } from '../domain/index.js';
import { getAllChunksWithItems } from '../adapters/repository.js';
import { createEmbeddings } from '../adapters/aiClient.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Cosine similarity between two vectors.
 * Returns a value in [-1, 1]; higher is more similar.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export interface RetrievedChunk {
  chunk: Chunk;
  item: Pick<Item, 'id' | 'title' | 'sourceType' | 'sourceUrl'>;
  score: number;
}

/**
 * Retrieves the most relevant chunks for a question using cosine similarity.
 *
 * Process:
 * 1. Embed the question using the same model as chunk embeddings
 * 2. Score all indexed chunks via cosine similarity
 * 3. Sort descending, deduplicate overlapping chunks from the same item
 * 4. Cap at top-K results and per-item cap
 * 5. Apply relevance threshold
 * 6. Apply context character budget
 */
export async function retrieve(question: string, requestId: string): Promise<RetrievedChunk[]> {
  const allChunks = getAllChunksWithItems();
  logger.debug({ event: 'retrieval_start', requestId, totalChunks: allChunks.length });

  if (allChunks.length === 0) return [];

  const [questionEmbedding] = await createEmbeddings([question]);
  const scored: RetrievedChunk[] = allChunks.map(({ chunk, item }) => ({
    chunk,
    item,
    score: cosineSimilarity(questionEmbedding, chunk.embedding),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Deduplicate: skip chunks where the previous chunk from the same item was very similar
  const deduplicated = deduplicateChunks(scored);

  // Apply per-item cap
  const perItemCount: Record<string, number> = {};
  const capped = deduplicated.filter((r) => {
    const count = perItemCount[r.item.id] ?? 0;
    if (count >= config.RETRIEVAL_PER_ITEM_CAP && deduplicated.length >= 3) return false;
    perItemCount[r.item.id] = count + 1;
    return true;
  });

  // Take top-K
  const topK = capped.slice(0, config.RETRIEVAL_TOP_K);

  // Apply relevance threshold
  const relevant = topK.filter((r) => r.score >= config.RETRIEVAL_RELEVANCE_THRESHOLD);

  // Apply context budget
  const contextBudget = config.RETRIEVAL_CONTEXT_BUDGET_CHARS;
  let charCount = 0;
  const withinBudget = relevant.filter((r) => {
    charCount += r.chunk.content.length;
    return charCount <= contextBudget;
  });

  logger.info({
    event: 'retrieval_done',
    requestId,
    totalCandidates: scored.length,
    afterDedup: deduplicated.length,
    afterCap: capped.length,
    afterThreshold: relevant.length,
    selected: withinBudget.length,
  });

  return withinBudget;
}

function deduplicateChunks(scored: RetrievedChunk[]): RetrievedChunk[] {
  const seen: RetrievedChunk[] = [];
  for (const candidate of scored) {
    const isDuplicate = seen.some(
      (s) =>
        s.item.id === candidate.item.id &&
        s.chunk.chunkIndex !== candidate.chunk.chunkIndex &&
        Math.abs(s.chunk.startOffset - candidate.chunk.startOffset) < 150,
    );
    if (!isDuplicate) seen.push(candidate);
  }
  return seen;
}
