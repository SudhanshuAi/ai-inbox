import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

// Mock global fetch
global.fetch = vi.fn().mockImplementation(async (url: string) => {
  if (url.endsWith('/items')) {
    return {
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'item-1',
            sourceType: 'note',
            sourceUrl: null,
            title: 'Sample Note',
            preview: 'This is a sample note preview...',
            status: 'ready',
            errorMessage: null,
            chunkCount: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        requestId: 'req-123',
      }),
    };
  }
  return { ok: true, json: async () => ({}) };
});

describe('App', () => {
  it('renders header, ingestion form, saved items, and question input', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: /AI Knowledge Inbox/i })).toBeInTheDocument();
    expect(screen.getByText(/Add to Knowledge Base/i)).toBeInTheDocument();
    expect(screen.getByText(/Ask a Question/i)).toBeInTheDocument();
    expect(screen.getByText(/Saved Knowledge/i)).toBeInTheDocument();
  });
});
