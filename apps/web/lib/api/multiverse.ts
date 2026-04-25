'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import {
  buildMultiverseTree,
  type MultiverseTreePayload,
  type MultiverseNodeData,
  type UniverseStatus,
  type BranchTrigger,
} from '@/lib/mocks/multiverse';
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

function adaptApiTreeToPayload(apiTree: MultiverseTreeResponse): MultiverseTreePayload {
  const nodeMap = new Map(apiTree.nodes.map((n) => [n.universe_id, n]));

  function countChildren(uid: string): number {
    return apiTree.edges.filter((e) => e.source === uid).length;
  }

  const nodes: MultiverseNodeData[] = apiTree.nodes.map((n: MultiverseTreeNode, idx) => {
    const childCount = countChildren(n.universe_id);
    const status = safeStatus(n.status);
    const sparklen = 18;
    const sparkSeed = idx * 17 + (n.current_tick ?? 0);
    const divergence_series = Array.from({ length: sparklen }, (_, i) => ({
      i,
      v: +(0.3 + 0.4 * Math.sin((i + sparkSeed) * 0.42)).toFixed(3),
    }));

    return {
      id: n.universe_id,
      parentId: n.parent_universe_id ?? null,
      label: `U-${n.universe_id.slice(-6)} (tick ${n.current_tick})`,
      depth: n.depth,
      status,
      branch_trigger: 'policy_change' as BranchTrigger,
      branch_from_tick: n.branch_from_tick ?? 0,
      branch_tick: n.branch_from_tick ?? 0,
      divergence_score: +(0.1 + 0.6 * Math.abs(Math.sin(idx * 1.3))).toFixed(3),
      confidence: +(0.5 + 0.4 * Math.abs(Math.cos(idx * 0.9))).toFixed(3),
      child_count: childCount,
      descendant_count: n.descendant_count,
      collapsed_children_count: 0,
      divergence_series,
      lineage_path: [],
      branch_delta: {},
      metrics: {
        population: 14,
        posts: 100 + idx * 12,
        events: 5 + idx,
        tickProgress: Math.min(1, (n.current_tick ?? 0) / Math.max(1, apiTree.max_ticks)),
      },
      created_at: new Date().toISOString(),
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
      activeUniverses: activeCount,
      totalBranches: nodes.length - 1,
      maxDepth,
      branchBudgetPct: 0,
      activeBranchesPerTick: 0,
      branchBudgetUsed: nodes.length - 1,
      branchBudgetLimit: apiTree.max_ticks,
    },
  };
}

// ---------------------------------------------------------------------------
// Multiverse tree — with 404 fallback to seeded mock during initial deployment
// ---------------------------------------------------------------------------

export function useMultiverseTree(bbId?: string) {
  return useQuery<MultiverseTreePayload | null>({
    queryKey: ['multiverseTree', bbId],
    queryFn: async () => {
      if (!bbId) return null;
      try {
        const apiTree = await apiFetch<MultiverseTreeResponse>(`/api/multiverse/${bbId}/tree`);
        return adaptApiTreeToPayload(apiTree);
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 404) {
          // Graceful degradation: return seeded mock when run doesn't exist yet
          return buildMultiverseTree({ bbId });
        }
        throw err;
      }
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
// Stubs that map to universe-level pause/resume/kill (no dedicated multiverse endpoint)
// ---------------------------------------------------------------------------

export function useSimulateNextTick() {
  return useMutation({
    mutationFn: async (payload: { bbId: string }) => {
      // TODO(B5+): wire to real endpoint when a multiverse-level tick trigger is available
      await new Promise((r) => setTimeout(r, 200));
      return { ok: true, bbId: payload.bbId };
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
  return useMutation({
    mutationFn: async (uid: string) => {
      // TODO(B5+): wire to DELETE /api/universes/{uid} or equivalent kill endpoint when available
      await new Promise((r) => setTimeout(r, 150));
      return { ok: true, uid };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multiverseTree'] });
    },
  });
}

export function useReplayFromBranch() {
  return useMutation({
    mutationFn: async (uid: string) => {
      // TODO(B5+): wire to real replay endpoint when available
      await new Promise((r) => setTimeout(r, 150));
      return { ok: true, uid };
    },
  });
}
