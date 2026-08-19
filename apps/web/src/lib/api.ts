import {
  IngestRequest,
  IngestResponse,
  ItemsResponse,
  QueryRequest,
  QueryResponse,
} from '@ai-inbox/contracts';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok) throw { ...data, status: res.status };
  return data as T;
}

export const api = {
  ingest: (body: IngestRequest) =>
    request<IngestResponse>('/ingest', { method: 'POST', body: JSON.stringify(body) }),

  getItems: () => request<ItemsResponse>('/items', { cache: 'no-store' }),

  query: (body: QueryRequest) =>
    request<QueryResponse>('/query', { method: 'POST', body: JSON.stringify(body) }),
};
