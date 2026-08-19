import { config } from '../config/index.js';

export interface TextChunk {
  content: string;
  startOffset: number;
  endOffset: number;
  chunkIndex: number;
}

/**
 * Splits text into overlapping chunks using paragraph boundaries.
 *
 * Strategy:
 * 1. Normalize excessive whitespace while preserving paragraph breaks
 * 2. Split on paragraph boundaries (double newlines)
 * 3. Greedily assemble paragraphs into chunks targeting CHUNK_TARGET_CHARS
 * 4. Oversized paragraphs fall back to sentence boundaries, then hard character windows
 * 5. Overlap is implemented by re-including the last ~CHUNK_OVERLAP_CHARS of previous chunk
 *
 * Rationale:
 * - Paragraphs preserve semantic coherence better than fixed-char slices
 * - Modest overlap (~200 chars) reduces the chance a claim is separated from its qualifier
 * - Character counts avoid a tokenizer dependency
 * - Named config values make tuning easy without changing the algorithm
 */
export function chunkText(text: string): TextChunk[] {
  if (!text || text.trim().length === 0) return [];

  const target = config.CHUNK_TARGET_CHARS;
  const overlap = config.CHUNK_OVERLAP_CHARS;

  // Normalize: collapse runs of spaces/tabs but preserve paragraph breaks
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (normalized.length <= target) {
    return [{ content: normalized, startOffset: 0, endOffset: normalized.length, chunkIndex: 0 }];
  }

  // Split into paragraphs with original offsets tracked
  const paragraphs = splitIntoParagraphs(normalized);
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;
  let i = 0;
  let overlapText = '';

  while (i < paragraphs.length) {
    let content = overlapText;
    let startParagraph = i;
    let endOffset = 0;

    // Greedily pack paragraphs into a chunk
    while (i < paragraphs.length) {
      const candidate = content ? content + '\n\n' + paragraphs[i].text : paragraphs[i].text;
      if (candidate.length > target && content.length > 0) break;

      // Oversized single paragraph: split by sentence then char
      if (paragraphs[i].text.length > target * 1.5 && !content) {
        const subChunks = splitLargeParagraph(paragraphs[i].text, paragraphs[i].start, target, overlap, chunkIndex);
        chunks.push(...subChunks);
        chunkIndex += subChunks.length;
        i++;
        overlapText = subChunks.length > 0 ? subChunks[subChunks.length - 1].content.slice(-overlap) : '';
        startParagraph = i;
        content = overlapText;
        continue;
      }

      content = candidate;
      endOffset = paragraphs[i].end;
      i++;
    }

    if (content.trim().length > 0) {
      const startOffset = overlapText
        ? paragraphs[startParagraph]?.start ?? 0
        : paragraphs[startParagraph]?.start ?? 0;

      chunks.push({
        content: content.trim(),
        startOffset: Math.max(0, startOffset - overlapText.length),
        endOffset,
        chunkIndex: chunkIndex++,
      });

      overlapText = content.slice(-overlap);
    }
  }

  return chunks;
}

interface Paragraph {
  text: string;
  start: number;
  end: number;
}

function splitIntoParagraphs(text: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let searchStart = 0;

  while (searchStart < text.length) {
    const nextBreak = text.indexOf('\n\n', searchStart);
    const end = nextBreak === -1 ? text.length : nextBreak;
    const para = text.slice(searchStart, end).trim();
    if (para) {
      paragraphs.push({ text: para, start: searchStart, end });
    }
    searchStart = nextBreak === -1 ? text.length : nextBreak + 2;
  }

  return paragraphs;
}

function splitLargeParagraph(
  text: string,
  baseOffset: number,
  target: number,
  overlap: number,
  startIndex: number,
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let chunkIndex = startIndex;

  // Try sentence boundaries first
  const sentences = text.split(/(?<=[.!?])\s+/);
  let current = '';
  let currentStart = baseOffset;

  for (const sentence of sentences) {
    const candidate = current ? current + ' ' + sentence : sentence;
    if (candidate.length > target && current.length > 0) {
      chunks.push({
        content: current.trim(),
        startOffset: currentStart,
        endOffset: currentStart + current.length,
        chunkIndex: chunkIndex++,
      });
      currentStart = currentStart + current.length - overlap;
      current = current.slice(-overlap) + ' ' + sentence;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push({
      content: current.trim(),
      startOffset: currentStart,
      endOffset: currentStart + current.length,
      chunkIndex: chunkIndex++,
    });
  }

  // If still too large, hard-cut
  if (chunks.length === 0) {
    let pos = 0;
    while (pos < text.length) {
      const slice = text.slice(pos, pos + target);
      chunks.push({ content: slice, startOffset: baseOffset + pos, endOffset: baseOffset + pos + slice.length, chunkIndex: chunkIndex++ });
      pos += target - overlap;
    }
  }

  return chunks;
}
