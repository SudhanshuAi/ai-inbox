import OpenAI from 'openai';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { ProviderError, ProviderTimeoutError } from '../domain/index.js';

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
      embeddingModel: config.embeddingModel,
      chatModel: config.chatModel,
    });
  }
  return _client;
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

async function createGeminiEmbeddings(texts: string[]): Promise<number[][]> {
  const modelName = config.embeddingModel.startsWith('models/')
    ? config.embeddingModel
    : `models/${config.embeddingModel}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:batchEmbedContents?key=${config.apiKey}`;

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

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  try {
    const embeddings = await withRetry(async () => {
      if (config.provider === 'gemini') {
        return await createGeminiEmbeddings(texts);
      } else {
        const result = await getClient().embeddings.create({
          model: config.embeddingModel,
          input: texts,
        });
        return result.data.map((d) => d.embedding);
      }
    });

    logger.debug({ event: 'embeddings_created', count: texts.length, model: config.embeddingModel, provider: config.provider });
    return embeddings;
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'ETIMEDOUT' || e.code === 'ECONNABORTED') {
      throw new ProviderTimeoutError(`${config.provider.toUpperCase()} embedding provider timed out`);
    }
    throw new ProviderError(`${config.provider.toUpperCase()} embedding failed: ${e.message ?? 'unknown error'}`);
  }
}

export async function createChatCompletion(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  try {
    const result = await withRetry(() =>
      getClient().chat.completions.create({
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
    logger.debug({ event: 'chat_completion', model: config.chatModel, provider: config.provider, tokens: result.usage?.total_tokens });
    return content;
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'ETIMEDOUT' || e.code === 'ECONNABORTED') {
      throw new ProviderTimeoutError(`${config.provider.toUpperCase()} chat provider timed out`);
    }
    throw new ProviderError(`${config.provider.toUpperCase()} chat completion failed: ${e.message ?? 'unknown error'}`);
  }
}
