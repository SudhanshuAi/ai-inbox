// ─── Domain Types ──────────────────────────────────────────────────────────

export type ItemStatus = 'processing' | 'ready' | 'failed';
export type SourceType = 'note' | 'url';

export interface Item {
  id: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  title: string;
  rawContent: string;
  status: ItemStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Chunk {
  id: string;
  itemId: string;
  chunkIndex: number;
  content: string;
  startOffset: number;
  endOffset: number;
  embedding: number[];
  embeddingModel: string;
  createdAt: string;
}

export interface ChunkWithScore {
  chunk: Chunk;
  score: number;
  item: Pick<Item, 'id' | 'title' | 'sourceType' | 'sourceUrl'>;
}

// ─── Domain Errors ─────────────────────────────────────────────────────────

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, string[]>) {
    super('VALIDATION_ERROR', message, 422, details);
    this.name = 'ValidationError';
  }
}

export class FetchError extends DomainError {
  constructor(message: string, code = 'FETCH_ERROR') {
    super(code, message, 422);
    this.name = 'FetchError';
  }
}

export class ExtractionError extends DomainError {
  constructor(message: string) {
    super('EXTRACTION_ERROR', message, 422);
    this.name = 'ExtractionError';
  }
}

export class ProviderError extends DomainError {
  constructor(message: string, code = 'PROVIDER_ERROR') {
    super(code, message, 502);
    this.name = 'ProviderError';
  }
}

export class ProviderTimeoutError extends DomainError {
  constructor(message: string) {
    super('PROVIDER_TIMEOUT', message, 504);
    this.name = 'ProviderTimeoutError';
  }
}

export class NoIndexedContentError extends DomainError {
  constructor() {
    super('NO_INDEXED_CONTENT', 'No indexed content available. Please add notes or URLs first.', 409);
    this.name = 'NoIndexedContentError';
  }
}

export class PersistenceError extends DomainError {
  constructor(message: string) {
    super('PERSISTENCE_ERROR', message, 500);
    this.name = 'PersistenceError';
  }
}
