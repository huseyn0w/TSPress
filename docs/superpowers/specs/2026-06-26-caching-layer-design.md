# §7 #10 — Caching layer (Redis + page/fragment cache, invalidate via HookRegistry) — Design

**Date:** 2026-06-26 · **Status:** approved · **Feature register:** `REFACTOR_PLAN.md` §7 #10

## Goal

Add a shared, Redis-capable cache for the hot **public read** paths, with event-driven
invalidation wired to the existing `HookRegistry`. Mirrors the canon matrix §17: cache
settings + hot reads and invalidate on write; cache public pages/fragments and invalidate on
publish; a Redis-capable backend for multi-worker correctness.

## Context (in place)

- Pluggable-adapter pattern already used three times: `StorageDriver`/`STORAGE`,
  `MailTransport`, `ImageProcessor`/`IMAGE_PROCESSOR` — each a DI-token interface with a real
  impl + a degraded fallback when its env var is unset (e.g. SMTP unset → logging no-op).
- Observer policy (§2.7): a service emits a `HookRegistry` action **only on a real side
  effect**; cache invalidation is exactly such a consumer. Today only `post.published` and
  `contact.submitted` are emitted; `applyFilters('public.post.render')` runs on post detail.
- **Core** (un-owned) hook listeners always run regardless of the plugin enabled-gate
  (`HookRegistry.addAction(name, handler)` with no `owner`). The cache invalidators are core.
- Public reads live behind `@Controller('public/...')` thin controllers → services → repos.
- Env is validated in `packages/config` `envSchema`/`parseEnv`; hot-path numeric caps (e.g.
  `MEDIA_MAX_MEGAPIXELS`) are also read **directly** from `process.env` in the module so unit
  tests stay default-safe without a full `parseEnv()` (which throws on missing secrets).

## Decisions

- **Adapter:** `cache` NestJS module exposing `CacheService`, backed by a pluggable
  `CacheStore` (token `CACHE_STORE`). Two impls bound by a factory on `REDIS_URL`:
  - `RedisCacheStore` — `ioredis` (new dep in `apps/api`). Prefix invalidation via non-blocking
    `SCAN` (MATCH `prefix*`, COUNT batches) + `DEL`, never `KEYS`.
  - `MemoryCacheStore` — default when `REDIS_URL` is unset. `Map<key, {value, expiresAt}>`,
    lazy-expiry on read + `delByPrefix` by key iteration. Single-process (logs a one-line
    multi-worker caveat at boot). Chosen over a pure no-op so the cache is **demonstrable and
    unit-testable without a Redis server**, exactly like the logging mail transport.
- **`CacheService.getOrSet<T>(key, ttlSeconds, factory)`:** hit → `JSON.parse`; miss → run
  `factory`, `JSON.stringify` + `set`, return. **Fault-isolation is mandatory:** any store
  error (Redis down, parse failure) is caught + logged and the call **falls through to
  `factory`** (and skips writing) — a read must never fail because the cache is unavailable.
  When `CACHE_ENABLED=false`, `getOrSet` is a pure passthrough (always calls `factory`).
- **Key shape:** `cms:<ns>:<discriminator>` — namespace prefix enables `delByPrefix`. Locale
  and query params are part of the discriminator (e.g. `cms:content:posts:detail:<slug>:<locale>`).
- **What is cached** (hot public reads): `settings/theme` (ns `settings`), `public/seo`
  (ns `seo`), `public/posts` list + `public/posts/:slug` detail (ns `content:posts`),
  `public/pages/:slug` (ns `content:pages`), `public/menus/:location` (ns `menus`).
- **Not cached:** search (huge query space, FTS), comments + likes (volatile), authors,
  contact (POST). Logged as out-of-scope, not silent.
- **Post detail + filters:** cache the **pre-filter** localized detail inside the service;
  `applyFilters('public.post.render', detail)` runs **after** the cache read so runtime
  plugin toggles are never frozen into the cache.
- **Invalidation (observer, §2.7):** new core action events; the cache module subscribes in
  `onModuleInit` (no `owner` → always active):
  | Event | Emitted by | Flushes |
  | --- | --- | --- |
  | `content.changed {type:'post'\|'page', id, slug}` | Posts/PagesService on create/update/delete/restore/publish + translation upsert/delete | ns `content:posts` or `content:pages` |
  | `settings.theme.changed {}` | SettingsService on theme PUT | ns `settings` |
  | `menu.changed {location}` | MenuService on menu/item/structure/translation write | ns `menus` |
  | `seo.changed {}` | SeoService on profile/service/faq write | ns `seo` |
  Emit is decoupled through `HookRegistry`, so the write services keep no direct dependency on
  the cache module. Listeners flush the whole namespace (a new/removed item invalidates lists,
  not just one key) — correctness over surgical precision.
- **Config:** `REDIS_URL` (optional), `CACHE_TTL_SECONDS` (default 300), `CACHE_ENABLED`
  (default `true`). Added to `envSchema` for documentation/validation **and** read directly in
  the cache module factory so unit tests stay default-safe.
- **Infra:** add a `redis` service to `docker-compose.yml` (dev) and `docker-compose.prod.yml`;
  document `REDIS_URL` in `.env.example`. Web is unchanged (Next keeps its own `revalidatePath`).

## Module wiring

`CacheModule` provides `{ provide: CACHE_STORE, useFactory: () => REDIS_URL ? new RedisCacheStore(...) : new MemoryCacheStore() }` + `CacheService` + a `CacheInvalidationListener` (registers the four events against the injected `HookRegistry` in `onModuleInit`). `CacheModule` imports `PluginsModule` (for `HookRegistry`) and `exports` `CacheService`. The read modules (settings, seo, content, menus) import `CacheModule` and inject `CacheService`; their write services inject `HookRegistry` to `emit` the new events. New action names are added to `ActionMap` in `plugins/hooks.ts`.

## Behaviour invariants

- Cache miss must return byte-identical data to the un-cached path (same DTO shape, same
  per-field locale fallback, same `applyFilters` output for post detail).
- A store outage degrades to direct reads (slower, correct) — never an error.
- A write to any cached aggregate is visible on the next read (namespace flush on the event).
- No `authorEmail`/secret ever enters a cache key or value (we cache existing public DTOs only).

## Testing (TDD by layer)

1. `packages/config` env schema: `REDIS_URL`/`CACHE_TTL_SECONDS`/`CACHE_ENABLED` parse + defaults.
2. `MemoryCacheStore`: set/get, TTL expiry, `delByPrefix`, `del`.
3. `CacheService`: hit, miss-then-store, JSON round-trip, **fault-isolation** (store throws →
   factory still runs, no throw, no cache write), `CACHE_ENABLED=false` passthrough.
4. `CacheInvalidationListener`: each emit → `delByPrefix` called with the right namespace.
5. Read services (posts/pages/menu/seo/settings): read goes through a fake `CacheService`
   (`getOrSet` returns the factory result); write services `emit` the right event with payload.
6. Full gates (`pnpm test` / `typecheck` / `lint` / coverage ≥80%); rebuild + `pnpm e2e` 11/11;
   live curl proving a hit (second read served from cache) and invalidation (write → fresh read).

## Out of scope (logged, not silent)

- Caching search/authors/comments/likes; per-namespace TTLs; cache warming/stampede locks
  (single-flight); response-level HTTP caching (Cache-Control); web/Next-side caching beyond the
  existing `revalidatePath`; cache metrics/hit-rate dashboards.
