import createClient from 'openapi-fetch';
import type { paths } from './types.gen';

// ApiError is thrown on non-2xx responses
export class ApiError extends Error {
  status: number;
  code?: string;
  traceId?: string;

  constructor(opts: { status: number; message: string; code?: string; traceId?: string }) {
    super(opts.message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.traceId = opts.traceId;
  }
}

// Token getter — placeholder until auth lands
let getToken: () => string | undefined = () => undefined;

export function setTokenGetter(fn: () => string | undefined) {
  getToken = fn;
}

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// Typed fetch client
export const apiClient = createClient<paths>({
  baseUrl,
  headers: {
    Accept: 'application/json',
  },
});

// Middleware: attach auth token + handle errors
apiClient.use({
  async onRequest({ request }) {
    const token = getToken();
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },
  async onResponse({ response }) {
    if (!response.ok) {
      let body: Record<string, unknown> = {};
      try {
        body = await response.clone().json();
      } catch {
        // ignore parse error
      }
      throw new ApiError({
        status: response.status,
        message: (body.message as string) ?? response.statusText,
        code: body.code as string | undefined,
        traceId: body.trace_id as string | undefined,
      });
    }
    return response;
  },
});

// Convenience fetch with optional Idempotency-Key for mutations
export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit & { idempotencyKey?: string } = {}
): Promise<T> {
  const { idempotencyKey, ...rest } = opts;
  const headers = new Headers(rest.headers);
  headers.set('Accept', 'application/json');
  if (idempotencyKey) {
    headers.set('Idempotency-Key', idempotencyKey);
  }
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(`${baseUrl}${path}`, { ...rest, headers });
  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = await res.clone().json();
    } catch {
      // ignore
    }
    throw new ApiError({
      status: res.status,
      message: (body.message as string) ?? res.statusText,
      code: body.code as string | undefined,
      traceId: body.trace_id as string | undefined,
    });
  }
  return res.json() as Promise<T>;
}
