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

// Token getter used by authenticated deployments.
let getToken: () => string | undefined = () => undefined;

export function setTokenGetter(fn: () => string | undefined) {
  getToken = fn;
}

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8003';

function errorMessageFromBody(body: Record<string, unknown>, fallback: string): string {
  if (typeof body.message === 'string') return body.message;
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.detail)) {
    return body.detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg);
        }
        return JSON.stringify(item);
      })
      .join('; ');
  }
  if (body.detail && typeof body.detail === 'object') {
    return JSON.stringify(body.detail);
  }
  return fallback;
}

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
        message: errorMessageFromBody(body, response.statusText),
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
      message: errorMessageFromBody(body, res.statusText),
      code: body.code as string | undefined,
      traceId: body.trace_id as string | undefined,
    });
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text.trim()) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
