import 'server-only';

import { apiBaseUrl } from '@/app/lib/api';
import { auth } from '@/auth';
import type { ZodType } from 'zod';

/** Reads the access token from the current session. Throws if missing. */
async function getToken(): Promise<string> {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error('No access token available');
  }
  return session.accessToken;
}

/** Shared fetch base: attaches bearer token, disables cache. */
async function apiFetch(path: string, init: RequestInit): Promise<Response> {
  const token = await getToken();
  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const body = (await res.json()) as { message?: unknown };
      if (typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // ignore parse failures
    }
    throw new Error(message);
  }

  return res;
}

/**
 * GET `path`, validate the JSON response with `schema` if provided.
 * Without a schema the raw parsed JSON is returned.
 */
export async function apiGet<T>(path: string, schema?: ZodType<T>): Promise<T> {
  const res = await apiFetch(path, { method: 'GET' });
  const json: unknown = await res.json();
  if (schema) {
    return schema.parse(json);
  }
  return json as T;
}

/**
 * POST/PUT/PATCH/DELETE `path` with an optional JSON body.
 * Returns the parsed JSON or undefined on 204 No Content.
 */
export async function apiSend(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await apiFetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return undefined;
  }

  return res.json() as Promise<unknown>;
}

/**
 * POST multipart/form-data to `path`.
 * Used for file uploads; the browser-built FormData sets Content-Type with the boundary.
 */
export async function apiUpload(path: string, formData: FormData): Promise<unknown> {
  const res = await apiFetch(path, {
    method: 'POST',
    body: formData,
  });

  if (res.status === 204) {
    return undefined;
  }

  return res.json() as Promise<unknown>;
}
