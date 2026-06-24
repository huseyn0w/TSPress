import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiClient, type FetchLike, toQueryString } from './api-client';
import { ApiError } from './errors';

const config = {
  apiUrl: 'http://api.test',
  email: 'admin@cmstack-ts.local',
  password: 'secret',
};

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const loginOk = jsonResponse(200, { accessToken: 'tok-1', user: { id: 'u1' } });

describe('toQueryString', () => {
  it('builds a query string and skips null/undefined', () => {
    expect(toQueryString({ page: 1, status: undefined, q: 'hi', x: null })).toBe('?page=1&q=hi');
  });

  it('returns an empty string for no params', () => {
    expect(toQueryString()).toBe('');
    expect(toQueryString({})).toBe('');
  });
});

describe('ApiClient', () => {
  it('logs in before the first request and sends a bearer token', async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(loginOk)
      .mockResolvedValueOnce(jsonResponse(200, { id: 'p1' }));
    const client = new ApiClient(config, fetchMock);

    const result = await client.request('GET', '/posts/p1');

    expect(result).toEqual({ id: 'p1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api.test/auth/login');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://api.test/posts/p1');
    expect(fetchMock.mock.calls[1]?.[1]?.headers?.authorization).toBe('Bearer tok-1');
  });

  it('does not log in again on a second request (token cached)', async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(loginOk)
      .mockResolvedValue(jsonResponse(200, {}));
    const client = new ApiClient(config, fetchMock);

    await client.request('GET', '/posts');
    await client.request('GET', '/tags');

    const loginCalls = fetchMock.mock.calls.filter((c) => c[0] === 'http://api.test/auth/login');
    expect(loginCalls).toHaveLength(1);
  });

  it('re-logs in once and retries when a request returns 401', async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(loginOk) // initial login
      .mockResolvedValueOnce(jsonResponse(401, {})) // expired token
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'tok-2', user: { id: 'u1' } })) // re-login
      .mockResolvedValueOnce(jsonResponse(200, { id: 'p1' })); // retry succeeds
    const client = new ApiClient(config, fetchMock);

    const result = await client.request('GET', '/posts/p1');

    expect(result).toEqual({ id: 'p1' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3]?.[1]?.headers?.authorization).toBe('Bearer tok-2');
  });

  it('throws an ApiError carrying status and body on failure', async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(loginOk)
      .mockResolvedValueOnce(jsonResponse(403, { message: 'Forbidden resource' }));
    const client = new ApiClient(config, fetchMock);

    await expect(client.request('DELETE', '/posts/p1')).rejects.toMatchObject({
      status: 403,
    } satisfies Partial<ApiError>);
  });

  it('returns undefined for a 204 No Content response', async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(loginOk)
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined });
    const client = new ApiClient(config, fetchMock);

    await expect(client.request('DELETE', '/posts/p1')).resolves.toBeUndefined();
  });

  it('validates the response against a provided schema', async () => {
    const schema = z.object({ id: z.string() });
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(loginOk)
      .mockResolvedValueOnce(jsonResponse(200, { id: 'p1', extra: 'ignored' }));
    const client = new ApiClient(config, fetchMock);

    await expect(client.request('GET', '/posts/p1', { schema })).resolves.toEqual({ id: 'p1' });
  });

  it('serializes a JSON body and sets the content-type', async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(loginOk)
      .mockResolvedValueOnce(jsonResponse(200, { id: 'p1' }));
    const client = new ApiClient(config, fetchMock);

    await client.request('POST', '/posts', { body: { title: 'Hi' } });

    const init = fetchMock.mock.calls[1]?.[1];
    expect(init?.headers?.['content-type']).toBe('application/json');
    expect(init?.body).toBe(JSON.stringify({ title: 'Hi' }));
  });
});
