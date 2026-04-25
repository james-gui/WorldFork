'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import {
  type MultiverseTreePayload,
  type MultiverseNodeData,
  type UniverseStatus,
  type BranchTrigger,
} from '@/lib/multiverse/types';
import type {
  MultiverseTreeResponse,
  MultiverseTreeNode,
  MultiverseDagResponse,
  MultiverseMetricsResponse,
  PruneRequest,
  PruneResponse,
  FocusBranchRequest,
  CompareRequest,
  CompareResponse,
} from './types';

// ---------------------------------------------------------------------------
// Adapt real API tree response to MultiverseTreePayload (the shape the page expects).
// Fields the real API doesn't supply (label, divergence_series, events, kpis, etc.)
// are synthesized deterministically from the node data.
// ---------------------------------------------------------------------------

const KNOWN_STATUSES = new Set<string>([
  'active', 'candidate', 'frozen', 'killed', 'completed', 'merged',
]);

function safeStatus(s: string): UniverseStatus {
  return KNOWN_STATUSES.has(s) ? (s as UniverseStatus) : 'active';
}

function metricNumber(
  metrics: Record<string, unknown>,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return fallback;
}

function branchTriggerFromNode(node: MultiverseTreeNode): BranchTrigger {
  const deltaType = typeof node.branch_delta?.type === 'string'
    ? node.branch_delta.type
    : '';
  const reason = `${node.branch_reason} ${deltaType}`.toLowerCase();
  if (reason.includes('tech') || reason.includes('breakthrough')) return 'tech_breakthrough';
  if (reason.includes('movement') || reason.includes('mobilization')) return 'social_movement';
  if (reason.includes('econom') || reason.includes('unemployment')) return 'economic_crisis';
  if (reason.includes('media') || reason.includes('viral')) return 'media_event';
  if (reason.includes('god')) return 'godagent_decision';
  return 'policy_change';
}

function adaptApiTreeToPayload(
  apiTree: MultiverseTreeResponse,
  metrics?: MultiverseMetricsResponse | null,
): MultiverseTreePayload {
  function countChildren(uid: string): number {
    return apiTree.edges.filter((e) => e.source === uid).length;
  }

  const nodes: MultiverseNodeData[] = apiTree.nodes.map((n: MultiverseTreeNode) => {
    const childCount = countChildren(n.universe_id);
    const status = safeStatus(n.status);
    const divergenceScore = metricNumber(
      n.latest_metrics,
      ['divergence_score', 'divergence_vs_parent', 'divergence', 'branch_divergence'],
      n.parent_universe_id ? 0.1 : 0,
    );
    const confidence = metricNumber(n.latest_metrics, ['confidence', 'llm_confidence'], 1);
    const sparklen = Math.max(2, Math.min(18, (n.current_tick ?? 0) + 1));
    const divergence_series = Array.from({ length: sparklen }, (_, i) => ({
      i,
      v: divergenceScore,
    }));

    return {
      id: n.universe_id,
      parentId: n.parent_universe_id ?? null,
      label: `U-${n.universe_id.slice(-6)} (tick ${n.current_tick})`,
      depth: n.depth,
      status,
      current_tick: n.current_tick ?? 0,
      branch_trigger: branchTriggerFromNode(n),
      branch_from_tick: n.branch_from_tick ?? 0,
      branch_tick: n.branch_from_tick ?? 0,
      divergence_score: divergenceScore,
      confidence,
      child_count: childCount,
      descendant_count: n.descendant_count,
      collapsed_children_count: 0,
      divergence_series,
      lineage_path: n.lineage_path ?? [],
      branch_delta: n.branch_delta ?? {},
      metrics: {
        population: metricNumber(n.latest_metrics, ['population', 'active_population', 'total_population_modeled']),
        posts: metricNumber(n.latest_metrics, ['posts', 'post_count', 'social_posts', 'post_volume']),
        events: metricNumber(n.latest_metrics, ['events', 'event_count', 'pending_events']),
        tickProgress: Math.min(1, (n.current_tick ?? 0) / Math.max(1, apiTree.max_ticks)),
      },
      created_at: n.created_at ?? '',
    };
  });

  const edges = apiTree.edges.map((e) => ({
    id: `${e.source}->${e.target}`,
    source: e.source,
    target: e.target,
  }));

  const activeCount = nodes.filter((n) => n.status === 'active').length;
  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);

  return {
    bbId: apiTree.big_bang_id,
    generatedAt: new Date().toISOString(),
    etag: `${apiTree.big_bang_id}-${apiTree.nodes.length}`,
    nodes,
    edges,
    events: [],
    kpis: {
      activeUniverses: metrics?.active_universes ?? activeCount,
      totalBranches: metrics?.total_branches ?? nodes.length - 1,
      maxDepth: metrics?.max_depth ?? maxDepth,
      branchBudgetPct: metrics?.branch_budget_pct ?? 0,
      activeBranchesPerTick: metrics?.active_branches_per_tick ?? 0,
      branchBudgetUsed: metrics?.branch_budget_used ?? nodes.length - 1,
      branchBudgetLimit: metrics?.branch_budget_limit ?? apiTree.max_ticks,
    },
  };
}

// ---------------------------------------------------------------------------
// Multiverse tree
// ---------------------------------------------------------------------------

export function useMultiverseTree(bbId?: string) {
  return useQuery<MultiverseTreePayload | null>({
    queryKey: ['multiverseTree', bbId],
    queryFn: async () => {
      if (!bbId) return null;
      const [apiTree, metrics] = await Promise.all([
        apiFetch<MultiverseTreeResponse>(`/api/multiverse/${bbId}/tree`),
        apiFetch<MultiverseMetricsResponse>(`/api/multiverse/${bbId}/metrics`)
          .catch((err: unknown) => {
            const status = (err as { status?: number })?.status;
            if (status === 404) return null;
            throw err;
          }),
      ]);
      return adaptApiTreeToPayload(apiTree, metrics);
    },
    enabled: !!bbId,
    staleTime: 60_000,
    // Keep previous data visible while refetching
    placeholderData: (prev) => prev,
  });
}

export function useMultiverseDag(bbId?: string) {
  return useQuery<MultiverseDagResponse | null>({
    queryKey: ['multiverseDag', bbId],
    queryFn: async () => {
      if (!bbId) return null;
      try {
        return await apiFetch<MultiverseDagResponse>(`/api/multiverse/${bbId}/dag`);
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 404) return null;
        throw err;
      }
    },
    enabled: !!bbId,
    placeholderData: (prev) => prev,
  });
}

export function useMultiverseMetrics(bbId?: string) {
  return useQuery<MultiverseMetricsResponse | null>({
    queryKey: ['multiverseMetrics', bbId],
    queryFn: async () => {
      if (!bbId) return null;
      try {
        return await apiFetch<MultiverseMetricsResponse>(`/api/multiverse/${bbId}/metrics`);
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 404) return null;
        throw err;
      }
    },
    enabled: !!bbId,
    placeholderData: (prev) => prev,
  });
}

export function useCompareBranches(bbId?: string, universeIds?: string[], aspect?: string) {
  return useQuery<CompareResponse | null>({
    queryKey: ['compareBranches', bbId, universeIds, aspect],
    queryFn: () =>
      apiFetch<CompareResponse>(`/api/multiverse/${bbId}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universe_ids: universeIds ?? [],
          aspect: aspect ?? 'metrics',
        } satisfies CompareRequest),
      }),
    enabled: !!bbId && !!universeIds && universeIds.length >= 2,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function usePruneMultiverse() {
  const qc = useQueryClient();
  return useMutation<PruneResponse, Error, { bbId: string } & PruneRequest>({
    mutationFn: ({ bbId, ...payload }) =>
      apiFetch<PruneResponse>(`/api/multiverse/${bbId}/prune`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multiverseTree'] });
    },
  });
}

export function useFocusBranch(bbId?: string) {
  const qc = useQueryClient();
  return useMutation<MultiverseTreeResponse, Error, string>({
    mutationFn: (universeId) =>
      apiFetch<MultiverseTreeResponse>(`/api/multiverse/${bbId}/focus-branch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universe_id: universeId } satisfies FocusBranchRequest),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multiverseTree'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations backed by multiverse and universe endpoints
// ---------------------------------------------------------------------------

export function useSimulateNextTick() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { bbId: string }) =>
      apiFetch<{ big_bang_id: string; enqueued: number; job_ids: string[] }>(
        `/api/multiverse/${payload.bbId}/simulate-next-tick`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multiverseTree'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useFreezeUniverse() {
  const qc = useQueryClient();
  return useMutation<{ universe_id: string; status: string }, Error, string>({
    mutationFn: (uid) =>
      apiFetch(`/api/universes/${uid}/pause`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multiverseTree'] });
    },
  });
}

export function useKillUniverse() {
  const qc = useQueryClient();
  return useMutation<{ universe_id: string; status: string }, Error, string>({
    mutationFn: (uid: string) =>
      apiFetch(`/api/universes/${uid}/kill`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multiverseTree'] });
    },
  });
}

export function useReplayFromBranch() {
  const qc = useQueryClient();
  return useMutation<{ job_id: string; universe_id: string }, Error, string>({
    mutationFn: (uid: string) =>
      apiFetch(`/api/universes/${uid}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tick: null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multiverseTree'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
