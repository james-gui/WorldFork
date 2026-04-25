'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  UniverseDetail,
  BranchPreviewRequest,
  BranchPreviewResponse,
  BranchRequest,
  BranchResponse,
  LineageResponse,
  DescendantsResponse,
  TickArtifactResponse,
} from './types';
import {
  buildSeededNetwork,
  type NetworkDataset,
} from '@/lib/network/seededDataset';

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
// The real API (TickArtifactResponse) returns parsed_decisions, social_posts,
// state_after, god_decision, metrics as generic dicts. The review page was
// built against a richer mock shape (TickArtifact below) that includes
// emotion_trends, prompt_summary, tool_calls, etc.
//
// Strategy: try the real API; on success, spread the API response into the
// extended TickArtifact shape so fields accessed by the review page remain
// optional (undefined). On 404, return null.
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
  /** Emotion trend data series — not in real API, defaults to empty array. */
  emotion_trends: Array<Record<string, number>>;
  /** LLM prompt summary — not in real API, defaults to empty stub. */
  prompt_summary: {
    promptHash: string;
    model: string;
    cost: number;
    tokens: { prompt: number; completion: number };
    toolCalls: number;
    provider: string;
    traceId: string;
  };
  /** Tool call records — not in real API, defaults to empty array. */
  tool_calls: Array<{
    id: string;
    name: string;
    status: 'success' | 'error' | 'skipped';
    args: Record<string, unknown>;
  }>;
}

function adaptRawToTickArtifact(raw: TickArtifactResponse): TickArtifact {
  const m = raw.metrics as Record<string, unknown>;
  return {
    ...raw,
    metrics: {
      trust: typeof m.trust === 'number' ? m.trust : 0,
      polarization: typeof m.polarization === 'number' ? m.polarization : 0,
      volatility: typeof m.volatility === 'number' ? m.volatility : 0,
      trustEngagement: typeof m.trustEngagement === 'number' ? m.trustEngagement : 0,
      mobilization: typeof m.mobilization === 'number' ? m.mobilization : 0,
      ...m,
    },
    // UI-only fields not present in real API — provide empty defaults
    emotion_trends: [],
    prompt_summary: {
      promptHash: '',
      model: '',
      cost: 0,
      tokens: { prompt: 0, completion: 0 },
      toolCalls: 0,
      provider: '',
      traceId: raw.universe_id,
    },
    tool_calls: [],
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

// ---------------------------------------------------------------------------
// Network — seeded mock (no backend endpoint yet)
// TODO(B5+): wire to real endpoint when /api/universes/{uid}/network is available
// ---------------------------------------------------------------------------

export function useNetwork(universeId: string, layer: string) {
  return useQuery<NetworkDataset>({
    queryKey: ['network', universeId, layer],
    queryFn: async () => {
      // TODO(B5+): wire to real endpoint when available:
      //   return apiFetch<NetworkDataset>(`/api/universes/${universeId}/network?layer=${layer}`);
      const seed = stringToSeed(universeId || 'demo');
      return buildSeededNetwork(seed, 120);
    },
    staleTime: 60_000,
  });
}

function stringToSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
