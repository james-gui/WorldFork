'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  SettingsResponse,
  PatchSettingsRequest,
  ProvidersResponse,
  PatchProvidersRequest,
  RoutingResponse,
  PatchRoutingRequest,
  RateLimitsResponse,
  PatchRateLimitsRequest,
  BranchPolicyResponse,
  PatchBranchPolicyRequest,
  TestProviderRequest,
  TestProviderResponse,
} from './types';

// ---------------------------------------------------------------------------
// Global settings
// ---------------------------------------------------------------------------

export function useSettings() {
  return useQuery<SettingsResponse | null>({
    queryKey: ['settings'],
    queryFn: () => apiFetch<SettingsResponse>('/api/settings'),
  });
}

export function usePatchSettings() {
  const qc = useQueryClient();
  return useMutation<SettingsResponse, Error, PatchSettingsRequest>({
    mutationFn: (patch) =>
      apiFetch<SettingsResponse>('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Provider settings
// ---------------------------------------------------------------------------

export function useProviders() {
  return useQuery<ProvidersResponse | null>({
    queryKey: ['providers'],
    queryFn: () => apiFetch<ProvidersResponse>('/api/settings/providers'),
  });
}

export function usePatchProviders() {
  const qc = useQueryClient();
  return useMutation<ProvidersResponse, Error, PatchProvidersRequest>({
    mutationFn: (patch) =>
      apiFetch<ProvidersResponse>('/api/settings/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers'] });
    },
  });
}

export function useTestProvider() {
  return useMutation<TestProviderResponse, Error, TestProviderRequest>({
    mutationFn: (payload) =>
      apiFetch<TestProviderResponse>('/api/settings/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
  });
}

// ---------------------------------------------------------------------------
// Model routing (backend path: /api/settings/model-routing)
// ---------------------------------------------------------------------------

export function useRouting() {
  return useQuery<RoutingResponse | null>({
    queryKey: ['routing'],
    queryFn: () => apiFetch<RoutingResponse>('/api/settings/model-routing'),
  });
}

export function usePatchRouting() {
  const qc = useQueryClient();
  return useMutation<RoutingResponse, Error, Partial<PatchRoutingRequest>>({
    mutationFn: (patch) =>
      apiFetch<RoutingResponse>('/api/settings/model-routing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: [], ...patch }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routing'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Rate limits
// ---------------------------------------------------------------------------

export function useRateLimits() {
  return useQuery<RateLimitsResponse | null>({
    queryKey: ['rateLimits'],
    queryFn: () => apiFetch<RateLimitsResponse>('/api/settings/rate-limits'),
  });
}

export function usePatchRateLimits() {
  const qc = useQueryClient();
  return useMutation<RateLimitsResponse, Error, PatchRateLimitsRequest>({
    mutationFn: (patch) =>
      apiFetch<RateLimitsResponse>('/api/settings/rate-limits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rateLimits'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Branch policy
// ---------------------------------------------------------------------------

export function useBranchPolicy() {
  return useQuery<BranchPolicyResponse | null>({
    queryKey: ['branchPolicy'],
    queryFn: () => apiFetch<BranchPolicyResponse>('/api/settings/branch-policy'),
  });
}

export function usePatchBranchPolicy() {
  const qc = useQueryClient();
  // Accept either the canonical PatchBranchPolicyRequest or a form-values object
  // from the branch-policy studio page (which has a richer form shape).
  return useMutation<BranchPolicyResponse, Error, PatchBranchPolicyRequest | Record<string, unknown>>({
    mutationFn: (patch) =>
      apiFetch<BranchPolicyResponse>('/api/settings/branch-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branchPolicy'] });
    },
  });
}
