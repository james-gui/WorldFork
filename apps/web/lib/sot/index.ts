'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { SoTBundleResponse } from '@/lib/api/types';

export type SoTBundle = SoTBundleResponse;

export function useSourceOfTruth(runId: string) {
  return useQuery<SoTBundle | null>({
    queryKey: ['sot', runId],
    queryFn: async () => {
      try {
        return await apiFetch<SoTBundle>(`/api/runs/${runId}/source-of-truth`);
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
