# Cmstack-TS

A CMS built entirely in TypeScript — lighter, faster, SEO-first, and
easy to read, understand, and extend.

> **Status:** Phases 0–11 are complete — foundation, accounts, content, media, the admin UI,
> a runtime theme system, a typed plugin/hook system, SEO/GEO, comments + full-text search +
> spam protection, the polished public site (author profiles + post likes), an MCP server for
> AI-driven management, and production deployment (Docker + nginx, with a shared-hosting guide).
> The **i18n foundation** (next-intl locale routing + translated UI + hreflang for en/de/ru) has
> also shipped; per-locale content translation is the remaining optional follow-up.

## Stack

| Area             | Choice                                       |
| ---------------- | -------------------------------------------- | --------- | ------ |
| Monorepo         | pnpm workspaces                              |
| Web              | Next.js (App Router) — `apps/web`            |
| API              | NestJS — `apps/api`                          |
| AI connector     | MCP server — `apps/mcp`                      |
| Database         | PostgreSQL via Prisma — `packages/db`        |
| Shared types/env | Zod — `packages/config`                      |
| Auth             | Auth.js (NextAuth v5) + CASL authorization   |
| Validation       | Zod                                          | Rich text | Tiptap |
| Tests            | Vitest (unit/integration) + Playwright (e2e) |
| Lint/format      | Biome                                        |

## Requirements

- Node.js ≥ 22 — `corepack enable` (provides pnpm)
- Docker + Docker Compose (for the one-command dev stack)

## Quick start (Docker — the demo path)

```bash
cp .env.example .env       # adjust if needed
docker compose up --build  # web :3000, api :4000, postgres :5432
pnpm db:seed               # optional: writes a HealthCheck row to prove DB round-trip
```

Then open:

- http://localhost:3000 — the site
- http://localhost:3000/health — system status (renders API + database health, SSR)
- http://localhost:4000/health — API liveness JSON
- http://localhost:4000/health/ready — API readiness (database probe) JSON

## Local development (without Docker)

```bash
corepack enable
pnpm install
pnpm db:generate                       # generate the Prisma client
# start Postgres however you like, then point DATABASE_URL at it in .env
pnpm --filter @cmstack-ts/db migrate:dev  # apply migrations
pnpm dev                               # runs web, api, mcp + package watchers
```

## Authentication & roles (Phase 1)

The **API is the source of truth for identity** (User/Role/Permission, Argon2id password
hashing, HS256 JWTs). The **web app uses Auth.js v5** as the session/social layer: a
Credentials provider calls the API, and the API access token is carried in the Auth.js
session for server-side calls. Authorization is enforced on the API with **CASL** —
permissions are `(action, subject)` pairs; routes are gated with a `PoliciesGuard`.

Seeded roles: **Administrator** (`manage all`), **Editor** (`read Admin`, `manage User`),
**Member** (default for sign-ups, no admin access). After `pnpm db:seed` you can sign in
with the seeded admin:

```
email:    admin@cmstack-ts.local
password: admin12345         # local dev only — set SEED_ADMIN_PASSWORD and change in prod
```

Try it: visit `/signup` to create a Member account → `/account` shows your role; the
seeded admin can reach the role-gated `GET /api/admin/overview`, a Member gets `403`.

**Social login (optional):** set `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` and/or
`AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET` to enable those providers (callback URL
`/<origin>/api/auth/callback/<provider>`). Leave them blank to disable — the buttons
simply won't appear.

## Content (Phase 2)

Posts, pages, categories (hierarchical), and tags, with **revisions**, **soft-delete**,
and draft/publish status. All rich-text HTML is **sanitized server-side** on write
(sanitize-html), so stored content is safe to render. Authoring endpoints are CASL-gated
(the **Editor** role manages all content); public, server-rendered reads return only
published content.

After `pnpm db:seed`, the public blog has sample posts:

- `/blog` — published post index (SSR)
- `/blog/<slug>` — a post (e.g. `/blog/introducing-cmstack-ts`)

Authoring API (Bearer token from login; admin/editor only): `POST/PATCH/DELETE /posts`,
`/pages`, `/categories`, `/tags`; `POST /posts/:id/restore`; `GET /posts/:id/revisions`.
Public read API: `GET /public/posts`, `/public/posts/:slug`, `/public/pages/:slug`.

> The Tiptap editor UI ships with the admin panel (Phase 4); Phase 2 delivers the content
> API, data model, and the sanitization pipeline the editor relies on.

## Media (Phase 3)

Authenticated upload API with a **swappable storage adapter** (local disk now, S3 later).
Uploads are size-capped and **type-validated by their actual bytes** (not just the
client-claimed MIME); allowed types are jpeg/png/gif/webp/pdf (SVG excluded). Image
dimensions are extracted; alt/title/caption are editable per asset. Files are served at
`/uploads/<key>` with `X-Content-Type-Options: nosniff`, and the stored extension is
derived from the validated type so a file can never be served as executable HTML.

Authoring API (admin/editor Bearer token): `POST /media` (multipart `file`),
`GET /media`, `GET /media/:id`, `PATCH /media/:id` (alt/title/caption), `DELETE /media/:id`.

> **Production:** the upload directory is a Docker volume (`uploads`). Behind nginx,
> forward `/uploads/*` to the API process, or serve the volume directly from nginx.

## Admin panel (Phase 4)

A bespoke, editorial admin at **`/admin`** (not a generic template): Tailwind v4 + a
customized shadcn-style component kit, Geist type, a single gold accent, light/dark, and a
Tiptap rich-text editor. Screens: dashboard, posts (list + editor + publish/trash/restore),
pages, categories, tags, media library (upload/edit/delete), and users (role management).

Access is restricted to admins/editors (`read Admin` capability); user management requires
manage-users. Sign in at `/signin` as the seeded admin, then open `/admin`. The browser
never holds the API token — admin data fetching and all mutations run server-side (Server
Actions) with the token kept on the server; the API re-checks permissions on every call.

## Theme system (Phase 5)

The public site renders **through a runtime-resolved theme** rather than hardcoded markup.
The active theme is stored as the `activeTheme` **setting on the API** (the source of truth);
the web app owns the catalogue of themes (they're React component sets). Two themes ship:
**Editorial** (dark, the default) and **Magazine** (light, serif masthead). Switching the
theme re-skins the whole public site (`/`, `/blog`, `/blog/<slug>`) immediately.

- **Switch it:** sign in as an Administrator → **Admin → Appearance** (`/admin/appearance`),
  pick a theme. Only Administrators can switch themes (it's gated by a `Setting` capability).
- **API:** `GET /public/settings/theme` (public, read-only — the server-rendered site reads
  it before any session); `GET`/`PUT /settings/theme` are CASL-gated (admin only). If the API
  is unreachable or the stored value is unknown, the site falls back to the default theme.
- **Add a theme:** drop a folder in `apps/web/themes/<id>/` exporting a `Theme`
  (`Layout` + `Home`/`BlogIndex`/`BlogPost`), then register it in `themes/registry.ts`.

## Plugin system (Phase 6)

Cmstack-TS is extensible through a **typed hook/event registry** on the API — extension points,
not arbitrary code injection. There are two kinds of hooks:

- **Filters** transform a value (e.g. `public.post.render` lets a plugin alter a post just
  before it's returned to the site), running through every handler in priority order.
- **Actions** are fire-and-forget events (e.g. `post.published` fires when a post is published).

Plugins are explicit in-repo modules implementing a small typed contract (`CmstackTsPlugin`);
they receive only a constrained `PluginApi` (`addFilter` / `addAction`) — never the database
or request. The enabled set lives in `apps/api/src/plugins/enabled-plugins.ts`.

A sample **`reading-time`** plugin ships enabled: it injects an estimated "N min read" badge at
the top of every public post (visible on `/blog/<slug>` after `pnpm db:seed`) and logs a line
whenever a post is published. **Add a plugin:** implement `CmstackTsPlugin`, register a handler on
a hook, and add it to `enabled-plugins.ts`.

## SEO & GEO (Phase 7)

Cmstack-TS is **SEO-first and GEO-first** (generative-engine optimization — being found and
recommended by AI assistants):

- **Standard SEO:** `/sitemap.xml`, `/robots.txt`, per-page Open Graph + Twitter metadata,
  canonical URLs, and JSON-LD structured data (`Organization` + `WebSite` on the home page,
  `BlogPosting` on posts).
- **GEO:** an admin-editable content area — a **site/organization profile** (including a freeform
  _"what AI assistants should recommend you for"_ statement), plus **Services** and **FAQ** lists
  (full CRUD). This content is surfaced to assistants three ways: a plain-text **`/llms.txt`**
  feed, **`Service` + `FAQPage` JSON-LD**, and a server-rendered **`/services`** page.

Edit it in **Admin → SEO & GEO** (`/admin/seo`; Administrators and Editors). The canonical base
URL comes from `NEXT_PUBLIC_SITE_URL` (falls back to `AUTH_URL`). After `pnpm db:seed`, open
`/llms.txt` and `/services` to see the demo GEO content. Admin-editable text is escaped before it
reaches JSON-LD, so it can't inject markup.

## Comments, search & spam (Phase 8)

- **Threaded comments** on posts. Anyone can comment (name + email); **every comment is held for
  moderation** and only appears once an editor approves it. Moderate at **Admin → Comments**
  (`/admin/comments`) — approve, mark spam, or delete, filtered by status. After `pnpm db:seed`
  the intro post has a sample thread plus one pending comment to moderate.
- **Full-text search** over published posts (Postgres FTS with relevance ranking) at **`/search`**
  and `GET /public/search?q=`.
- **Spam protection:** reCAPTCHA v3 is **optional** — set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` +
  `RECAPTCHA_SECRET_KEY` to enable it; left blank, comments still work and verification is skipped.
  Sign-in, sign-up, and comment submission are **rate-limited** regardless.

## Public site (Phase 9)

The reader-facing site is the editorial frontend rendered through the active theme, with:

- **Author profiles** at `/authors/<id>` — avatar, an editable bio, and the author's published
  posts. Author bylines on posts link to them. Each user can edit their own **name and bio** on
  the `/account` page (a short bio shows on their public profile).
- **Post likes** — signed-in readers can like a post (one like per person) with a live count;
  visitors who aren't signed in see a prompt to sign in. After `pnpm db:seed`, sign in and open
  any post to try it.

## AI integration / MCP (Phase 10)

Cmstack-TS ships an **MCP server** (`apps/mcp`) so AI clients (Claude CLI, Claude in VS Code,
Claude Desktop) can manage the CMS through tools instead of raw API calls. It is a thin,
**authenticated client of the API**: it logs in with a service account and every tool call
rides that bearer token, so the **API re-checks CASL** on each request. The server's
capabilities are bounded by the account's role. It performs **only data operations through
the REST API** — no filesystem, no shell, no plugin/theme code execution.

- **Tools (48):** posts (list/get/revisions/create/update/publish/unpublish/delete/restore),
  pages (list/get/create/update/delete/restore), categories & tags (list/create/update/delete),
  media (list/get/update-metadata/delete — binary upload is intentionally not exposed),
  comments (list/approve/spam/trash/delete), settings (get/set active theme), SEO/GEO (site
  profile + Services + FAQ CRUD), and users (list/roles/get/update — user deletion is not
  exposed). Inputs are validated with the shared `@cmstack-ts/config` Zod schemas; API 4xx/403
  errors surface as clear tool errors (a 403 explains it's a CASL permission boundary).
- **Required env:** `MCP_API_URL`, `MCP_API_EMAIL`, `MCP_API_PASSWORD` (see `.env.example`).
- **Build & run:** `pnpm --filter @cmstack-ts/mcp build` then `node apps/mcp/dist/index.js`
  (stdio transport; logs go to stderr).

**Connect it to Claude (CLI):**

```bash
claude mcp add cmstack-ts \
  --env MCP_API_URL=http://localhost:4000 \
  --env MCP_API_EMAIL=admin@cmstack-ts.local \
  --env MCP_API_PASSWORD=admin12345 \
  -- node /absolute/path/to/cmstack-ts/apps/mcp/dist/index.js
```

**Connect it from VS Code** — add to `.vscode/mcp.json` (or your user MCP config):

```jsonc
{
  "servers": {
    "cmstack-ts": {
      "command": "node",
      "args": ["/absolute/path/to/cmstack-ts/apps/mcp/dist/index.js"],
      "env": {
        "MCP_API_URL": "http://localhost:4000",
        "MCP_API_EMAIL": "admin@cmstack-ts.local",
        "MCP_API_PASSWORD": "admin12345",
      },
    },
  },
}
```

Then ask the assistant to, e.g., "create a draft post titled … and publish it" — it round-trips
through the API with CASL enforced. Use `cmstack_ts_ping` to confirm the server is reachable.

## Project layout

```
apps/
  web/      Next.js App Router — public site + admin (CommonJS-free, ESM via Next)
  api/      NestJS REST API (CommonJS)
  mcp/      MCP server for AI clients (ESM)
packages/
  config/   Shared Zod schemas: env validation + API contracts (CommonJS → dist)
  db/       Prisma schema, client singleton, migrations, seed (CommonJS → dist)
            repositories/  Per-aggregate repository layer (interfaces + DI tokens + Prisma impls)
```

### Layering (apps/api)

`controller (thin: validate → delegate → map) → service (business logic + domain
events via the plugin hook registry) → repository (all data access)`. Services never
touch Prisma directly: every query lives behind a repository interface in
`packages/db/src/repositories` and is wired into NestJS via constructor injection
(`provideRepository(TOKEN, PrismaImpl)`). This keeps services unit-testable against a
fake repository and confines the ORM to one layer. Run `pnpm test:coverage` for the
service/repository coverage gate (≥80%, enforced).

## Commands

| Command                                       | Description                                     |
| --------------------------------------------- | ----------------------------------------------- |
| `pnpm dev`                                    | Run all apps + package watchers                 |
| `pnpm build`                                  | Build everything (packages → apps, topological) |
| `pnpm test`                                   | Vitest unit/integration tests                   |
| `pnpm test:coverage`                          | Vitest with the service/repository coverage gate |
| `pnpm e2e`                                    | Playwright end-to-end tests                     |
| `pnpm lint` / `pnpm format`                   | Biome check / write                             |
| `pnpm typecheck`                              | Type-check every package                        |
| `pnpm db:generate` / `db:migrate` / `db:seed` | Prisma client / migrations / seed               |

## Internationalization (i18n foundation)

The public site is localized with **next-intl** in **English (default), German, and Russian**.

- **Locale routing** with an `as-needed` prefix: the default locale stays unprefixed (`/blog`)
  while others are prefixed (`/de/blog`, `/ru/blog`), so existing URLs and canonicals are stable.
- **Translated UI**: the theme chrome and public surfaces (home, blog, services, search, author)
  read strings from `apps/web/messages/{en,de,ru}.json`; a **locale switcher** lives in the site
  nav. Dates are formatted per-locale.
- **SEO**: every public page emits per-locale `canonical` + `hreflang` alternates (incl.
  `x-default`), and `sitemap.xml` carries the same alternates.
- **The admin panel stays English** and is outside locale routing. Add a language by adding a
  locale to `apps/web/i18n/routing.ts` and a `messages/<locale>.json` file.

> Scope note: this is the **foundation** — UI chrome is translated; post/page **content** is not
> yet per-locale (translated Prisma fields + an admin translation UI are an optional follow-up).
> The comment form and like button are also not yet localized.

## Deployment

Cmstack-TS is built to deploy cleanly to a VPS or shared hosting.

- **VPS (recommended)** — db + api + web behind **nginx**, via Docker or PM2:

  ```bash
  cp .env.example .env   # set AUTH_SECRET, INTERNAL_API_SECRET, PUBLIC_WEB_URL, PUBLIC_API_URL, …
  docker compose -f docker-compose.prod.yml up -d --build
  docker compose -f docker-compose.prod.yml exec api pnpm --filter @cmstack-ts/db seed   # first boot
  ```

  Only nginx is published on the host; the app containers stay on the internal
  network. The public site is served from your domain and the API from an `api.`
  subdomain. Full walkthrough (TLS, `/uploads`, health checks, migrations on
  deploy, backups, and a non-Docker PM2 path): **[docs/deployment/vps.md](docs/deployment/vps.md)**.

- **Shared hosting (Hostinger / cPanel / Passenger)** — build locally, run the
  API and web as two Passenger Node apps. Note the **PostgreSQL requirement for
  full-text search**. Guide: **[docs/deployment/shared-hosting.md](docs/deployment/shared-hosting.md)**.

> `NEXT_PUBLIC_*` values (the browser-facing API/site URLs) are inlined into the
> web bundle **at build time** — rebuild the web image when they change.

## Roadmap

Small, shippable phases. Each ends with Vitest + Playwright green, Biome clean, a
fresh-context review, observable behavior in the running app, and updated docs.

| Phase              | Name                   | Ships                                                                                                                                                                                                                                                         |
| ------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 ✅               | Foundation             | Monorepo, Docker compose, Prisma + Postgres, Biome, Vitest, Playwright, CI                                                                                                                                                                                    |
| 1 ✅               | Accounts               | Users, roles, granular permissions (CASL), Argon2id + JWT, Auth.js + social login                                                                                                                                                                             |
| 2 ✅               | Content core           | Posts, pages, categories, tags, revisions, soft-delete; server-side HTML sanitization; public `/blog`                                                                                                                                                         |
| 3 ✅               | Media                  | Upload API, swappable storage adapter, content-type validation, image dimensions, per-asset metadata, CASL-gated                                                                                                                                              |
| 4 ✅               | Admin UI               | Editorial Next.js admin (Tailwind v4 + shadcn-style kit + Tiptap): dashboard, posts/pages/categories/tags, media, users                                                                                                                                       |
| 5 ✅               | Theme system           | Swappable, runtime-resolved themes selected by an `activeTheme` setting; public site renders through the active theme; Administrator-only switching at `/admin/appearance`                                                                                    |
| 6 ✅               | Plugin system          | Typed hook/event registry (filters + actions); plugins as constrained in-repo modules; sample reading-time plugin                                                                                                                                             |
| 7 ✅               | SEO / GEO              | OG + JSON-LD (Organization/WebSite/BlogPosting/Service/FAQPage), sitemap.ts, robots.ts, llms.txt; **admin-editable GEO content (site profile + Services + FAQ CRUD) so AI assistants recommend your services**                                                |
| 7b                 | i18n / multilingual    | next-intl + translated Prisma fields + hreflang (split out of Phase 7 as its own phase)                                                                                                                                                                       |
| 8 ✅               | Comments, search, spam | Threaded comments + moderation queue, Postgres full-text search, reCAPTCHA v3 (optional) + rate limiting on auth/comments                                                                                                                                     |
| 9 ✅               | Public site            | Polished server-rendered editorial frontend, public author profiles (editable bio), signed-in post likes                                                                                                                                                      |
| 10 ✅              | AI integration         | MCP server (`apps/mcp`) with scoped, validated, authenticated tools (content/media/comments/settings/SEO/users) over the API; CASL re-checked per call                                                                                                        |
| 11 ✅              | Deploy + demo          | Production `docker-compose.prod.yml` (db/api/web behind **nginx**) + `nginx/cmstack-ts.conf`, [VPS guide](docs/deployment/vps.md) (Docker/PM2, TLS, `/uploads`, health, backups) + [shared-hosting guide](docs/deployment/shared-hosting.md), enriched demo seed |
| 7b ✅ (foundation) | i18n / multilingual    | next-intl locale routing (`/`, `/de`, `/ru`, `as-needed` prefix) + translated public UI + locale switcher + hreflang/sitemap alternates. Per-locale **content** translation (translated Prisma fields + admin translation UI) is an optional follow-up        |

### Feature mapping (reference → Cmstack-TS)

The CMS feature set was extracted from the author's Laravel CMS
([Laravella-CMS](https://github.com/huseyn0w/Laravella-CMS)) and mapped to this stack:
content types, users/roles/permissions, media, comments, search, menus, settings,
multilingual, SEO/GEO (incl. `llms.txt`), spam protection, and social auth. Cmstack-TS goes
beyond the reference with an explicit **theme system**, a typed **plugin/hook registry**,
a **server-rendered** public site for indexability, content **revisions**, per-asset media
metadata, and an **MCP server** for AI-driven management.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
