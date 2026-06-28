# Cmstack-TS

An open-source CMS built entirely in TypeScript — lighter, faster, SEO-first, and easy to
read, understand, and extend. It ships its own admin panel, a swappable theme + plugin
system, multilingual UI + per-locale content, a first-class SEO/GEO layer, RSS/Atom feeds,
a public REST API, and an MCP server so you can manage the site from an AI assistant.

> **Status:** feature-complete core. Accounts, content, media, the custom admin, themes,
> plugins (with runtime enable/disable + render regions), multilingual (en/de/ru UI +
> per-locale post/page content), SEO/GEO (per-content meta, JSON-LD, sitemap, robots,
> `llms.txt`, GA4/GTM + consent, Service pages), comments + moderation, full-text search,
> managed menus, a contact form, password reset + transactional email, auto image
> thumbnails, a Redis/in-memory cache layer, revision restore, scheduled publishing,
> RSS/Atom feeds, REST API + MCP — all built and tested. The NestJS API is layered
> `controller → service → repository` with a ≥80% coverage gate; CI runs Biome + tsc +
> Vitest + a Playwright e2e job. The UI implements the shared design system; Lighthouse is
> measured (Accessibility / SEO 100, Best-Practices 96 on every public page; home
> Performance ≥ 95).

This is the TypeScript implementation in a family of parallel CMS stacks that share two
read-only specs: [`../FEATURE_MATRIX.md`](../FEATURE_MATRIX.md) (capability parity across
stacks) and [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) (the shared visual language). The
reference implementation (Laravel) is [Laravella-CMS](https://github.com/huseyn0w/Laravella-CMS).

## Stack

- TypeScript everywhere, in a **pnpm workspaces** monorepo
- **Next.js** (App Router) — public site + admin UI (`apps/web`, ESM)
- **NestJS** — REST API, one module per bounded concern (`apps/api`, CommonJS)
- **MCP server** — AI management surface (`apps/mcp`, ESM)
- **PostgreSQL via Prisma** (`packages/db`); ORM kept DB-agnostic so MySQL works on shared hosting
- Shared Zod schemas + env validation (`packages/config`)
- Tailwind CSS v4 + a hand-built shadcn-style kit; rich text: **Tiptap**, all HTML sanitized
  server-side (sanitize-html) on every save
- Auth + social login: **Auth.js (NextAuth v5)**; authorization: **CASL** on the API
- Multilingual: **next-intl** (locale routing + per-locale content translation tables)
- Caching: **Redis** (ioredis) with an in-memory fallback · Email: **nodemailer** · Images: **sharp**
- Tests: **Vitest** (unit/integration) + **Playwright** (e2e) · Lint/format: **Biome** · Types: **tsc**
- Local infra: Docker + docker compose · Prod: Node behind **nginx** (Docker or PM2)

## Requirements

- Docker + docker compose (the quick path), **or** Node.js ≥ 22 (`corepack enable` for pnpm) +
  a PostgreSQL you point `DATABASE_URL` at.

## Quick start (Docker)

```bash
cp .env.example .env        # defaults work for a local demo
docker compose up --build   # web :3000, api :4000, postgres :5432
pnpm db:seed                # demo content + the seeded admin user
```

Open <http://localhost:3000> — the public site renders the CMS's own recent posts through
the active theme. Health surfaces: `/health` (SSR API + DB status), `http://localhost:4000/health/ready`
(API readiness JSON). Sign in at `/signin` with the seeded admin:

```
email:    admin@cmstack-ts.local
password: admin12345         # local dev only — set SEED_ADMIN_PASSWORD and change in prod
```

## Local development (without Docker)

```bash
corepack enable
pnpm install
pnpm db:generate                          # generate the Prisma client
# point DATABASE_URL at a local Postgres, then:
pnpm --filter @cmstack-ts/db migrate:dev  # apply migrations
pnpm db:seed                              # optional demo content
pnpm dev                                  # web + api + mcp + package watchers
```

## Architecture

Cmstack-TS is a monorepo of focused apps (one app = one bounded concern). The NestJS API
enforces a strict, one-directional layering so controllers stay thin and business logic
stays testable:

```
controller → service → repository → Prisma client → PostgreSQL
                └── side effects: service → HookRegistry event → listener
```

Two rules hold in every module:

1. **Controllers are the HTTP boundary only.** They validate the request body with a shared
   Zod schema, delegate to a service, and map the result to a response — zero business logic,
   zero data access.
2. **Services never touch Prisma.** Every query lives behind a repository interface in
   `packages/db/src/repositories`, wired into Nest by constructor injection
   (`provideRepository(TOKEN, PrismaImpl)`). Side effects (emails, cache invalidation) are
   emitted as typed domain events on the plugin hook registry and handled by listeners — not
   inlined into the service. This confines the ORM to one layer and lets every service be
   unit-tested against a fake repository (the suite holds a ≥ 80% service/repository coverage gate).

**Design patterns — used only where they remove real duplication, never speculatively:**

- **Repository** — every aggregate's data access (`packages/db/src/repositories/*`): an
  `interface`, a DI `Symbol` token, and a `PrismaXRepository` implementation that returns
  Prisma payloads (repos never catch `P2002`/`P2025` — the service maps those).
- **Service / use-case** — every module's orchestration (`apps/api/src/*/*.service.ts`).
- **Observer** — a typed `HookRegistry` (filters transform values, actions fire events)
  decouples side effects: `contact.submitted` / `comment.submitted` → mail listeners,
  `content.changed` / `menu.changed` / `seo.changed` / `settings.theme.changed` → the cache
  invalidator, `post.published` → plugin listeners.
- **Strategy** — storage swaps local disk ↔ S3 behind a `StorageDriver`; the cache swaps
  Redis ↔ in-memory behind a `CacheStore`; image processing behind an `ImageProcessor`; the
  mail transport swaps SMTP ↔ a logging no-op.
- **Registry** — themes and plugins are runtime registries resolved per render/boot, so
  neither needs a restart to switch (plugins can be enabled/disabled live).

## Project layout

```
apps/
  web/      Next.js App Router — public site (themed) + admin (Server Actions). ESM.
  api/      NestJS REST API — modules: auth, content, media, comments, search, settings,
            themes, plugins, seo, menus, contact, mail, cache, admin, health. CommonJS.
  mcp/      MCP server for AI clients (thin authenticated API client). ESM.
packages/
  config/   Shared Zod schemas: env validation + request/response contracts. CommonJS → dist.
  db/       Prisma schema, client singleton, migrations, seed. CommonJS → dist.
            repositories/  the per-aggregate repository layer (interfaces + tokens + impls)
docs/deployment/   VPS + shared-hosting guides
e2e/               Playwright browser journeys (auth, content, SEO, theme)
nginx/             production reverse-proxy config
```

## Features

**Accounts, roles & permissions.** The API is the identity source of truth (User/Role/
Permission, Argon2id hashing, HS256 JWTs); the web app uses Auth.js v5 as the session/social
layer (credentials + optional Google/GitHub). Authorization is **CASL** on the API —
`(action, subject)` permissions gated by a `PoliciesGuard`. **Password reset** mails a
single-use, hashed, TTL'd token (real SMTP when configured, a logging transport otherwise).
Seeded roles: Administrator, Editor, Member. Public **author pages** (`/authors/<id>`, public
fields only — never email) + a self-service `/account` profile editor.

**Content.** Posts, pages, hierarchical categories, tags, and per-type revisions. Bodies are
sanitized server-side on every write, so stored HTML is safe to render. Soft-delete with
trash/restore; **revision restore** (reuses the update path → reversible + re-sanitized +
cache-invalidating, with a field-level compare panel); **scheduled publishing** (`scheduledAt`
on a draft; a minute-interval worker auto-publishes due drafts). Public, server-rendered reads
return only published content; drafts are hidden.

**Per-locale content.** Post/Page base columns are the canonical English; `PostTranslation`/
`PageTranslation` tables hold de/ru overrides with per-field fallback. Public reads take
`?locale=`; the admin edits overrides through a per-language tab strip below the base form.

**Media.** Authenticated upload API with a swappable storage adapter (local disk now, S3 a
one-line swap). Uploads are size-capped and **type-validated by their actual bytes** (SVG
rejected as an XSS vector); the stored extension is derived from the validated MIME. On upload,
**sharp** generates WebP `thumb`/`medium` derivatives (resize-to-fit, EXIF-rotate, no upscale)
with a decompression-bomb guard. Served at `/uploads/<key>` with `nosniff`.

**Admin panel.** A bespoke editorial admin at `/admin` (Tailwind v4 + a shadcn-style kit +
Tiptap), gated by a `read Admin` capability; user management requires manage-users. **The API
token never reaches the browser** — data fetching and all mutations run server-side (Server
Actions) and the API re-checks CASL on every call. Sidebar + topbar shell with a skip-to-content
link, mono section labels, dark/light toggle, per-locale editing tabs, and canon status badges.

**Themes & plugins.** The public site renders **through a runtime-resolved theme** (the
`activeTheme` API setting is the source of truth); themes are React component sets that recolor
via CSS-variable tokens. Plugins are constrained in-repo modules (a typed `PluginApi`, never the
DB or request) registered through a hook registry — **toggled at runtime** (no restart) and able
to contribute to render regions (e.g. `site.footer`). Administrator screens at
`/admin/appearance` and `/admin/plugins`. Sample `reading-time` + footer-note plugins ship.

**SEO / GEO.** Per-content meta (translatable title/description, canonical, `noindex`),
Open Graph/Twitter, JSON-LD (`Organization`, `WebSite`, `BlogPosting`, `Service`, `FAQPage`),
`sitemap.xml` with hreflang alternates, dynamic `robots.txt`, and `llms.txt`. Admin-editable
**GEO** content (org profile + a "what to recommend us for" statement + Services + FAQ) is
surfaced to answer engines via `llms.txt`, JSON-LD, and a server-rendered `/services` page.
GA4/GTM + named site-verification tags ship behind a basic consent banner. **RSS 2.0**
(`/feed.xml`) + **Atom 1.0** (`/atom.xml`) feeds of recent posts, auto-discoverable site-wide.

**Comments, search, menus & contact.** Threaded, moderated comments (pending by default,
optional reCAPTCHA, rate-limited; a new comment notifies the moderator by email). Public
full-text search over published posts (Postgres FTS). Managed header/footer **menus** with a
keyboard-accessible drag builder, per-locale labels, and polymorphic targets. A throttled,
honeypot-guarded **contact form** that emails a settings-driven recipient.

**Caching.** Hot public reads (settings/theme, SEO, posts list + detail, pages, menus) are
cached behind a pluggable `CacheStore` — Redis when `REDIS_URL` is set, else an in-process
memory map — and invalidated by namespace on the matching `*.changed` domain event. Fault
isolated: a cache miss/error always falls through to the source.

**REST API & MCP.** A public read API (`/public/*`, locale-aware) plus CASL-gated authoring
routes. An **MCP server** (`apps/mcp`) exposes 48 scoped, Zod-validated tools (content, media,
comments, settings, SEO/GEO, users) that call the API with a service-account token, so the
**API re-checks CASL** per call — no filesystem, shell, or code execution.

```bash
# Connect from Claude (CLI):
claude mcp add cmstack-ts \
  --env MCP_API_URL=http://localhost:4000 \
  --env MCP_API_EMAIL=admin@cmstack-ts.local \
  --env MCP_API_PASSWORD=admin12345 \
  -- node /absolute/path/to/cmstack-ts/apps/mcp/dist/index.js
```

## Commands

| Task                  | Command                                                    |
| --------------------- | ---------------------------------------------------------- |
| Dev up (Docker)       | `docker compose up`                                        |
| Dev servers (local)   | `pnpm dev`                                                 |
| Build (topological)   | `pnpm build`                                               |
| Tests                 | `pnpm test` (single: `pnpm vitest run <path> -t "<name>"`) |
| Coverage gate         | `pnpm test:coverage` (service/repository ≥ 80%, enforced)  |
| End-to-end            | `pnpm e2e`                                                 |
| Lint / format / types | `pnpm lint` · `pnpm format` · `pnpm typecheck`             |
| DB                    | `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:seed`    |
| Build & run MCP       | `pnpm --filter @cmstack-ts/mcp build` → `node apps/mcp/dist/index.js` |

## Testing

```bash
pnpm test                       # full Vitest unit/integration suite (Prisma mocked, no DB)
pnpm vitest run --coverage      # with the enforced service/repository coverage gate
```

The unit suite mocks Prisma and needs no database. End-to-end browser journeys (Playwright)
run against a live web server serving the built bundle:

```bash
pnpm exec playwright install chromium
pnpm build && pnpm e2e
```

## Internationalization

The public site is localized with **next-intl** in English (default), German, and Russian,
with an `as-needed` prefix: the default locale keeps clean URLs (`/blog/<slug>`), others are
prefixed (`/de/blog/<slug>`). The theme chrome reads strings from
`apps/web/messages/{en,de,ru}.json`; a locale switcher lives in the nav; dates are localized;
every public page emits per-locale `canonical` + `hreflang` (incl. `x-default`), mirrored in
`sitemap.xml`. **Post/page content** is per-locale through translation tables with per-field
fallback (see Features). The admin stays English. Add a language by extending
`apps/web/i18n/routing.ts` and adding a `messages/<locale>.json`.

## Continuous integration

`.github/workflows/ci.yml` runs on every push/PR: install → generate the Prisma client →
**Biome** (lint + format check) → **tsc** typecheck → **Vitest** unit/integration suite →
topological build → install Chromium → **Playwright** e2e.

## Deployment

Production runs db + api + web behind **nginx** (only nginx is published; app containers stay
on the internal network — the site on the domain, the API on an `api.` subdomain).

```bash
cp .env.example .env   # set AUTH_SECRET, INTERNAL_API_SECRET, PUBLIC_WEB_URL, PUBLIC_API_URL, …
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api pnpm --filter @cmstack-ts/db seed   # first boot
```

The API image runs `prisma migrate deploy` on start, so migrations apply on every deploy.
All config is environment-driven (`.env`, documented in `.env.example`) — never commit secrets;
`NEXT_PUBLIC_*` values are inlined into the web bundle **at build time** (rebuild the web image
when they change). Storage is swappable (local disk or S3); the ORM is kept DB-agnostic so MySQL
works for shared hosting. Full walkthroughs (TLS, `/uploads`, health, backups, and a non-Docker
PM2 path): **[docs/deployment/vps.md](docs/deployment/vps.md)** and
**[docs/deployment/shared-hosting.md](docs/deployment/shared-hosting.md)** (note the PostgreSQL
requirement for full-text search).

## Roadmap & parity

Capability parity with the reference CMS and the sibling stacks is tracked in
[`../FEATURE_MATRIX.md`](../FEATURE_MATRIX.md); the shared visual language is
[`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). The reference implementation (Laravel) is
[Laravella-CMS](https://github.com/huseyn0w/Laravella-CMS).

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
