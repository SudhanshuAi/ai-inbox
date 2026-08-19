import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { IngestRequest, QueryRequest } from '@ai-inbox/contracts';

export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: () => api.getItems(),
    refetchInterval: false,
  });
}

export function useIngest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: IngestRequest) => api.ingest(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
}

export function useQuery2() {
  return useMutation({
    mutationFn: (body: QueryRequest) => api.query(body),
  });
}
