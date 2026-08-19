import { Router, Request, Response, NextFunction } from 'express';
import { IngestRequestSchema, ItemSummary, IngestResponse, ItemsResponse } from '@ai-inbox/contracts';
import { ingestNote, ingestUrl } from '../services/ingestion.js';
import { getAllItems, getChunkCountForItem } from '../adapters/repository.js';
import { Item } from '../domain/index.js';

export const itemsRouter = Router();

function toSummary(item: Item): ItemSummary {
  const preview = item.rawContent.slice(0, 200).replace(/\s+/g, ' ').trim();
  return {
    id: item.id,
    sourceType: item.sourceType,
    sourceUrl: item.sourceUrl,
    title: item.title,
    preview,
    rawContent: item.rawContent,
    status: item.status,
    errorMessage: item.errorMessage,
    chunkCount: item.status === 'ready' ? getChunkCountForItem(item.id) : 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

// POST /ingest
itemsRouter.post('/ingest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = IngestRequestSchema.parse(req.body);
    let item: Item;

    if (parsed.type === 'note') {
      item = await ingestNote(parsed, req.requestId);
    } else {
      item = await ingestUrl(parsed, req.requestId);
    }

    const body: IngestResponse = { item: toSummary(item), requestId: req.requestId };
    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
});

// GET /items
itemsRouter.get('/items', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = getAllItems();
    const body: ItemsResponse = {
      items: items.map(toSummary),
      requestId: _req.requestId,
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});
