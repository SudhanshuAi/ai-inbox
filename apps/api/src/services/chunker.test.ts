import { describe, it, expect, beforeEach } from 'vitest';

// Mock config before importing chunker
vi.mock('../config/index.js', () => ({
  config: {
    CHUNK_TARGET_CHARS: 1500,
    CHUNK_OVERLAP_CHARS: 200,
  },
}));

import { chunkText } from '../services/chunker.js';

describe('chunkText', () => {
  it('returns empty array for empty string', () => {
    expect(chunkText('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(chunkText('   \n\n   ')).toEqual([]);
  });

  it('returns single chunk for short content', () => {
    const text = 'Hello, world!';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].startOffset).toBe(0);
    expect(chunks[0].endOffset).toBe(text.length);
  });

  it('splits multi-paragraph content correctly', () => {
    const para1 = 'A'.repeat(800);
    const para2 = 'B'.repeat(800);
    const para3 = 'C'.repeat(800);
    const text = `${para1}\n\n${para2}\n\n${para3}`;
    const chunks = chunkText(text);
    // Should produce at least 2 chunks
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('assigns sequential chunkIndex values', () => {
    const text = Array.from({ length: 5 }, (_, i) => `Paragraph ${i + 1}: ${'x'.repeat(400)}`).join('\n\n');
    const chunks = chunkText(text);
    chunks.forEach((chunk, i) => {
      expect(chunk.chunkIndex).toBe(i);
    });
  });

  it('produces non-empty content in each chunk', () => {
    const text = Array.from({ length: 10 }, (_, i) => `Para ${i}: ${'y'.repeat(200)}`).join('\n\n');
    const chunks = chunkText(text);
    chunks.forEach((chunk) => {
      expect(chunk.content.trim().length).toBeGreaterThan(0);
    });
  });

  it('handles unicode text', () => {
    const text = '你好世界。这是一段测试文本，用于验证Unicode处理是否正确。'.repeat(10);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeGreaterThan(0);
    });
  });

  it('startOffset and endOffset are within text bounds', () => {
    const text = Array.from({ length: 5 }, (_, i) => `Section ${i}: ${'z'.repeat(500)}`).join('\n\n');
    const chunks = chunkText(text);
    chunks.forEach((chunk) => {
      expect(chunk.startOffset).toBeGreaterThanOrEqual(0);
      expect(chunk.endOffset).toBeLessThanOrEqual(text.length);
    });
  });
});
