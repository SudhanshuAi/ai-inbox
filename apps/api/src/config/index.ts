import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Automatically load .env file if present in current working directory or apps/api
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'apps/api/.env'),
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    try {
      process.loadEnvFile(p);
      break;
    } catch {
      // Ignore if loadEnvFile fails
    }
  }
}

const ConfigSchema = z
  .object({
    PORT: z.string().default('3001').transform(Number),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),

    // SQLite
    SQLITE_PATH: z.string().default('./data/knowledge.db'),

    // AI Provider Configuration (Gemini or OpenAI)
    AI_PROVIDER: z.enum(['openai', 'gemini', 'auto']).default('auto'),
    GEMINI_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_BASE_URL: z.string().url().optional(),

    // Model names
    EMBEDDING_MODEL: z.string().optional(),
    CHAT_MODEL: z.string().optional(),

    // Fetch limits
    FETCH_TIMEOUT_MS: z.string().default('10000').transform(Number),
    FETCH_MAX_BYTES: z.string().default('5242880').transform(Number), // 5MB
    FETCH_MAX_REDIRECTS: z.string().default('5').transform(Number),

    // Input limits
    MAX_NOTE_LENGTH: z.string().default('100000').transform(Number),
    MAX_QUESTION_LENGTH: z.string().default('2000').transform(Number),

    // Chunking (characters)
    CHUNK_TARGET_CHARS: z.string().default('1500').transform(Number),
    CHUNK_OVERLAP_CHARS: z.string().default('200').transform(Number),

    // Retrieval
    RETRIEVAL_TOP_K: z.string().default('5').transform(Number),
    RETRIEVAL_PER_ITEM_CAP: z.string().default('2').transform(Number),
    RETRIEVAL_RELEVANCE_THRESHOLD: z.string().default('0.3').transform(Number),
    RETRIEVAL_CONTEXT_BUDGET_CHARS: z.string().default('8000').transform(Number),

    // Logging
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  })
  .refine(
    (data) => Boolean(data.GEMINI_API_KEY || data.OPENAI_API_KEY),
    {
      message: 'Either GEMINI_API_KEY or OPENAI_API_KEY must be provided in environment variables or .env file.',
      path: ['GEMINI_API_KEY'],
    },
  );

type RawConfig = z.infer<typeof ConfigSchema>;

export interface ResolvedConfig extends Omit<RawConfig, 'EMBEDDING_MODEL' | 'CHAT_MODEL'> {
  provider: 'gemini' | 'openai';
  apiKey: string;
  baseUrl?: string;
  embeddingModel: string;
  chatModel: string;
}

function loadConfig(): ResolvedConfig {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`[startup] Configuration validation failed:\n${errors}`);
    process.exit(1);
  }

  const raw = result.data;

  // Determine provider
  let provider: 'gemini' | 'openai' = 'gemini';
  if (raw.AI_PROVIDER === 'openai') {
    provider = 'openai';
  } else if (raw.AI_PROVIDER === 'gemini') {
    provider = 'gemini';
  } else {
    // auto: prefer Gemini if GEMINI_API_KEY is present, else OpenAI
    provider = raw.GEMINI_API_KEY ? 'gemini' : 'openai';
  }

  let apiKey = '';
  let baseUrl = raw.OPENAI_BASE_URL;
  let defaultEmbeddingModel = 'text-embedding-3-small';
  let defaultChatModel = 'gpt-4o-mini';

  if (provider === 'gemini') {
    apiKey = raw.GEMINI_API_KEY || raw.OPENAI_API_KEY || '';
    baseUrl = raw.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
    defaultEmbeddingModel = 'gemini-embedding-001';
    defaultChatModel = 'gemini-3.6-flash';
  } else {
    apiKey = raw.OPENAI_API_KEY || raw.GEMINI_API_KEY || '';
    defaultEmbeddingModel = 'text-embedding-3-small';
    defaultChatModel = 'gpt-4o-mini';
  }

  return {
    ...raw,
    provider,
    apiKey,
    baseUrl,
    embeddingModel: raw.EMBEDDING_MODEL || defaultEmbeddingModel,
    chatModel: raw.CHAT_MODEL || defaultChatModel,
  };
}

export const config = loadConfig();
