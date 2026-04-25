'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  RequestLogItem,
  WebhookLogItem,
  ErrorLogItem,
  AuditLogItem,
  TraceResponse,
  WebhookTestRequest,
  WebhookTestResponse,
  WebhookReplayRequest,
} from './types';

// ---------------------------------------------------------------------------
// Request logs (LLM calls)
// ---------------------------------------------------------------------------

export function useLogs(opts?: {
  runId?: string;
  universeId?: string;
  provider?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.provider) params.set('provider', opts.provider);
  if (opts?.status) params.set('status', opts.status);
  if (opts?.runId) params.set('run_id', opts.runId);
  if (opts?.universeId) params.set('universe_id', opts.universeId);
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
  const qs = params.toString();

  return useQuery<RequestLogItem[]>({
    queryKey: ['logs', opts],
    queryFn: () => apiFetch<RequestLogItem[]>(`/api/logs/requests${qs ? `?${qs}` : ''}`),
    refetchInterval: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Webhook logs
// ---------------------------------------------------------------------------

export function useWebhookLogs(opts?: {
  run_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.run_id) params.set('run_id', opts.run_id);
  if (opts?.status) params.set('status', opts.status);
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
  const qs = params.toString();

  return useQuery<WebhookLogItem[]>({
    queryKey: ['webhookLogs', opts],
    queryFn: () => apiFetch<WebhookLogItem[]>(`/api/logs/webhooks${qs ? `?${qs}` : ''}`),
  });
}

// ---------------------------------------------------------------------------
// Error logs
// ---------------------------------------------------------------------------

export function useErrorLogs(opts?: {
  run_id?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.run_id) params.set('run_id', opts.run_id);
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
  const qs = params.toString();

  return useQuery<ErrorLogItem[]>({
    queryKey: ['errorLogs', opts],
    queryFn: () => apiFetch<ErrorLogItem[]>(`/api/logs/errors${qs ? `?${qs}` : ''}`),
    refetchInterval: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

export function useAuditLogs(opts?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
  const qs = params.toString();

  return useQuery<AuditLogItem[]>({
    queryKey: ['auditLogs', opts],
    queryFn: () => apiFetch<AuditLogItem[]>(`/api/logs/audit${qs ? `?${qs}` : ''}`),
  });
}

// ---------------------------------------------------------------------------
// Trace
// ---------------------------------------------------------------------------

export function useTrace(traceId?: string) {
  return useQuery<TraceResponse | null>({
    queryKey: ['trace', traceId],
    queryFn: () => apiFetch<TraceResponse>(`/api/logs/traces/${traceId}`),
    enabled: !!traceId,
  });
}

// ---------------------------------------------------------------------------
// Webhook mutations
// ---------------------------------------------------------------------------

export function useTestWebhook() {
  const qc = useQueryClient();
  return useMutation<WebhookTestResponse, Error, WebhookTestRequest>({
    mutationFn: (payload) =>
      apiFetch<WebhookTestResponse>('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhookLogs'] });
    },
  });
}

export function useReplayWebhook() {
  const qc = useQueryClient();
  return useMutation<WebhookTestResponse, Error, WebhookReplayRequest>({
    mutationFn: (payload) =>
      apiFetch<WebhookTestResponse>('/api/webhooks/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhookLogs'] });
    },
  });
}
