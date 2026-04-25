'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { RunRow, RunStatus } from '@/components/runs/RunsTable';
import type {
  CreateRunRequest,
  CreateRunResponse,
  RunListItem,
  RunListResponse,
  RunDetail,
  PatchRunRequest,
  RunResultsRegenerateResponse,
  RunResultsResponse,
  SoTBundleResponse,
} from './types';

// ---------------------------------------------------------------------------
// Adapter: RunListItem (API) → RunRow (UI)
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, RunStatus> = {
  draft: 'paused',
  initializing: 'running',
  active: 'running',
  running: 'running',
  paused: 'paused',
  completed: 'completed',
  failed: 'failed',
  archived: 'archived',
};

function adaptRunListItemToRow(item: RunListItem): RunRow {
  const archived = item.archived === true || item.status === 'archived';
  return {
    id: item.run_id,
    name: item.display_name,
    bigBangId: item.run_id,
    rootUniverseId: item.root_universe_id,
    createdAt: item.created_at,
    durationSeconds: 0,
    universeCount: item.total_universe_count ?? 0,
    status: archived ? 'archived' : STATUS_MAP[item.status] ?? 'running',
    provider: '',
    tags: [],
    scenarioType: item.time_horizon_label ?? '',
    starred: item.favorite ?? false,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useRuns(opts?: {
  status?: string;
  limit?: number;
  offset?: number;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
  if (opts?.q) params.set('q', opts.q);
  const qs = params.toString();

  // Returns RunRow-shaped data for page compatibility
  return useQuery<RunRow[]>({
    queryKey: ['runs', opts],
    queryFn: async () => {
      const res = await apiFetch<RunListResponse>(`/api/runs${qs ? `?${qs}` : ''}`);
      return res.items.map(adaptRunListItemToRow);
    },
  });
}

/** Full paginated response variant for consumers that need total/offset. */
export function useRunList(opts?: {
  status?: string;
  limit?: number;
  offset?: number;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
  if (opts?.q) params.set('q', opts.q);
  const qs = params.toString();

  return useQuery<RunListResponse>({
    queryKey: ['runList', opts],
    queryFn: () => apiFetch<RunListResponse>(`/api/runs${qs ? `?${qs}` : ''}`),
  });
}

export function useRun(runId?: string) {
  return useQuery<RunDetail | null>({
    queryKey: ['run', runId],
    queryFn: () => apiFetch<RunDetail>(`/api/runs/${runId}`),
    enabled: !!runId,
  });
}

export function useRunSourceOfTruth(runId?: string) {
  return useQuery<SoTBundleResponse | null>({
    queryKey: ['runSourceOfTruth', runId],
    queryFn: async () => {
      try {
        return await apiFetch<SoTBundleResponse>(`/api/runs/${runId}/source-of-truth`);
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 404) return null;
        throw err;
      }
    },
    enabled: !!runId,
    staleTime: 5 * 60_000,
  });
}

export function useRunResults(runId?: string) {
  return useQuery<RunResultsResponse | null>({
    queryKey: ['runResults', runId],
    queryFn: () => apiFetch<RunResultsResponse>(`/api/runs/${runId}/results`),
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'running' ? 3000 : false;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Wizard / caller payload — a superset of CreateRunRequest with optional wizard fields. */
export interface CreateRunPayload extends Partial<CreateRunRequest> {
  idempotencyKey?: string;
  // Wizard-specific fields (ignored by the API, present in form values):
  [key: string]: unknown;
}

const TICK_DURATION_MINUTES: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
};

export function useCreateRun() {
  const qc = useQueryClient();
  return useMutation<CreateRunResponse, Error, CreateRunPayload>({
    mutationFn: ({ idempotencyKey, ...payload }) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      // Pick only the API fields from the payload; wizard may pass extra fields.
      const body: CreateRunRequest = {
        display_name:
          typeof payload.display_name === 'string'
            ? payload.display_name
            : typeof (payload as Record<string, unknown>).scenarioText === 'string'
              ? String((payload as Record<string, unknown>).scenarioText).slice(0, 80)
              : 'New Simulation',
        scenario_text:
          typeof payload.scenario_text === 'string'
            ? payload.scenario_text
            : typeof (payload as Record<string, unknown>).scenarioText === 'string'
              ? String((payload as Record<string, unknown>).scenarioText)
              : '',
        time_horizon_label:
          typeof payload.time_horizon_label === 'string'
            ? payload.time_horizon_label
            : '6 months',
        tick_duration_minutes:
          typeof payload.tick_duration_minutes === 'number'
            ? payload.tick_duration_minutes
            : typeof (payload as Record<string, unknown>).tickDuration === 'string'
              ? TICK_DURATION_MINUTES[String((payload as Record<string, unknown>).tickDuration)] ?? 1440
              : 1440,
        max_ticks:
          typeof payload.max_ticks === 'number'
            ? payload.max_ticks
            : typeof (payload as Record<string, unknown>).numberOfTicks === 'number'
              ? Number((payload as Record<string, unknown>).numberOfTicks)
              : 180,
        max_schedule_horizon_ticks:
          typeof payload.max_schedule_horizon_ticks === 'number'
            ? payload.max_schedule_horizon_ticks
            : 10,
        uploaded_doc_ids: Array.isArray(payload.uploaded_doc_ids)
          ? (payload.uploaded_doc_ids as string[])
          : [],
        provider_snapshot_id: typeof payload.provider_snapshot_id === 'string'
          ? payload.provider_snapshot_id
          : undefined,
      };
      return apiFetch<CreateRunResponse>('/api/runs', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}

export function usePatchRun(runId?: string) {
  const qc = useQueryClient();
  return useMutation<RunDetail, Error, PatchRunRequest>({
    mutationFn: (patch) =>
      apiFetch<RunDetail>(`/api/runs/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['run', runId] });
      qc.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}

export function useArchiveRun() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (runId) =>
      apiFetch<void>(`/api/runs/${runId}/archive`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}

export function useDuplicateRun() {
  const qc = useQueryClient();
  return useMutation<{ run_id: string; root_universe_id: string; status: string }, Error, string>({
    mutationFn: (runId) =>
      apiFetch(`/api/runs/${runId}/duplicate`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}

export function useExportRun() {
  return useMutation<{ job_id: string; status: string }, Error, string>({
    mutationFn: (runId) =>
      apiFetch(`/api/runs/${runId}/export`, { method: 'POST' }),
  });
}

export function useRegenerateRunResults() {
  const qc = useQueryClient();
  return useMutation<RunResultsRegenerateResponse, Error, string>({
    mutationFn: (runId) =>
      apiFetch<RunResultsRegenerateResponse>(`/api/runs/${runId}/results/regenerate`, {
        method: 'POST',
      }),
    onSuccess: (_data, runId) => {
      qc.invalidateQueries({ queryKey: ['runResults', runId] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
