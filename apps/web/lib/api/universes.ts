'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  UniverseDetail,
  BranchPreviewRequest,
  BranchPreviewResponse,
  BranchRequest,
  BranchResponse,
  ForceDeviationRequest,
  ForceDeviationResponse,
  LineageResponse,
  DescendantsResponse,
  TickArtifactResponse,
  TickTraceResponse,
} from './types';
import type { NetworkDataset } from '@/lib/network/types';

// ---------------------------------------------------------------------------
// Universe queries
// ---------------------------------------------------------------------------

export function useUniverse(uid?: string) {
  return useQuery<UniverseDetail | null>({
    queryKey: ['universe', uid],
    queryFn: () => apiFetch<UniverseDetail>(`/api/universes/${uid}`),
    enabled: !!uid,
  });
}

export function useLineage(uid?: string) {
  return useQuery<LineageResponse | null>({
    queryKey: ['lineage', uid],
    queryFn: () => apiFetch<LineageResponse>(`/api/universes/${uid}/lineage`),
    enabled: !!uid,
  });
}

export function useDescendants(uid?: string) {
  return useQuery<DescendantsResponse | null>({
    queryKey: ['descendants', uid],
    queryFn: () => apiFetch<DescendantsResponse>(`/api/universes/${uid}/descendants`),
    enabled: !!uid,
  });
}

// ---------------------------------------------------------------------------
// Universe mutations
// ---------------------------------------------------------------------------

export function usePauseUniverse() {
  const qc = useQueryClient();
  return useMutation<{ universe_id: string; status: string }, Error, string>({
    mutationFn: (uid) =>
      apiFetch(`/api/universes/${uid}/pause`, { method: 'POST' }),
    onSuccess: (_data, uid) => {
      qc.invalidateQueries({ queryKey: ['universe', uid] });
    },
  });
}

export function useResumeUniverse() {
  const qc = useQueryClient();
  return useMutation<{ universe_id: string; status: string; next_tick: number }, Error, string>({
    mutationFn: (uid) =>
      apiFetch(`/api/universes/${uid}/resume`, { method: 'POST' }),
    onSuccess: (_data, uid) => {
      qc.invalidateQueries({ queryKey: ['universe', uid] });
    },
  });
}

export function useStepUniverse() {
  const qc = useQueryClient();
  return useMutation<
    { job_id: string; universe_id: string; tick: number },
    Error,
    { uid: string; tick?: number }
  >({
    mutationFn: ({ uid, tick }) =>
      apiFetch(`/api/universes/${uid}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tick: tick ?? null }),
      }),
    onSuccess: (_data, { uid }) => {
      qc.invalidateQueries({ queryKey: ['universe', uid] });
    },
  });
}

// ---------------------------------------------------------------------------
// Branch preview
// ---------------------------------------------------------------------------

export function useBranchPreview(uid?: string, delta?: Record<string, unknown>) {
  return useQuery<BranchPreviewResponse | null>({
    queryKey: ['branchPreview', uid, delta],
    queryFn: () =>
      apiFetch<BranchPreviewResponse>(`/api/universes/${uid}/branch-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta: delta ?? {}, reason: '' } satisfies BranchPreviewRequest),
      }),
    enabled: !!uid && delta !== undefined,
  });
}

export function useBranch() {
  const qc = useQueryClient();
  return useMutation<BranchResponse, Error, { uid: string; delta?: Record<string, unknown>; reason?: string }>({
    mutationFn: ({ uid, delta, reason }) =>
      apiFetch<BranchResponse>(`/api/universes/${uid}/branch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta: delta ?? {}, reason: reason ?? '' } satisfies BranchRequest),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multiverseTree'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Tick artifact
//
// The API response carries ledger artifacts plus review-friendly summaries.
// Older or empty runs may not have rich summaries, so the adapter keeps stable
// defaults for review components.
// ---------------------------------------------------------------------------

/** Extended artifact shape used by the review page UI components.
 * Extends the real API response with UI-only fields that the review page
 * passes to components. Fields absent from the real API are given empty
 * default values in adaptRawToTickArtifact.
 * `metrics` is narrowed to the specific shape expected by KeyMetricsRow.
 */
export interface TickArtifact extends Omit<TickArtifactResponse, 'metrics'> {
  metrics: {
    trust: number;
    polarization: number;
    volatility: number;
    trustEngagement: number;
    mobilization: number;
    [key: string]: unknown;
  };
  /** Emotion trend data series, derived from state/metrics when absent. */
  emotion_trends: Array<Record<string, number>>;
  prompt_summary: {
    promptHash: string;
    model: string;
    cost: number;
    tokens: { prompt: number; completion: number };
    toolCalls: number;
    provider: string;
    traceId: string;
  };
  tool_calls: Array<{
    id: string;
    name: string;
    status: 'success' | 'error' | 'skipped';
    args: Record<string, unknown>;
  }>;
}

function numberFromMetrics(metrics: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

function emotionTrendFromMetrics(metrics: Record<string, unknown>, tick: number) {
  const means = metrics.emotion_means;
  if (!means || typeof means !== 'object') return [];
  const source = means as Record<string, unknown>;
  return [
    {
      tick,
      hope: numberFromMetrics(source, ['hope', 'Hope']),
      fear: numberFromMetrics(source, ['fear', 'Fear']),
      anger: numberFromMetrics(source, ['anger', 'Anger']),
      joy: numberFromMetrics(source, ['joy', 'Joy']),
      sadness: numberFromMetrics(source, ['sadness', 'Sadness']),
      trust: numberFromMetrics(source, ['trust', 'Trust']),
      distrust: numberFromMetrics(source, ['distrust', 'Distrust']),
      disgust: numberFromMetrics(source, ['disgust', 'Disgust']),
      surprise: numberFromMetrics(source, ['surprise', 'Surprise']),
      Hope: numberFromMetrics(source, ['hope', 'Hope']),
      Fear: numberFromMetrics(source, ['fear', 'Fear']),
      Anger: numberFromMetrics(source, ['anger', 'Anger']),
      Joy: numberFromMetrics(source, ['joy', 'Joy']),
      Sadness: numberFromMetrics(source, ['sadness', 'Sadness']),
      Trust: numberFromMetrics(source, ['trust', 'Trust']),
      Disgust: numberFromMetrics(source, ['disgust', 'Disgust']),
      Surprise: numberFromMetrics(source, ['surprise', 'Surprise']),
    },
  ];
}

function adaptRawToTickArtifact(raw: TickArtifactResponse): TickArtifact {
  const m = raw.metrics as Record<string, unknown>;
  const defaultSummary = {
    promptHash: '',
    model: '',
    cost: 0,
    tokens: { prompt: 0, completion: 0 },
    toolCalls: 0,
    provider: '',
    traceId: raw.universe_id,
  };
  return {
    ...raw,
    metrics: {
      trust: numberFromMetrics(m, ['trust', 'trust_index']),
      polarization: numberFromMetrics(m, ['polarization', 'issue_polarization']),
      volatility: numberFromMetrics(m, ['volatility', 'divergence_vs_parent']),
      trustEngagement: numberFromMetrics(m, ['trustEngagement', 'expression_mass']),
      mobilization: numberFromMetrics(m, ['mobilization', 'mobilization_risk']),
      ...m,
    },
    emotion_trends: raw.emotion_trends?.length
      ? raw.emotion_trends
      : emotionTrendFromMetrics(m, raw.tick),
    prompt_summary: {
      ...defaultSummary,
      ...raw.prompt_summary,
      tokens: {
        ...defaultSummary.tokens,
        ...(raw.prompt_summary?.tokens ?? {}),
      },
    },
    tool_calls: raw.tool_calls ?? [],
  };
}

export function useTickArtifact(uid?: string, tick?: number) {
  return useQuery<TickArtifact | null>({
    queryKey: ['ticks', uid, tick],
    queryFn: async (): Promise<TickArtifact | null> => {
      if (!uid || tick === undefined) return null;
      try {
        const raw = await apiFetch<TickArtifactResponse>(`/api/universes/${uid}/ticks/${tick}`);
        return adaptRawToTickArtifact(raw);
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 404) return null;
        throw err;
      }
    },
    enabled: !!uid && tick !== undefined,
    staleTime: 60_000,
  });
}

export function useTickTrace(uid?: string, tick?: number, includeRaw = false) {
  return useQuery<TickTraceResponse | null>({
    queryKey: ['tickTrace', uid, tick, includeRaw],
    queryFn: async () => {
      if (!uid || tick === undefined) return null;
      try {
        return await apiFetch<TickTraceResponse>(
          `/api/universes/${uid}/ticks/${tick}/trace?include_raw=${includeRaw ? 'true' : 'false'}`
        );
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 404) return null;
        throw err;
      }
    },
    enabled: !!uid && tick !== undefined,
    staleTime: 60_000,
  });
}

export function useForceDeviation() {
  const qc = useQueryClient();
  return useMutation<
    ForceDeviationResponse,
    Error,
    { uid: string } & ForceDeviationRequest
  >({
    mutationFn: ({ uid, ...payload }) =>
      apiFetch<ForceDeviationResponse>(`/api/universes/${uid}/force-deviation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ['universe', variables.uid] });
      qc.invalidateQueries({ queryKey: ['universe', data.child_universe_id] });
      qc.invalidateQueries({ queryKey: ['multiverseTree'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

function tickParamFromSelection(selection?: string): number | null {
  if (!selection || selection === 'latest') return null;
  const range = selection.match(/^(\d+)-(\d+)$/);
  if (range) return Number(range[2]);
  const numeric = Number(selection);
  return Number.isFinite(numeric) ? numeric : null;
}

export function useNetwork(universeId?: string, layer = 'exposure', tickSelection?: string) {
  const tick = tickParamFromSelection(tickSelection);
  return useQuery<NetworkDataset | null>({
    queryKey: ['network', universeId, layer, tickSelection],
    queryFn: () => {
      if (!universeId) return Promise.resolve(null);
      const params = new URLSearchParams({ layer });
      if (tick !== null) params.set('tick', String(tick));
      return apiFetch<NetworkDataset>(
        `/api/universes/${universeId}/network?${params.toString()}`
      );
    },
    enabled: !!universeId,
    staleTime: 60_000,
  });
}
