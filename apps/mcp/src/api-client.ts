import { authResultSchema } from '@cmstack-ts/config';
import type { ZodSchema } from 'zod';
import type { McpConfig } from './config.js';
import { ApiError } from './errors.js';

/** A minimal fetch signature so a fake can be injected in tests. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions<T> {
  query?: Record<string, unknown>;
  body?: unknown;
  /** When provided, the JSON response is validated/parsed against this schema. */
  schema?: ZodSchema<T>;
}

/** Build a query string from a record, skipping null/undefined values. */
export function toQueryString(query?: Record<string, unknown>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Authenticated client for the Cmstack-TS API. Logs in once with the configured
 * service account, caches the bearer token, and transparently re-logs in a
 * single time if a request comes back 401 (token expired). The API re-checks
 * CASL on every call, so this client carries no authorization logic of its own.
 */
export class ApiClient {
  private token: string | null = null;

  constructor(
    private readonly config: McpConfig,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {}

  /** Authenticate against /auth/login and cache the access token. */
  async login(): Promise<void> {
    const res = await this.fetchImpl(`${this.config.apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: this.config.email, password: this.config.password }),
    });
    if (!res.ok) {
      throw new ApiError(
        res.status,
        `MCP login failed with status ${res.status}`,
        await safeJson(res),
      );
    }
    // The client only needs the bearer token; pick it from the shared contract
    // so we stay decoupled from the full user shape.
    const parsed = authResultSchema.pick({ accessToken: true }).parse(await res.json());
    this.token = parsed.accessToken;
  }

  /** Perform an authenticated request, parsing/validating the JSON response. */
  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    options: RequestOptions<T> = {},
  ): Promise<T> {
    if (!this.token) await this.login();

    let res = await this.send(method, path, options);
    if (res.status === 401) {
      // The cached token likely expired: re-authenticate once and retry.
      this.token = null;
      await this.login();
      res = await this.send(method, path, options);
    }

    if (!res.ok) {
      throw new ApiError(
        res.status,
        `${method} ${path} failed with status ${res.status}`,
        await safeJson(res),
      );
    }

    if (res.status === 204) return undefined as T;
    const json = await res.json();
    return options.schema ? options.schema.parse(json) : (json as T);
  }

  private send<T>(method: HttpMethod, path: string, options: RequestOptions<T>) {
    const url = `${this.config.apiUrl}${path}${toQueryString(options.query)}`;
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.token}`,
    };
    let body: string | undefined;
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    return this.fetchImpl(url, { method, headers, body });
  }
}

async function safeJson(res: { json: () => Promise<unknown> }): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}
