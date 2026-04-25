'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  ZepSettingResponse,
  PatchZepRequest,
  ZepTestResponse,
  ZepSyncResponse,
  ZepMappingsResponse,
  PatchZepMappingsRequest,
  ZepStatusResponse,
} from './types';

// ---------------------------------------------------------------------------
// Zep settings
// ---------------------------------------------------------------------------

export function useZep() {
  return useQuery<ZepSettingResponse | null>({
    queryKey: ['zep'],
    queryFn: () => apiFetch<ZepSettingResponse>('/api/integrations/zep'),
  });
}

export function usePatchZep() {
  const qc = useQueryClient();
  return useMutation<ZepSettingResponse, Error, PatchZepRequest>({
    mutationFn: (patch) =>
      apiFetch<ZepSettingResponse>('/api/integrations/zep', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zep'] });
      qc.invalidateQueries({ queryKey: ['zepStatus'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Zep test
// ---------------------------------------------------------------------------

export function useTestZep() {
  return useMutation<ZepTestResponse, Error, void>({
    mutationFn: () =>
      apiFetch<ZepTestResponse>('/api/integrations/zep/test', { method: 'POST' }),
  });
}

// ---------------------------------------------------------------------------
// Zep sync — backend takes run_id as query param
// ---------------------------------------------------------------------------

export function useSyncZep() {
  return useMutation<ZepSyncResponse, Error, string>({
    mutationFn: (runId) =>
      apiFetch<ZepSyncResponse>(`/api/integrations/zep/sync?run_id=${encodeURIComponent(runId)}`, {
        method: 'POST',
      }),
  });
}

// ---------------------------------------------------------------------------
// Zep mappings
// ---------------------------------------------------------------------------

export function useZepMappings() {
  return useQuery<ZepMappingsResponse | null>({
    queryKey: ['zepMappings'],
    queryFn: () => apiFetch<ZepMappingsResponse>('/api/integrations/zep/mappings'),
  });
}

export function usePatchZepMappings() {
  const qc = useQueryClient();
  return useMutation<ZepMappingsResponse, Error, PatchZepMappingsRequest>({
    mutationFn: (patch) =>
      apiFetch<ZepMappingsResponse>('/api/integrations/zep/mappings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zepMappings'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Zep status
// ---------------------------------------------------------------------------

export function useZepStatus() {
  return useQuery<ZepStatusResponse | null>({
    queryKey: ['zepStatus'],
    queryFn: () => apiFetch<ZepStatusResponse>('/api/integrations/zep/status'),
    refetchInterval: 30_000,
  });
}
