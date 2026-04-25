'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  JobsListResponse,
  JobInfo,
  QueuesResponse,
  WorkersResponse,
  RetryResponse,
  CancelResponse,
  QueuePauseResponse,
} from './types';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useJobs(opts?: {
  queue?: string;
  status?: string;
  type?: string;
  run_id?: string;
  limit?: number;
  offset?: number;
  refetchInterval?: number | false;
}) {
  const params = new URLSearchParams();
  if (opts?.queue) params.set('queue', opts.queue);
  if (opts?.status) params.set('status', opts.status);
  if (opts?.type) params.set('type', opts.type);
  if (opts?.run_id) params.set('run_id', opts.run_id);
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
  const qs = params.toString();

  return useQuery<JobsListResponse>({
    queryKey: ['jobs', opts],
    queryFn: () => apiFetch<JobsListResponse>(`/api/jobs${qs ? `?${qs}` : ''}`),
    refetchInterval: opts?.refetchInterval ?? 10_000,
  });
}

export function useQueues(opts?: { refetchInterval?: number | false }) {
  return useQuery<QueuesResponse | null>({
    queryKey: ['queues'],
    queryFn: () => apiFetch<QueuesResponse>('/api/jobs/queues'),
    refetchInterval: opts?.refetchInterval ?? 10_000,
  });
}

export function useWorkers() {
  return useQuery<WorkersResponse | null>({
    queryKey: ['workers'],
    queryFn: () => apiFetch<WorkersResponse>('/api/jobs/workers'),
    refetchInterval: 15_000,
  });
}

export function useJob(jobId?: string) {
  return useQuery<JobInfo | null>({
    queryKey: ['job', jobId],
    queryFn: () => apiFetch<JobInfo>(`/api/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: 5_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useRetryJob() {
  const qc = useQueryClient();
  return useMutation<RetryResponse, Error, { jobId: string; queue?: string }>({
    mutationFn: ({ jobId, queue }) =>
      apiFetch<RetryResponse>(`/api/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue: queue ?? null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useCancelJob() {
  const qc = useQueryClient();
  return useMutation<CancelResponse, Error, string>({
    mutationFn: (jobId) =>
      apiFetch<CancelResponse>(`/api/jobs/${jobId}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function usePauseQueue() {
  const qc = useQueryClient();
  return useMutation<QueuePauseResponse, Error, string>({
    mutationFn: (queue) =>
      apiFetch<QueuePauseResponse>(`/api/jobs/queues/${queue}/pause`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
    },
  });
}

export function useResumeQueue() {
  const qc = useQueryClient();
  return useMutation<QueuePauseResponse, Error, string>({
    mutationFn: (queue) =>
      apiFetch<QueuePauseResponse>(`/api/jobs/queues/${queue}/resume`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
    },
  });
}
