import type { APIRequestContext } from '@playwright/test';

export interface E2ERun {
  run_id: string;
  root_universe_id?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8003';

export async function firstRun(request: APIRequestContext): Promise<E2ERun | null> {
  try {
    const response = await request.get(`${API_BASE}/api/runs`);
    if (!response.ok()) return null;
    const body = await response.json();
    return body.items?.[0] ?? null;
  } catch {
    return null;
  }
}
