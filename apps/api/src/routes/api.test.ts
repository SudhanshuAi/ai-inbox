import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';

// Set test environment before importing app
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-mock-key';
process.env.SQLITE_PATH = ':memory:';

// Mock AI client module
vi.mock('../adapters/aiClient.js', () => ({
  createEmbeddings: vi.fn().mockImplementation(async (texts: string[]) => {
    // Return dummy 1536-dim vector for each text
    return texts.map(() => new Array(1536).fill(0.1));
  }),
  createChatCompletion: vi.fn().mockResolvedValue('Based on the provided notes [1], the key architecture is TypeScript with Express and SQLite.'),
}));

import { app } from '../index.js';

describe('API Integration Tests', () => {
  const request = supertest(app);

  describe('GET /health', () => {
    it('returns 200 OK with health details', async () => {
      const res = await request.get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
    });
  });

  describe('POST /ingest', () => {
    it('successfully ingests a note and returns 201 Created', async () => {
      const res = await request.post('/ingest').send({
        type: 'note',
        title: 'Architecture Note',
        content: 'AI Knowledge Inbox uses a React frontend, Express API backend, and SQLite database for RAG retrieval.',
      });

      expect(res.status).toBe(201);
      expect(res.body.item).toBeDefined();
      expect(res.body.item.title).toBe('Architecture Note');
      expect(res.body.item.status).toBe('ready');
      expect(res.body.requestId).toBeDefined();
    });

    it('returns 422 for invalid request body', async () => {
      const res = await request.post('/ingest').send({
        type: 'invalid_type',
      });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /items', () => {
    it('lists ingested items ordered newest first', async () => {
      const res = await request.get('/items');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(0);
    });
  });

  describe('POST /query', () => {
    it('answers question using RAG and returns sources with citations', async () => {
      const res = await request.post('/query').send({
        question: 'What is the architecture of AI Knowledge Inbox?',
      });

      expect(res.status).toBe(200);
      expect(res.body.answer).toContain('TypeScript with Express');
      expect(Array.isArray(res.body.sources)).toBe(true);
      expect(res.body.requestId).toBeDefined();
    });

    it('returns 422 for empty question', async () => {
      const res = await request.post('/query').send({
        question: '',
      });
      expect(res.status).toBe(422);
    });
  });
});
