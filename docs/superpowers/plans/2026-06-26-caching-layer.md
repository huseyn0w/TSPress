# Caching layer (§7 #10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared, Redis-capable cache for the hot public read paths, with event-driven invalidation wired to the existing `HookRegistry`.

**Architecture:** A new `cache` NestJS module exposes `CacheService` backed by a pluggable `CacheStore` (token `CACHE_STORE`) — `RedisCacheStore` (ioredis) when `REDIS_URL` is set, else an in-memory `MemoryCacheStore` (so the cache is demonstrable and unit-testable without Redis). Public read services wrap their reads in `getOrSet`; write services `emit` new core action events; a `CacheInvalidationListener` subscribes to those events and flushes the matching namespace.

**Tech Stack:** NestJS (CommonJS), TypeScript, ioredis, Vitest, Zod (`@cmstack-ts/config`).

## Global Constraints

- Reply to the operator in **Russian**; code/comments/docs in **English**.
- Repos never catch P2002/P2025; **the cache never fails a read** — any store error is caught, logged, and the call falls through to the factory (no cache write).
- Locales come from `@cmstack-ts/config` `LOCALES`/`DEFAULT_LOCALE`. Locale + query params are part of every cache key.
- Observer (§2.7): a service emits a `HookRegistry` action only on a **real side effect**; the repository never touches the registry. Cache invalidation is the consumer.
- Cached read must return byte-identical data to the un-cached path (cache the existing public DTOs only; never put `authorEmail`/secrets in a key or value).
- New env read **directly** from `process.env` in the cache module factory (test-safe), AND added to `envSchema` for documentation/validation — mirror `MEDIA_MAX_MEGAPIXELS`.
- Run gates after each task: `pnpm test` (single file: `pnpm vitest run <path>`), `pnpm typecheck`, `pnpm lint`. **Write-tool gotcha:** strip any stray trailing `</content>` line (`perl -0pi -e 's/\n?<\/content>\s*$//' <file>`) + `pnpm format`.
- **No `Co-Authored-By`/Claude trailer in commit messages.**
- Conventions: token = `CACHE_STORE` Symbol; wire providers in the feature module; service test fakes typed `Record<keyof X, Mock>` cast `as unknown as X`; import model/repo types from `@cmstack-ts/db`, never `@prisma/client`.

---

### Task 1: Cache env config (`@cmstack-ts/config`)

**Files:**
- Modify: `packages/config/src/env.ts`
- Test: `packages/config/src/env.test.ts`

**Interfaces:**
- Produces: `envSchema` gains `REDIS_URL?: string`, `CACHE_TTL_SECONDS: number` (default 300), `CACHE_ENABLED: boolean` (default true).

- [ ] **Step 1: Write the failing tests** — append to `packages/config/src/env.test.ts`:

```ts
it('defaults cache settings when unset', () => {
  const env = parseEnv({
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    AUTH_SECRET: 'x'.repeat(16),
    INTERNAL_API_SECRET: 'y'.repeat(16),
  });
  expect(env.REDIS_URL).toBeUndefined();
  expect(env.CACHE_TTL_SECONDS).toBe(300);
  expect(env.CACHE_ENABLED).toBe(true);
});

it('parses cache settings when provided', () => {
  const env = parseEnv({
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    AUTH_SECRET: 'x'.repeat(16),
    INTERNAL_API_SECRET: 'y'.repeat(16),
    REDIS_URL: 'redis://localhost:6379',
    CACHE_TTL_SECONDS: '60',
    CACHE_ENABLED: 'false',
  });
  expect(env.REDIS_URL).toBe('redis://localhost:6379');
  expect(env.CACHE_TTL_SECONDS).toBe(60);
  expect(env.CACHE_ENABLED).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run packages/config/src/env.test.ts` → FAIL (`CACHE_TTL_SECONDS` undefined).

- [ ] **Step 3: Implement** — add to `envSchema` in `packages/config/src/env.ts` (after `PASSWORD_RESET_TTL_MINUTES`):

```ts
  // Caching layer (Phase: feature parity §7 #10). REDIS_URL is optional: when
  // unset, the API uses an in-process memory cache (single-worker only). Set it
  // to a redis:// URL for a shared, multi-worker-correct backend.
  REDIS_URL: z.string().url().optional(),
  // Default TTL (seconds) for cached public reads.
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  // Master switch. 'false' disables caching (every read hits the source).
  CACHE_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
```

- [ ] **Step 4: Run to verify pass** — `pnpm vitest run packages/config/src/env.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/config/src/env.ts packages/config/src/env.test.ts
git commit -m "feat(config): cache env settings (REDIS_URL, CACHE_TTL_SECONDS, CACHE_ENABLED)"
```

---

### Task 2: `CacheStore` interface + keys + `MemoryCacheStore`

**Files:**
- Create: `apps/api/src/cache/cache-store.ts`
- Create: `apps/api/src/cache/cache.keys.ts`
- Create: `apps/api/src/cache/memory-cache-store.ts`
- Test: `apps/api/src/cache/memory-cache-store.spec.ts`

**Interfaces:**
- Produces:
  - `interface CacheStore { get(key): Promise<string|null>; set(key, value, ttlSeconds): Promise<void>; del(key): Promise<void>; delByPrefix(prefix): Promise<void> }`
  - `const CACHE_STORE: unique symbol`
  - `CACHE_NS = { SETTINGS:'settings', SEO:'seo', POSTS:'content:posts', PAGES:'content:pages', MENUS:'menus' }`
  - `cacheKey(ns, disc): string` → `cms:<ns>:<disc>`; `cachePrefix(ns): string` → `cms:<ns>:`
  - `class MemoryCacheStore implements CacheStore`

- [ ] **Step 1: Write `cache-store.ts` + `cache.keys.ts`**

`apps/api/src/cache/cache-store.ts`:

```ts
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
```

`apps/api/src/cache/cache.keys.ts`:

```ts
/** Cache namespaces — each is flushed as a unit on the matching write event. */
export const CACHE_NS = {
  SETTINGS: 'settings',
  SEO: 'seo',
  POSTS: 'content:posts',
  PAGES: 'content:pages',
  MENUS: 'menus',
} as const;

export type CacheNamespace = (typeof CACHE_NS)[keyof typeof CACHE_NS];

/** Full key: `cms:<ns>:<discriminator>` (locale/query live in the discriminator). */
export function cacheKey(ns: CacheNamespace, discriminator: string): string {
  return `cms:${ns}:${discriminator}`;
}

/** Prefix covering an entire namespace, for {@link CacheStore.delByPrefix}. */
export function cachePrefix(ns: CacheNamespace): string {
  return `cms:${ns}:`;
}
```

- [ ] **Step 2: Write the failing test** — `apps/api/src/cache/memory-cache-store.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { MemoryCacheStore } from './memory-cache-store';

describe('MemoryCacheStore', () => {
  it('stores and returns a value', async () => {
    const store = new MemoryCacheStore();
    await store.set('a', 'one', 60);
    expect(await store.get('a')).toBe('one');
  });

  it('returns null after TTL expiry', async () => {
    vi.useFakeTimers();
    const store = new MemoryCacheStore();
    await store.set('a', 'one', 1);
    vi.advanceTimersByTime(1500);
    expect(await store.get('a')).toBeNull();
    vi.useRealTimers();
  });

  it('deletes a single key', async () => {
    const store = new MemoryCacheStore();
    await store.set('a', 'one', 60);
    await store.del('a');
    expect(await store.get('a')).toBeNull();
  });

  it('deletes every key under a prefix', async () => {
    const store = new MemoryCacheStore();
    await store.set('cms:seo:x', '1', 60);
    await store.set('cms:seo:y', '2', 60);
    await store.set('cms:menus:z', '3', 60);
    await store.delByPrefix('cms:seo:');
    expect(await store.get('cms:seo:x')).toBeNull();
    expect(await store.get('cms:seo:y')).toBeNull();
    expect(await store.get('cms:menus:z')).toBe('3');
  });
});
```

- [ ] **Step 3: Run to verify failure** — `pnpm vitest run apps/api/src/cache/memory-cache-store.spec.ts` → FAIL (module not found).

- [ ] **Step 4: Implement** — `apps/api/src/cache/memory-cache-store.ts`:

```ts
import { Logger } from '@nestjs/common';
import type { CacheStore } from './cache-store';

interface Entry {
  value: string;
  expiresAt: number;
}

/**
 * In-process cache used when no `REDIS_URL` is configured. Single-worker only —
 * each API process has its own map, so it is NOT shared across workers. Good for
 * local/demo runs and tests; set `REDIS_URL` for multi-worker correctness.
 */
export class MemoryCacheStore implements CacheStore {
  private readonly store = new Map<string, Entry>();

  constructor() {
    new Logger('CacheStore').log('Using in-process memory cache (set REDIS_URL for a shared cache).');
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}
```

- [ ] **Step 5: Run to verify pass** — `pnpm vitest run apps/api/src/cache/memory-cache-store.spec.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/cache/cache-store.ts apps/api/src/cache/cache.keys.ts apps/api/src/cache/memory-cache-store.ts apps/api/src/cache/memory-cache-store.spec.ts
git commit -m "feat(api): CacheStore interface, key helpers & in-memory store"
```

---

### Task 2b: Add `ioredis` dependency

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install** — `pnpm --filter @cmstack-ts/api add ioredis`
- [ ] **Step 2: Verify** — `node -e "require('ioredis')"` from repo root → no error (run via `pnpm --filter @cmstack-ts/api exec node -e "require('ioredis')"` if needed). Confirm `apps/api/package.json` lists `ioredis` under dependencies.
- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): add ioredis for the Redis cache backend"
```

---

### Task 3: `RedisCacheStore`

**Files:**
- Create: `apps/api/src/cache/redis-cache-store.ts`
- Test: `apps/api/src/cache/redis-cache-store.spec.ts`

**Interfaces:**
- Consumes: `CacheStore` (Task 2).
- Produces:
  - `interface RedisLike` — the minimal ioredis surface used (so the SCAN/DEL logic is unit-tested with a fake; a real `ioredis` `Redis` satisfies it).
  - `class RedisCacheStore implements CacheStore` — constructor takes a `RedisLike`.

- [ ] **Step 1: Write the failing test** — `apps/api/src/cache/redis-cache-store.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { type RedisLike, RedisCacheStore } from './redis-cache-store';

function fakeRedis(overrides: Partial<RedisLike> = {}): RedisLike {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    scan: vi.fn().mockResolvedValue(['0', []]),
    ...overrides,
  };
}

describe('RedisCacheStore', () => {
  it('sets with an EX ttl', async () => {
    const redis = fakeRedis();
    await new RedisCacheStore(redis).set('k', 'v', 30);
    expect(redis.set).toHaveBeenCalledWith('k', 'v', 'EX', 30);
  });

  it('gets a stored value', async () => {
    const redis = fakeRedis({ get: vi.fn().mockResolvedValue('v') });
    expect(await new RedisCacheStore(redis).get('k')).toBe('v');
  });

  it('deletes every key under a prefix across SCAN pages', async () => {
    const scan = vi
      .fn()
      .mockResolvedValueOnce(['42', ['cms:seo:a', 'cms:seo:b']])
      .mockResolvedValueOnce(['0', ['cms:seo:c']]);
    const del = vi.fn().mockResolvedValue(1);
    await new RedisCacheStore(fakeRedis({ scan, del })).delByPrefix('cms:seo:');
    expect(scan).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith('cms:seo:a', 'cms:seo:b');
    expect(del).toHaveBeenCalledWith('cms:seo:c');
  });

  it('does not call del when a page is empty', async () => {
    const del = vi.fn();
    await new RedisCacheStore(fakeRedis({ del })).delByPrefix('cms:seo:');
    expect(del).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run apps/api/src/cache/redis-cache-store.spec.ts` → FAIL.

- [ ] **Step 3: Implement** — `apps/api/src/cache/redis-cache-store.ts`:

```ts
import type { CacheStore } from './cache-store';

/** The minimal ioredis surface this store uses (a real `Redis` satisfies it). */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  scan(
    cursor: string,
    matchToken: 'MATCH',
    pattern: string,
    countToken: 'COUNT',
    count: number,
  ): Promise<[string, string[]]>;
}

/**
 * Redis-backed cache. Prefix invalidation uses non-blocking `SCAN` (never
 * `KEYS`) so flushing a namespace stays safe on a large keyspace.
 */
export class RedisCacheStore implements CacheStore {
  constructor(private readonly client: RedisLike) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    let cursor = '0';
    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) await this.client.del(...keys);
    } while (cursor !== '0');
  }
}
```

- [ ] **Step 4: Run to verify pass** — `pnpm vitest run apps/api/src/cache/redis-cache-store.spec.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/cache/redis-cache-store.ts apps/api/src/cache/redis-cache-store.spec.ts
git commit -m "feat(api): Redis-backed cache store with SCAN-based prefix flush"
```

---

### Task 4: `CacheService`

**Files:**
- Create: `apps/api/src/cache/cache.service.ts`
- Test: `apps/api/src/cache/cache.service.spec.ts`

**Interfaces:**
- Consumes: `CacheStore` + `CACHE_STORE` (Task 2), `cachePrefix`/`CacheNamespace` (Task 2).
- Produces:
  - `class CacheService` — constructor `(store: CacheStore, opts: { enabled: boolean; defaultTtlSeconds: number })`.
  - `getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T>` — returns parsed cached `T` on hit; else runs `factory`, caches its JSON, returns it. Store errors are swallowed (logged) → always returns a correct value.
  - `invalidate(ns: CacheNamespace): Promise<void>` — fault-isolated namespace flush.

- [ ] **Step 1: Write the failing test** — `apps/api/src/cache/cache.service.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { CACHE_NS } from './cache.keys';
import type { CacheStore } from './cache-store';
import { CacheService } from './cache.service';

function fakeStore(overrides: Partial<CacheStore> = {}): CacheStore {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    delByPrefix: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const opts = { enabled: true, defaultTtlSeconds: 300 };

describe('CacheService', () => {
  it('returns the parsed value on a hit without calling the factory', async () => {
    const store = fakeStore({ get: vi.fn().mockResolvedValue(JSON.stringify({ a: 1 })) });
    const factory = vi.fn();
    const svc = new CacheService(store, opts);
    expect(await svc.getOrSet('k', factory)).toEqual({ a: 1 });
    expect(factory).not.toHaveBeenCalled();
  });

  it('runs the factory and stores its JSON on a miss', async () => {
    const store = fakeStore();
    const svc = new CacheService(store, opts);
    const result = await svc.getOrSet('k', async () => ({ a: 2 }), 60);
    expect(result).toEqual({ a: 2 });
    expect(store.set).toHaveBeenCalledWith('k', JSON.stringify({ a: 2 }), 60);
  });

  it('falls through to the factory when the store throws (fault isolation)', async () => {
    const store = fakeStore({ get: vi.fn().mockRejectedValue(new Error('redis down')) });
    const svc = new CacheService(store, opts);
    expect(await svc.getOrSet('k', async () => ({ a: 3 }))).toEqual({ a: 3 });
  });

  it('bypasses the cache entirely when disabled', async () => {
    const store = fakeStore();
    const svc = new CacheService(store, { enabled: false, defaultTtlSeconds: 300 });
    const factory = vi.fn().mockResolvedValue({ a: 4 });
    expect(await svc.getOrSet('k', factory)).toEqual({ a: 4 });
    expect(store.get).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
    expect(factory).toHaveBeenCalledOnce();
  });

  it('invalidate flushes the namespace prefix', async () => {
    const store = fakeStore();
    await new CacheService(store, opts).invalidate(CACHE_NS.SEO);
    expect(store.delByPrefix).toHaveBeenCalledWith('cms:seo:');
  });

  it('invalidate swallows store errors', async () => {
    const store = fakeStore({ delByPrefix: vi.fn().mockRejectedValue(new Error('x')) });
    await expect(new CacheService(store, opts).invalidate(CACHE_NS.SEO)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run apps/api/src/cache/cache.service.spec.ts` → FAIL.

- [ ] **Step 3: Implement** — `apps/api/src/cache/cache.service.ts`:

```ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { type CacheNamespace, cachePrefix } from './cache.keys';
import { CACHE_STORE, type CacheStore } from './cache-store';

export interface CacheOptions {
  enabled: boolean;
  defaultTtlSeconds: number;
}

/** DI token carrying the resolved {@link CacheOptions}. */
export const CACHE_OPTIONS = Symbol('CACHE_OPTIONS');

/**
 * Read-through cache over a {@link CacheStore}. The cache is an optimization,
 * never a dependency: any store error is logged and the call falls through to
 * the source, so a Redis outage degrades to (correct, slower) direct reads.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger('CacheService');

  constructor(
    @Inject(CACHE_STORE) private readonly store: CacheStore,
    @Inject(CACHE_OPTIONS) private readonly options: CacheOptions,
  ) {}

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    if (!this.options.enabled) return factory();

    try {
      const cached = await this.store.get(key);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.warn(`Cache read failed for "${key}"; serving from source`, error as Error);
      return factory();
    }

    const value = await factory();
    try {
      await this.store.set(key, JSON.stringify(value), ttlSeconds ?? this.options.defaultTtlSeconds);
    } catch (error) {
      this.logger.warn(`Cache write failed for "${key}"`, error as Error);
    }
    return value;
  }

  async invalidate(ns: CacheNamespace): Promise<void> {
    try {
      await this.store.delByPrefix(cachePrefix(ns));
    } catch (error) {
      this.logger.warn(`Cache invalidation failed for "${ns}"`, error as Error);
    }
  }
}
```

> Note: tests construct `new CacheService(store, opts)` positionally — Nest's DI uses the `@Inject` tokens at runtime. The two are compatible because `@Inject` decorators do not change the constructor's positional parameter list.

- [ ] **Step 4: Run to verify pass** — `pnpm vitest run apps/api/src/cache/cache.service.spec.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/cache/cache.service.ts apps/api/src/cache/cache.service.spec.ts
git commit -m "feat(api): read-through CacheService with fault isolation"
```

---

### Task 5: New invalidation action events in the hook catalogue

**Files:**
- Modify: `apps/api/src/plugins/hooks.ts`

**Interfaces:**
- Produces: `ActionMap` gains `content.changed`, `settings.theme.changed`, `menu.changed`, `seo.changed`.

- [ ] **Step 1: Implement** — extend `ActionMap` in `apps/api/src/plugins/hooks.ts` (after `contact.submitted`):

```ts
  /**
   * Fired after any write to a post or page (create/update/delete/restore/
   * publish/translation). The caching layer flushes the matching content
   * namespace. `slug` is best-effort (absent on delete-by-id paths).
   */
  'content.changed': { type: 'post' | 'page'; id: string; slug?: string };
  /** Fired after the active theme changes. Flushes the settings cache. */
  'settings.theme.changed': Record<string, never>;
  /** Fired after any menu/item/structure/translation write. Flushes the menu cache. */
  'menu.changed': { location?: string };
  /** Fired after any SEO profile/service/FAQ write. Flushes the SEO cache. */
  'seo.changed': Record<string, never>;
```

- [ ] **Step 2: Run to verify** — `pnpm vitest run apps/api/src/plugins/hook-registry.spec.ts` → PASS (existing tests still green; the map is structurally typed).
- [ ] **Step 3: Typecheck** — `pnpm typecheck` → clean.
- [ ] **Step 4: Commit**

```bash
git add apps/api/src/plugins/hooks.ts
git commit -m "feat(api): add cache-invalidation action events to the hook catalogue"
```

---

### Task 6: `CacheInvalidationListener` + `CacheModule`

**Files:**
- Create: `apps/api/src/cache/cache-invalidation.listener.ts`
- Create: `apps/api/src/cache/cache.module.ts`
- Test: `apps/api/src/cache/cache-invalidation.listener.spec.ts`

**Interfaces:**
- Consumes: `CacheService` (Task 4), `HookRegistry` (existing), `CACHE_NS` (Task 2), `ActionMap` events (Task 5).
- Produces:
  - `class CacheInvalidationListener implements OnModuleInit` — subscribes the four events to namespace flushes (registered with **no `owner`** → core, always active).
  - `class CacheModule` — provides `CACHE_STORE` (factory on `REDIS_URL`), `CACHE_OPTIONS` (factory reading env directly), `CacheService`, `CacheInvalidationListener`; imports `PluginsModule`; **exports `CacheService`**.

- [ ] **Step 1: Write the failing test** — `apps/api/src/cache/cache-invalidation.listener.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { HookRegistry } from '../plugins/hook-registry';
import { CACHE_NS } from './cache.keys';
import { CacheInvalidationListener } from './cache-invalidation.listener';
import type { CacheService } from './cache.service';

function setup() {
  const cache = { invalidate: vi.fn().mockResolvedValue(undefined) } as unknown as CacheService;
  const hooks = new HookRegistry();
  new CacheInvalidationListener(hooks, cache).onModuleInit();
  return { cache, hooks };
}

describe('CacheInvalidationListener', () => {
  it('flushes the content posts namespace on a post change', async () => {
    const { cache, hooks } = setup();
    await hooks.emit('content.changed', { type: 'post', id: '1' });
    expect(cache.invalidate).toHaveBeenCalledWith(CACHE_NS.POSTS);
  });

  it('flushes the content pages namespace on a page change', async () => {
    const { cache, hooks } = setup();
    await hooks.emit('content.changed', { type: 'page', id: '1' });
    expect(cache.invalidate).toHaveBeenCalledWith(CACHE_NS.PAGES);
  });

  it('flushes settings, menus and seo on their events', async () => {
    const { cache, hooks } = setup();
    await hooks.emit('settings.theme.changed', {});
    await hooks.emit('menu.changed', {});
    await hooks.emit('seo.changed', {});
    expect(cache.invalidate).toHaveBeenCalledWith(CACHE_NS.SETTINGS);
    expect(cache.invalidate).toHaveBeenCalledWith(CACHE_NS.MENUS);
    expect(cache.invalidate).toHaveBeenCalledWith(CACHE_NS.SEO);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run apps/api/src/cache/cache-invalidation.listener.spec.ts` → FAIL.

- [ ] **Step 3: Implement listener** — `apps/api/src/cache/cache-invalidation.listener.ts`:

```ts
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { HookRegistry } from '../plugins/hook-registry';
import { CACHE_NS } from './cache.keys';
import { CacheService } from './cache.service';

/**
 * Core (un-owned) hook subscriber: maps content/settings/menu/seo change events
 * to a namespace flush. Registered without an `owner`, so the plugin enabled-gate
 * never disables cache invalidation.
 */
@Injectable()
export class CacheInvalidationListener implements OnModuleInit {
  constructor(
    private readonly hooks: HookRegistry,
    private readonly cache: CacheService,
  ) {}

  onModuleInit(): void {
    this.hooks.addAction('content.changed', (p) =>
      this.cache.invalidate(p.type === 'post' ? CACHE_NS.POSTS : CACHE_NS.PAGES),
    );
    this.hooks.addAction('settings.theme.changed', () => this.cache.invalidate(CACHE_NS.SETTINGS));
    this.hooks.addAction('menu.changed', () => this.cache.invalidate(CACHE_NS.MENUS));
    this.hooks.addAction('seo.changed', () => this.cache.invalidate(CACHE_NS.SEO));
  }
}
```

- [ ] **Step 4: Implement module** — `apps/api/src/cache/cache.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PluginsModule } from '../plugins/plugins.module';
import { CACHE_STORE } from './cache-store';
import { CACHE_OPTIONS, CacheService } from './cache.service';
import { CacheInvalidationListener } from './cache-invalidation.listener';
import { MemoryCacheStore } from './memory-cache-store';
import { RedisCacheStore } from './redis-cache-store';

/**
 * Wires the cache backend (Redis when REDIS_URL is set, else in-process memory)
 * and the invalidation listener. Env is read directly here (not via parseEnv) so
 * unit tests of the cache classes stay default-safe.
 */
@Module({
  imports: [PluginsModule],
  providers: [
    {
      provide: CACHE_STORE,
      useFactory: () => {
        const url = process.env.REDIS_URL;
        if (!url) return new MemoryCacheStore();
        // Lazy require keeps ioredis out of the unit-test import graph.
        const Redis = require('ioredis');
        return new RedisCacheStore(new Redis(url));
      },
    },
    {
      provide: CACHE_OPTIONS,
      useFactory: () => ({
        enabled: process.env.CACHE_ENABLED !== 'false',
        defaultTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 300),
      }),
    },
    CacheService,
    CacheInvalidationListener,
  ],
  exports: [CacheService],
})
export class CacheModule {}
```

> `require('ioredis')` is used (not a top import) so the unit suite never loads ioredis. Biome may flag `require` — if so, add an inline `// biome-ignore lint/style/noCommonJsImports: lazy backend load` (check the actual rule name from the lint error) or use `import('ioredis')` made synchronous via a small factory; prefer the `require` + ignore since `apps/api` is CommonJS.

- [ ] **Step 5: Run to verify pass** — `pnpm vitest run apps/api/src/cache/cache-invalidation.listener.spec.ts` → PASS.
- [ ] **Step 6: Typecheck + lint** — `pnpm typecheck` && `pnpm lint` → clean (resolve any ioredis/require lint as noted).
- [ ] **Step 7: Commit**

```bash
git add apps/api/src/cache/cache-invalidation.listener.ts apps/api/src/cache/cache.module.ts apps/api/src/cache/cache-invalidation.listener.spec.ts
git commit -m "feat(api): cache module wiring + event-driven invalidation listener"
```

---

### Task 7: Cache settings reads + emit on theme change

**Files:**
- Modify: `apps/api/src/settings/settings.service.ts`
- Modify: `apps/api/src/settings/settings.module.ts`
- Test: `apps/api/src/settings/settings.service.spec.ts`

**Interfaces:**
- Consumes: `CacheService.getOrSet`, `cacheKey`, `CACHE_NS`, `HookRegistry.emit('settings.theme.changed')`.

- [ ] **Step 1: Update the failing test** — replace `makeService` in `apps/api/src/settings/settings.service.spec.ts` so it injects fakes, and add two cases:

```ts
import { ACTIVE_THEME_KEY } from '@cmstack-ts/config';
import type { Setting, SettingRepository } from '@cmstack-ts/db';
import { describe, expect, it, vi } from 'vitest';
import type { CacheService } from '../cache/cache.service';
import type { HookRegistry } from '../plugins/hook-registry';
import { DEFAULT_ACTIVE_THEME, SettingsService } from './settings.service';

function makeService(get: Setting | null) {
  const repo: SettingRepository = {
    get: vi.fn().mockResolvedValue(get),
    upsert: vi.fn(async (key: string, value: string) => ({ key, value }) as Setting),
  };
  const cache = {
    getOrSet: vi.fn((_key: string, factory: () => Promise<unknown>) => factory()),
    invalidate: vi.fn(),
  } as unknown as CacheService;
  const hooks = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as HookRegistry;
  return { service: new SettingsService(repo, cache, hooks), repo, cache, hooks };
}
```

Keep the three existing assertions (they call `factory()` through the fake, so they still pass), and add:

```ts
  it('emits settings.theme.changed after a theme update', async () => {
    const { service, hooks } = makeService(null);
    await service.setActiveTheme({ activeTheme: 'editorial' });
    expect(hooks.emit).toHaveBeenCalledWith('settings.theme.changed', {});
  });

  it('reads the active theme through the cache', async () => {
    const { service, cache } = makeService({ key: ACTIVE_THEME_KEY, value: 'magazine' } as Setting);
    await service.getActiveTheme();
    expect(cache.getOrSet).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run apps/api/src/settings/settings.service.spec.ts` → FAIL (constructor arity).

- [ ] **Step 3: Implement** — update `apps/api/src/settings/settings.service.ts`:

```ts
import {
  ACTIVE_THEME_KEY,
  type ThemeSetting,
  type UpdateThemeSettingInput,
} from '@cmstack-ts/config';
import { SETTING_REPOSITORY, type SettingRepository } from '@cmstack-ts/db';
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_NS, cacheKey } from '../cache/cache.keys';
import { CacheService } from '../cache/cache.service';
import { HookRegistry } from '../plugins/hook-registry';

export const DEFAULT_ACTIVE_THEME = 'editorial';

@Injectable()
export class SettingsService {
  constructor(
    @Inject(SETTING_REPOSITORY) private readonly settings: SettingRepository,
    private readonly cache: CacheService,
    private readonly hooks: HookRegistry,
  ) {}

  async getActiveTheme(): Promise<ThemeSetting> {
    return this.cache.getOrSet(cacheKey(CACHE_NS.SETTINGS, 'theme'), async () => {
      const row = await this.settings.get(ACTIVE_THEME_KEY);
      return { activeTheme: row?.value ?? DEFAULT_ACTIVE_THEME };
    });
  }

  async setActiveTheme(input: UpdateThemeSettingInput): Promise<ThemeSetting> {
    const row = await this.settings.upsert(ACTIVE_THEME_KEY, input.activeTheme);
    await this.hooks.emit('settings.theme.changed', {});
    return { activeTheme: row.value };
  }
}
```

- [ ] **Step 4: Wire the module** — `apps/api/src/settings/settings.module.ts`: add imports `CacheModule` (`../cache/cache.module`) and `PluginsModule` (`../plugins/plugins.module`):

```ts
import { CacheModule } from '../cache/cache.module';
import { PluginsModule } from '../plugins/plugins.module';
// ...
  imports: [AccountsModule, CacheModule, PluginsModule],
```

- [ ] **Step 5: Run to verify pass** — `pnpm vitest run apps/api/src/settings/settings.service.spec.ts` → PASS. Then `pnpm typecheck`.
- [ ] **Step 6: Commit**

```bash
git add apps/api/src/settings/settings.service.ts apps/api/src/settings/settings.module.ts apps/api/src/settings/settings.service.spec.ts
git commit -m "feat(api): cache active-theme reads, invalidate on theme change"
```

---

### Task 8: Cache SEO public read + emit on SEO writes

**Files:**
- Modify: `apps/api/src/seo/seo.service.ts`
- Modify: `apps/api/src/seo/seo.module.ts`
- Test: `apps/api/src/seo/seo.service.spec.ts`

**Interfaces:**
- Consumes: `CacheService`, `HookRegistry.emit('seo.changed')`, `CACHE_NS.SEO`, `cacheKey`.

- [ ] **Step 1: Update the test** — in `apps/api/src/seo/seo.service.spec.ts`, extend the service factory to pass a fake `CacheService` (`getOrSet` calls the factory) + fake `HookRegistry`, then add:

```ts
  it('reads public content through the cache', async () => {
    // ...build service with fakes...
    await service.getPublicContent();
    expect(cache.getOrSet).toHaveBeenCalled();
  });

  it('emits seo.changed after a profile update', async () => {
    await service.updateProfile(/* existing valid input from the spec */);
    expect(hooks.emit).toHaveBeenCalledWith('seo.changed', {});
  });
```

(Match the existing spec's construction helper; add the two new constructor args in the same place the repos are passed.)

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run apps/api/src/seo/seo.service.spec.ts` → FAIL (arity).

- [ ] **Step 3: Implement** — in `apps/api/src/seo/seo.service.ts`:
  - Add constructor params (after the three repos): `private readonly cache: CacheService, private readonly hooks: HookRegistry` (import `CacheService`, `HookRegistry`, `CACHE_NS`, `cacheKey`).
  - Wrap `getPublicContent`:

```ts
  async getPublicContent(): Promise<SeoContent> {
    return this.cache.getOrSet(cacheKey(CACHE_NS.SEO, 'public'), async () => {
      // ...existing body...
    });
  }
```

  - After the write in **each** mutating method (`updateProfile`, `createService`, `updateService`, `removeService`, `createFaq`, `updateFaq`, `removeFaq`), add `await this.hooks.emit('seo.changed', {});` just before returning (for `remove*` which return void, emit before the implicit return).

- [ ] **Step 4: Wire the module** — `apps/api/src/seo/seo.module.ts`: add `CacheModule` + `PluginsModule` to `imports`.
- [ ] **Step 5: Run to verify pass** — `pnpm vitest run apps/api/src/seo/seo.service.spec.ts` → PASS. `pnpm typecheck`.
- [ ] **Step 6: Commit**

```bash
git add apps/api/src/seo/seo.service.ts apps/api/src/seo/seo.module.ts apps/api/src/seo/seo.service.spec.ts
git commit -m "feat(api): cache public SEO content, invalidate on SEO writes"
```

---

### Task 9: Cache public post/page reads + emit `content.changed`

**Files:**
- Modify: `apps/api/src/content/posts.service.ts`
- Modify: `apps/api/src/content/pages.service.ts`
- Modify: `apps/api/src/content/content.module.ts`
- Test: `apps/api/src/content/posts.service.spec.ts`, `apps/api/src/content/pages.service.spec.ts`

**Interfaces:**
- Consumes: `CacheService`, `HookRegistry.emit('content.changed')`, `CACHE_NS.POSTS`/`CACHE_NS.PAGES`, `cacheKey`.
- Note: PostsService already injects `HookRegistry` (for `post.published`/filters). Add only `CacheService`.

- [ ] **Step 1: Update posts test** — in `apps/api/src/content/posts.service.spec.ts`, add a fake `CacheService` to the constructor (find where `hooks` is built) where `getOrSet` calls the factory:

```ts
const cache = {
  getOrSet: vi.fn((_k: string, factory: () => Promise<unknown>) => factory()),
  invalidate: vi.fn(),
} as unknown as CacheService;
// new PostsService(postsRepo, revisionRepo, sanitizer, hooks, cache)
```

Add assertions:

```ts
  it('caches the public list read', async () => {
    await service.list({ page: 1, perPage: 10 } as PostListQuery, { publicOnly: true });
    expect(cache.getOrSet).toHaveBeenCalled();
  });

  it('does NOT cache the admin list read', async () => {
    await service.list({ page: 1, perPage: 10 } as PostListQuery, { publicOnly: false });
    expect(cache.getOrSet).not.toHaveBeenCalled();
  });

  it('emits content.changed after creating a post', async () => {
    await service.create({ title: 'X' } as CreatePostInput, 'author-1');
    expect(hooks.emit).toHaveBeenCalledWith('content.changed', expect.objectContaining({ type: 'post' }));
  });
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run apps/api/src/content/posts.service.spec.ts` → FAIL.

- [ ] **Step 3: Implement posts** — `apps/api/src/content/posts.service.ts`:
  - Imports: `import { CACHE_NS, cacheKey } from '../cache/cache.keys';` + `import { CacheService } from '../cache/cache.service';`
  - Constructor: add `private readonly cache: CacheService,` as the **last** param.
  - Refactor `list` so the public path is cached:

```ts
  async list(
    query: PostListQuery,
    opts: { publicOnly: boolean },
    locale: string = DEFAULT_LOCALE,
  ): Promise<PostList> {
    if (!opts.publicOnly) return this.computeList(query, opts, locale);
    const disc = `list:${locale}:${JSON.stringify(query)}`;
    return this.cache.getOrSet(cacheKey(CACHE_NS.POSTS, disc), () =>
      this.computeList(query, opts, locale),
    );
  }

  private async computeList(
    query: PostListQuery,
    opts: { publicOnly: boolean },
    locale: string,
  ): Promise<PostList> {
    // ...the current body of list()...
  }
```

  - Wrap `findPublicBySlug` so the **pre-filter** detail is cached, filters applied after:

```ts
  async findPublicBySlug(slug: string, locale: string = DEFAULT_LOCALE): Promise<PostDetail> {
    const detail = await this.cache.getOrSet(
      cacheKey(CACHE_NS.POSTS, `detail:${slug}:${locale}`),
      async () => {
        const post = await this.posts.findPublicBySlug(slug, this.translationLocale(locale));
        if (!post) throw new NotFoundException('Post not found.');
        return this.toDetail(this.localize(post), []);
      },
    );
    return this.hooks.applyFilters('public.post.render', detail);
  }
```

  - Emit `content.changed` after each successful write. In `create`/`update` add after the existing logic (using `post.id`/`post.slug`); in `softDelete`/`restore`/`destroy`/`upsertTranslation`/`deleteTranslation` add `await this.hooks.emit('content.changed', { type: 'post', id });` after the repo write. Example for `create` (just before `return this.toDetail(...)`):

```ts
      await this.hooks.emit('content.changed', { type: 'post', id: post.id, slug: post.slug });
```

  For `restore`, emit with the restored `post.id`/`post.slug`; for `softDelete`/`destroy` emit `{ type: 'post', id }`.

- [ ] **Step 4: Implement pages** — `apps/api/src/content/pages.service.ts`:
  - Imports: add `CacheService`, `HookRegistry`, `CACHE_NS`, `cacheKey`.
  - Constructor: add `private readonly hooks: HookRegistry,` and `private readonly cache: CacheService,` (pages service does not currently inject hooks).
  - Wrap `findPublicBySlug`:

```ts
  async findPublicBySlug(slug: string, locale: string = DEFAULT_LOCALE): Promise<PageDetail> {
    return this.cache.getOrSet(cacheKey(CACHE_NS.PAGES, `detail:${slug}:${locale}`), async () => {
      const page = await this.pages.findPublicBySlug(slug, this.translationLocale(locale));
      if (!page) throw new NotFoundException('Page not found.');
      // ...existing localize + toDetail...
    });
  }
```

  - Emit `content.changed` with `{ type: 'page', id }` after each write method (create/update/softDelete/restore/destroy/translation upsert+delete), mirroring posts.

- [ ] **Step 5: Wire the module** — `apps/api/src/content/content.module.ts`: add `CacheModule` to `imports` (PluginsModule is already imported for the hooks).

- [ ] **Step 6: Update pages test** — mirror the posts test changes (fake `CacheService` + fake/real `HookRegistry`, assert cache on public read + `content.changed` emit with `type: 'page'`).

- [ ] **Step 7: Run to verify pass** — `pnpm vitest run apps/api/src/content/posts.service.spec.ts apps/api/src/content/pages.service.spec.ts` → PASS. `pnpm typecheck`.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/content/posts.service.ts apps/api/src/content/pages.service.ts apps/api/src/content/content.module.ts apps/api/src/content/posts.service.spec.ts apps/api/src/content/pages.service.spec.ts
git commit -m "feat(api): cache public post/page reads, invalidate on content writes"
```

---

### Task 10: Cache public menu read + emit `menu.changed`

**Files:**
- Modify: `apps/api/src/menus/menu.service.ts`
- Modify: `apps/api/src/menus/menus.module.ts`
- Test: `apps/api/src/menus/menu.service.spec.ts`

**Interfaces:**
- Consumes: `CacheService`, `HookRegistry.emit('menu.changed')`, `CACHE_NS.MENUS`, `cacheKey`.

- [ ] **Step 1: Update the test** — add a fake `CacheService` + fake `HookRegistry` to the service construction; assert `getPublicMenu` reads through the cache and a representative write (`createMenu` or `applyStructure`) emits `menu.changed`:

```ts
  it('reads the public menu through the cache', async () => {
    await service.getPublicMenu('primary', 'en');
    expect(cache.getOrSet).toHaveBeenCalled();
  });

  it('emits menu.changed after applyStructure', async () => {
    await service.applyStructure(/* existing valid args */);
    expect(hooks.emit).toHaveBeenCalledWith('menu.changed', expect.any(Object));
  });
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run apps/api/src/menus/menu.service.spec.ts` → FAIL (arity).

- [ ] **Step 3: Implement** — `apps/api/src/menus/menu.service.ts`:
  - Imports: add `CacheService`, `HookRegistry`, `CACHE_NS`, `cacheKey`.
  - Constructor: append `private readonly cache: CacheService,` and `private readonly hooks: HookRegistry,`.
  - Wrap `getPublicMenu`:

```ts
  async getPublicMenu(location: string, locale: string): Promise<PublicMenu> {
    return this.cache.getOrSet(cacheKey(CACHE_NS.MENUS, `${location}:${locale}`), async () => {
      // ...existing body...
    });
  }
```

  - After **each** mutating method (`createMenu`, `updateMenu`, `deleteMenu`, `createItem`, `updateItem`, `deleteItem`, `applyStructure`, `upsertTranslation`, `deleteTranslation`), add `await this.hooks.emit('menu.changed', {});` before returning. (Whole-namespace flush, so the precise location is not required in the payload.)

- [ ] **Step 4: Wire the module** — `apps/api/src/menus/menus.module.ts`: add `CacheModule` + `PluginsModule` to `imports`.
- [ ] **Step 5: Run to verify pass** — `pnpm vitest run apps/api/src/menus/menu.service.spec.ts` → PASS. `pnpm typecheck`.
- [ ] **Step 6: Commit**

```bash
git add apps/api/src/menus/menu.service.ts apps/api/src/menus/menus.module.ts apps/api/src/menus/menu.service.spec.ts
git commit -m "feat(api): cache public menu reads, invalidate on menu writes"
```

---

### Task 11: Infra — env docs + docker compose redis

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`

- [ ] **Step 1: Document env** — add to `.env.example` (near the other API vars):

```bash
# Caching layer (§7 #10). Optional: leave REDIS_URL unset to use an in-process
# memory cache (single worker only). Set it for a shared, multi-worker cache.
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=300
CACHE_ENABLED=true
```

- [ ] **Step 2: Add redis to dev compose** — `docker-compose.yml`, a new service alongside `db`:

```yaml
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    command: ['redis-server', '--save', '', '--appendonly', 'no']
```

(Match the existing indentation/quoting style in the file; redis is ephemeral, no volume.)

- [ ] **Step 3: Add redis to prod compose** — `docker-compose.prod.yml`: add the same `redis` service **without** published `ports` (use the internal network like db/api), and add `REDIS_URL=redis://redis:6379` to the api service environment. Add `redis` to the api service `depends_on`.

- [ ] **Step 4: Verify compose parses** — `docker compose -f docker-compose.yml config >/dev/null && docker compose -f docker-compose.prod.yml config >/dev/null` → no error.
- [ ] **Step 5: Commit**

```bash
git add .env.example docker-compose.yml docker-compose.prod.yml
git commit -m "chore: document REDIS_URL and add redis service to compose"
```

---

### Task 12: Full gates, live verification, e2e, HANDOFF, plan close-out

**Files:**
- Modify: `cmstack-ts/HANDOFF.md`, `REFACTOR_PLAN.md` (tick §7 #10)

- [ ] **Step 1: Full unit gates** — from `cmstack-ts/`:

```bash
pnpm test          # expect ~445+ tests green (432 baseline + new cache tests)
pnpm typecheck     # clean
pnpm lint          # clean
pnpm vitest run --coverage   # exit 0, lines ≥80%
```

- [ ] **Step 2: Live verification (memory store)** — bring the stack up per the HANDOFF recipe (docker `db` up, migrate deploy, seed, build with NEXT_PUBLIC_*, run api+web). With `REDIS_URL` **unset**:
  - `curl -s 127.0.0.1:4000/public/settings/theme` twice; confirm the API log shows the memory-cache banner at boot and the second read is served without a DB hit (enable a temporary debug log if needed, then remove).
  - Change the theme via `PUT /settings/theme` (admin token) → `curl` `/public/settings/theme` again → reflects the new value (invalidation works).

- [ ] **Step 3: Live verification (Redis)** — `docker compose up -d redis`, export `REDIS_URL=redis://localhost:6379`, restart the API. Repeat: read `/public/posts` twice (second from cache), publish/update a post via the admin API, confirm the next `/public/posts` reflects the change. Optionally `redis-cli KEYS 'cms:*'` to see populated keys and that they clear after a write.

- [ ] **Step 4: E2E** — `pnpm e2e` → 11/11 (install `chromium-headless-shell` build 1148 first if it errors, per HANDOFF gotcha).

- [ ] **Step 5: Adversarial self-review (inline, do NOT spawn parallel agents)** — check: cache never swallows a real `NotFoundException` (it propagates out of the factory — verify nothing is cached for a miss); no secret/`authorEmail` in any key/value; post-detail filters still run on cache hits (toggle a plugin and confirm); invalidation flushes the right namespace; `CACHE_ENABLED=false` fully bypasses. Fix any finding with a regression test.

- [ ] **Step 6: Update docs** — tick `REFACTOR_PLAN.md` §7 #10; add the §7 #10 entry to `HANDOFF.md` (tests count, coverage, live-verify notes, scoped-out list) and refresh the continuation prompt's "next item" to the shared net-new.

- [ ] **Step 7: Final commit**

```bash
git add cmstack-ts/HANDOFF.md REFACTOR_PLAN.md docs/superpowers
git commit -m "docs: tick §7 #10 caching layer, refresh handoff"
```

---

## Notes for the implementer

- `apps/api` is **CommonJS** — `require('ioredis')` inside the factory is correct and keeps ioredis out of the Vitest import graph.
- Vitest resolves `@cmstack-ts/{config,db}` from `src` (no build needed for tests); `pnpm typecheck` builds packages to `dist` first.
- The cache classes are framework-light: unit tests construct them with `new` and fakes — no Nest TestingModule needed.
- Whole-namespace invalidation is intentional (a new/removed item changes lists + detail) — correctness over surgical key-level deletes.
