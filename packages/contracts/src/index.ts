import { z } from 'zod';

// ─── Ingest ────────────────────────────────────────────────────────────────

export const IngestNoteSchema = z.object({
  type: z.literal('note'),
  content: z
    .string()
    .min(1, 'Note content cannot be empty')
    .max(100_000, 'Note content exceeds 100,000 characters'),
  title: z
    .string()
    .max(200, 'Title exceeds 200 characters')
    .optional(),
});

export const IngestUrlSchema = z.object({
  type: z.literal('url'),
  url: z
    .string()
    .url('Must be a valid URL')
    .regex(/^https?:\/\//i, 'Only HTTP and HTTPS URLs are supported'),
});

export const IngestRequestSchema = z.discriminatedUnion('type', [
  IngestNoteSchema,
  IngestUrlSchema,
]);

export type IngestRequest = z.infer<typeof IngestRequestSchema>;
export type IngestNoteRequest = z.infer<typeof IngestNoteSchema>;
export type IngestUrlRequest = z.infer<typeof IngestUrlSchema>;

// ─── Items ─────────────────────────────────────────────────────────────────

export type ItemStatus = 'processing' | 'ready' | 'failed';
export type SourceType = 'note' | 'url';

export interface ItemSummary {
  id: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  title: string;
  preview: string;
  rawContent?: string;
  status: ItemStatus;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IngestResponse {
  item: ItemSummary;
  requestId: string;
}

export interface ItemsResponse {
  items: ItemSummary[];
  requestId: string;
}

// ─── Query ─────────────────────────────────────────────────────────────────

export const QueryRequestSchema = z.object({
  question: z
    .string()
    .min(1, 'Question cannot be empty')
    .max(2000, 'Question exceeds 2,000 characters'),
});

export type QueryRequest = z.infer<typeof QueryRequestSchema>;

export interface SourceRecord {
  citationLabel: string;
  itemId: string;
  title: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  snippet: string;
  score: number;
}

export interface QueryResponse {
  answer: string;
  sources: SourceRecord[];
  requestId: string;
}

// ─── Errors ────────────────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
  requestId: string;
}
