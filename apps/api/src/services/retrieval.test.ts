import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from './retrieval.js';

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical non-zero vectors', () => {
    const vec = [1, 2, 3, 4];
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const v1 = [1, 0];
    const v2 = [0, 1];
    expect(cosineSimilarity(v1, v2)).toBe(0);
  });

  it('returns -1.0 for opposite vectors', () => {
    const v1 = [1, 2, 3];
    const v2 = [-1, -2, -3];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1.0, 5);
  });

  it('handles zero vectors safely without NaN', () => {
    const v1 = [0, 0, 0];
    const v2 = [1, 2, 3];
    expect(cosineSimilarity(v1, v2)).toBe(0);
  });

  it('returns 0 for empty vectors or mismatched lengths', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });
});
