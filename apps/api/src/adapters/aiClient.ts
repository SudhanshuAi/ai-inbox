import OpenAI from 'openai';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { ProviderError, ProviderTimeoutError } from '../domain/index.js';

// ── OpenAI / Gemini-compat client (used for chat when provider=gemini/openai) ──
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.FETCH_TIMEOUT_MS * 3, // 30s for AI calls
      maxRetries: 2,
    });
    logger.info({
      event: 'ai_client_initialized',
      provider: config.provider,
      baseUrl: config.baseUrl ?? 'default',
      embeddingProvider: config.embeddingProvider,
      embeddingModel: config.embeddingModel,
      chatModel: config.chatModel,
    });
  }
  return _client;
}

// ── Groq client (OpenAI-compatible, chat only — no embeddings) ──────────────
let _groqClient: OpenAI | null = null;

function getGroqClient(): OpenAI {
  if (!_groqClient) {
    _groqClient = new OpenAI({
      apiKey: config.groqApiKey ?? '',
      baseURL: 'https://api.groq.com/openai/v1',
      timeout: config.FETCH_TIMEOUT_MS * 3,
      maxRetries: 2,
    });
    logger.info({
      event: 'ai_client_initialized',
      provider: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      embeddingProvider: config.embeddingProvider,
      embeddingModel: config.embeddingModel,
      chatModel: config.chatModel,
    });
  }
  return _groqClient;
}

// ── Embedding client: resolves to Gemini or OpenAI (never Groq) ─────────────
let _embeddingClient: OpenAI | null = null;

function getEmbeddingClient(): OpenAI {
  if (config.provider !== 'groq') {
    // Chat and embedding provider are the same
    return getClient();
  }
  // Groq: use a separate client pointed at the embedding provider (Gemini or OpenAI)
  if (!_embeddingClient) {
    const isGemini = config.embeddingProvider === 'gemini';
    _embeddingClient = new OpenAI({
      apiKey: isGemini ? (config.GEMINI_API_KEY ?? '') : (config.OPENAI_API_KEY ?? ''),
      baseURL: isGemini
        ? 'https://generativelanguage.googleapis.com/v1beta/openai/'
        : undefined,
      timeout: config.FETCH_TIMEOUT_MS * 3,
      maxRetries: 2,
    });
  }
  return _embeddingClient;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = Math.min(1000 * 2 ** (attempt - 1) + Math.random() * 200, 5000);
        logger.warn({ event: 'ai_retry', attempt, delay, errMessage: (err as Error)?.message });
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

// ── Gemini-native batchEmbedContents (bypasses OpenAI-compat endpoint) ──────
async function createGeminiEmbeddings(texts: string[], apiKey: string, model: string): Promise<number[][]> {
  const modelName = model.startsWith('models/') ? model : `models/${model}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:batchEmbedContents?key=${apiKey}`;

  const requests = texts.map((t) => ({
    model: modelName,
    content: { parts: [{ text: t }] },
  }));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });

  const data = (await res.json()) as {
    embeddings?: Array<{ values: number[] }>;
    error?: { message: string };
  };

  if (!res.ok || !data.embeddings) {
    const msg = data.error?.message || `HTTP ${res.status} from Gemini Embedding API`;
    throw new Error(msg);
  }

  return data.embeddings.map((e) => e.values);
}

// ── Public: create embeddings ────────────────────────────────────────────────
export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  try {
    const embeddings = await withRetry(async () => {
      if (config.embeddingProvider === 'gemini') {
        // Use Gemini native API; resolve the key: could be GEMINI_API_KEY or the main apiKey
        const geminiKey = config.GEMINI_API_KEY ?? config.apiKey;
        return await createGeminiEmbeddings(texts, geminiKey, config.embeddingModel);
      } else {
        // OpenAI-compatible embedding (openai provider, or Groq→OpenAI fallback)
        const client = getEmbeddingClient();
        const result = await client.embeddings.create({
          model: config.embeddingModel,
          input: texts,
        });
        return result.data.map((d) => d.embedding);
      }
    });

    logger.debug({
      event: 'embeddings_created',
      count: texts.length,
      model: config.embeddingModel,
      embeddingProvider: config.embeddingProvider,
    });
    return embeddings;
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'ETIMEDOUT' || e.code === 'ECONNABORTED') {
      throw new ProviderTimeoutError(`${config.embeddingProvider.toUpperCase()} embedding provider timed out`);
    }
    throw new ProviderError(`${config.embeddingProvider.toUpperCase()} embedding failed: ${e.message ?? 'unknown error'}`);
  }
}

// ── Public: create chat completion ───────────────────────────────────────────
export async function createChatCompletion(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  try {
    const client = config.provider === 'groq' ? getGroqClient() : getClient();
    const result = await withRetry(() =>
      client.chat.completions.create({
        model: config.chatModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    );
    const content = result.choices[0]?.message?.content ?? '';
    logger.debug({
      event: 'chat_completion',
      model: config.chatModel,
      provider: config.provider,
      tokens: result.usage?.total_tokens,
    });
    return content;
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'ETIMEDOUT' || e.code === 'ECONNABORTED') {
      throw new ProviderTimeoutError(`${config.provider.toUpperCase()} chat provider timed out`);
    }
    throw new ProviderError(`${config.provider.toUpperCase()} chat completion failed: ${e.message ?? 'unknown error'}`);
  }
}
