/** Pluggable cache backend. The cache layer depends on this interface only. */
export interface CacheStore {
  /** Return the stored string for `key`, or null on miss/expiry. */
  get(key: string): Promise<string | null>;
  /** Store `value` under `key` for `ttlSeconds`. */
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Delete a single key (no-op if absent). */
  del(key: string): Promise<void>;
  /** Delete every key starting with `prefix` (namespace invalidation). */
  delByPrefix(prefix: string): Promise<void>;
}

/** DI token for the active {@link CacheStore} implementation. */
export const CACHE_STORE = Symbol('CACHE_STORE');
