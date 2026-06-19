# CLAUDE.md

This file guides Claude Code (CLI / VSCode extension) when working in this repository.

## Project

Typress is an open-source, WordPress-style CMS built on TypeScript. Goal: same core
capabilities as WordPress, but lighter, faster, SEO-first, and easy to read, understand,
and extend. It is a commercial/open project that will be demoed publicly on YouTube,
Product Hunt, and Slack, so code quality, security, and a clean demo matter.

Reference implementations by the same author (study for feature parity, not code style):

- Laravel: https://github.com/huseyn0w/Laravella-CMS

**Status:** Phases 0–10 shipped. Phase 0: pnpm monorepo, Docker compose (web/api/db),
Prisma + Postgres, Biome, Vitest, Playwright, CI. Phase 1 (Accounts): User/Role/Permission
models, Argon2id passwords, JWT auth, CASL authorization (PoliciesGuard), Auth.js v5 on
web (credentials + optional Google/GitHub) consuming the API. Phase 2 (Content): Post/
Page/Category/Tag/Revision models, content API with server-side HTML sanitization, slug
generation, draft/publish, soft-delete, revisions, CASL-gated authoring + public read
endpoints, and server-rendered `/blog`. Phase 3 (Media): upload API with a swappable
storage adapter, content-type validation, image dimensions, per-asset metadata, CASL
gating, and static serving at `/uploads`. Phase 4 (Admin UI): editorial Next.js admin at
`/admin` (Tailwind v4 + shadcn-style kit + Tiptap), screens for dashboard/posts/pages/
categories/tags/media/users, server-action mutations, plus user-management API endpoints.
Phase 5 (Theme system): runtime-resolved, swappable public themes selected by an
`activeTheme` setting (API source of truth); the public site renders through the active
theme; Administrator-only switching from `/admin/appearance`. Phase 6 (Plugin system): a
typed hook/event registry on the API (filters transform values, actions fire events),
plugins as in-repo modules with a constrained `PluginApi` (not arbitrary code injection),
plus a sample `reading-time` plugin. Phase 7 (SEO/GEO): sitemap/robots/llms.txt, Open Graph
+ JSON-LD (Organization/WebSite/BlogPosting/Service/FAQPage), and an admin-editable GEO area
(site profile + Services + FAQ CRUD) surfaced to AI assistants via llms.txt, JSON-LD, and a
server-rendered `/services` page. **i18n/multilingual was split out into its own later phase.**
Phase 8 (Comments, search, spam): threaded guest/auth comments with a moderation queue,
Postgres full-text search, reCAPTCHA v3 (optional) + rate limiting on auth + comment submit.
Phase 9 (Public site): the polished editorial frontend, public author profiles (with an
editable bio), and signed-in post likes. Phase 10 (AI integration / MCP): `apps/mcp` built
into a real MCP server exposing 48 scoped, Zod-validated, authenticated tools (content/media/
comments/settings/SEO/users) that call the existing API with a service-account bearer token,
so the API re-checks CASL per call. Next: Phase 11 (Deployment + demo). The full
phased roadmap and feature mapping live in [README.md](README.md).

## Auth & authorization (Phase 1)

- The **API is the identity source of truth**: it owns User/Role/Permission, hashes
  passwords (Argon2id, `@node-rs/argon2`), and issues HS256 JWTs signed with `AUTH_SECRET`.
- **Web (Auth.js v5)** is the session/social layer: a Credentials provider calls the API
  `/auth/login`; Google/GitHub are enabled only when their env vars are set; the API
  access token rides inside the Auth.js JWT session and is used for SSR calls to the API.
- **Authorization is CASL on the API.** Permissions are `(action, subject)` rows mapped
  1:1 to CASL rules; `manage`/`all` are wildcards. Gate routes with
  `@UseGuards(JwtAuthGuard, PoliciesGuard)` + `@CheckPolicies((a) => a.can(...))`.
  JwtAuthGuard must precede PoliciesGuard. Validate every mutation body with
  `ZodValidationPipe(<sharedSchema>)`.
- Shared request/response shapes live in `@typress/config` (`registerSchema`, `loginSchema`,
  `oauthSchema`, `publicUserSchema`, …) — import them on both sides; never redefine.
- Secrets: `AUTH_SECRET` (shared web↔api), `INTERNAL_API_SECRET` (guards `/auth/oauth`,
  the server-to-server upsert), `WEB_ORIGIN` (CORS). All required; see `.env.example`.
- Known limitation (tracked): GitHub OAuth email-link can be an account-takeover vector
  for unverified provider emails — fetch verified emails before enabling GitHub in prod.

## Content (Phase 2)

- Models: `Post`, `Page`, `Category` (self-referential tree), `Tag`, `Revision`,
  `ContentStatus` enum. Posts have categories/tags (m2m); posts & pages have soft-delete
  (`deletedAt`) and revision history.
- The `content` NestJS module: one service+controller per resource, plus a
  `PublicContentController` exposing published, non-trashed content at `/public/posts`,
  `/public/posts/:slug`, `/public/pages/:slug`. Authoring routes are CASL-gated
  (`@CheckPolicies((a) => a.can('<action>', 'Post'|'Page'|'Category'|'Tag'))`).
- **All rich-text `content` is sanitized server-side via `HtmlSanitizerService`
  (sanitize-html) on every create/update** — the only trusted writer is the seed. The web
  renders stored content with `dangerouslySetInnerHTML`, relying on that guarantee.
- Slugs are auto-generated from the title (`slugify`) and de-duplicated; a P2002 race
  returns 409. Revisions snapshot scalar fields (not taxonomy) of the prior state before
  each update. `publishedAt` is stamped on first publish and preserved thereafter.
- Editor role manages all content; Member has no content permissions. Tiptap editor UI
  is deferred to the admin panel (Phase 4); i18n/SEO-meta fields to Phase 7.

## Media (Phase 3)

- `Media` model + a swappable storage abstraction: code depends on the `StorageDriver`
  interface (`STORAGE` token); `LocalStorageService` writes to `UPLOAD_DIR` today, an S3
  driver is a one-line provider swap in `StorageModule`.
- Upload: `POST /media` (multipart, CASL `create Media`). Size capped by `MEDIA_MAX_SIZE_MB`
  (multer limit + validator). Allowed types: jpeg/png/gif/webp/pdf (`ALLOWED_MEDIA_MIME_TYPES`;
  **SVG excluded**). The bytes are re-validated (image-size for images, `%PDF-` magic for
  pdf), not just the client MIME. **The stored file's extension is derived from the
  validated MIME (`extensionForMime`), never the upload filename** — this prevents a
  polyglot being served as `text/html` (stored XSS). Files served at `/uploads/<key>` with
  `X-Content-Type-Options: nosniff`.
- Storage keys are reduced to a basename (no path traversal). Image width/height are
  stored; alt/title/caption are editable via `PATCH /media/:id`.
- Prod: nginx must forward `/uploads/*` to the API process (or serve the `uploads` volume
  directly, in which case drop `useStaticAssets`).

## Admin UI (Phase 4)

- Lives at `apps/web/app/admin/*`, gated two ways: `middleware.ts` requires a session for
  `/admin/:path*`, and `app/admin/layout.tsx` runs `requireAdminSession()` (redirects users
  without `read Admin`/`manage all`). The Users area additionally requires manage-users.
- Stack now active on web: **Tailwind v4** (tokens + `@theme` in `app/globals.css`; light is
  default, `.dark` class toggled by next-themes), a **shadcn-style UI kit** in
  `components/ui/*` (customized — gold `primary`, Geist font, hairline borders, editorial),
  **Tiptap** rich-text editor (`components/admin/rich-text-editor.tsx`), `sonner` toasts,
  `lucide-react` icons, `motion` for restrained animation.
- **Security model — the API bearer token never reaches the client.** The server-only API
  client (`lib/admin/api.ts`, `import 'server-only'`) reads the token from the Auth.js
  session. All mutations are **Server Actions** (`'use server'`) that call that client and
  `revalidatePath`; client components only invoke the actions. The API re-checks CASL on
  every call regardless of the UI.
- The public site renders through the **theme system** (Phase 5); each public theme owns its
  own scoped CSS vars (`--bg/--fg/--accent/--line/--muted` under a `.theme-<id>` wrapper).
  The admin uses the Tailwind token system (`--background/...`). Keep the two separate — a
  theme must never touch the admin tokens and vice-versa.

## Theme system (Phase 5)

- The public site is rendered **through a runtime-resolved theme**, not hardcoded markup.
  Which theme is active is the `activeTheme` key in the API `Setting` model (**the API is the
  source of truth**); the web app owns the theme catalogue.
- **API**: `settings` module. `GET /public/settings/theme` is **unauthenticated** (SSR needs
  it before any session). `GET/PUT /settings/theme` are CASL-gated on a new subject
  **`Setting`** (`read`/`manage`); only **Administrator** (`manage all`) holds it — Editors
  don't switch themes. `PUT` body is validated by `updateThemeSettingSchema` (slug-shaped).
  Shared contracts live in `@typress/config` (`updateThemeSettingSchema`, `themeSettingSchema`,
  `ACTIVE_THEME_KEY`).
- **Web**: themes live in `apps/web/themes/*` (they're React component sets — can't sit in
  `packages/config`). A `Theme` contract = `{ meta, Layout, Home, BlogIndex, BlogPost }`;
  `registry.ts` maps id→theme + exposes `themeCatalog`; `resolve.ts` has the pure
  `resolveThemeId` (unknown/empty → default); `active-theme.ts` (`'server-only'`)
  fetches the setting and **degrades to the default theme** on any API error/unknown id so
  the public site always renders. The three public surfaces (`/`, `/blog`, `/blog/[slug]`)
  render `<Layout><Surface/></Layout>` from the resolved theme. Ships `editorial` (dark,
  default) and `magazine` (light) — switching re-skins the public site.
- **Admin**: `/admin/appearance` (Administrator-only via `canManageSettings`) lists themes
  and activates one through a Server Action that `revalidatePath('/', 'layout')` so the swap
  is immediately visible. The stored theme id only ever flows into a fixed `theme-<id>` class
  via the registry — never interpolated into markup.
- Adding a theme: drop a folder in `apps/web/themes/<id>/`, export a `Theme`, register it in
  `registry.ts`. The API/seed default (`'editorial'`) and `DEFAULT_THEME_ID` must stay in
  sync, but the resolver makes drift safe (falls back to default).

## Plugin system (Phase 6)

- A **typed hook/event registry** on the API (`apps/api/src/plugins/`): plugins extend the
  app through declared extension points, **not arbitrary code injection**.
- Two hook kinds, both typed by a fixed catalogue in `hooks.ts`:
  **filters** (`applyFilters(name, value)` — value threads through every handler, in ascending
  `priority`, default 10) and **actions** (`emit(name, payload)` — fire-and-forget events).
  `FilterMap`/`ActionMap` give each hook a typed payload; no `any`.
- `HookRegistry` (provided + exported by `PluginsModule`) implements the **`PluginApi`** — the
  only surface a plugin gets (`addFilter`/`addAction`). Plugins never receive Prisma, the Nest
  container, or request objects. A plugin is a `TypressPlugin` (`{ name, register(api) }`); the
  enabled set is an explicit in-repo list (`enabled-plugins.ts`) registered once in
  `onModuleInit`.
- **`emit` is fault-isolated**: a throwing action listener is logged and swallowed so it can
  neither fail an already-committed write nor stop other listeners. Filters are *not* swallowed
  (a bad transform should surface).
- Wired in `PostsService`: `findPublicBySlug` returns `applyFilters('public.post.render', …)`
  so plugins can transform public post output; `create`/`update` `emit('post.published', …)`
  on each transition into PUBLISHED. Sample plugin `samples/reading-time.plugin.ts` injects a
  reading-time badge (a fixed-shape, integer-only HTML snippet — safe to render next to the
  write-time-sanitized content) and logs on publish.
- Add a plugin: implement `TypressPlugin`, add it to `enabled-plugins.ts`. New extension points
  = add a hook to `FilterMap`/`ActionMap` and call `applyFilters`/`emit` at the right spot.

## SEO / GEO (Phase 7)

- **API (`seo` module)** owns SEO/GEO content: a singleton `SiteProfile` (org name, tagline,
  description, url, logo, **`geoStatement`**), plus `Service` and `FaqItem` CRUD. Admin routes
  `/seo/*` are CASL-gated on a new subject **`Seo`** (`read`/`create`/`update`/`delete`),
  seeded to **Administrator + Editor** (SEO is editorial). `GET /public/seo` is unauthenticated
  (SSR needs it). All SEO/GEO text is **plain text** — no HTML, so nothing to sanitize.
- **Web SEO surfaces** (`apps/web/lib/seo/*` pure builders, unit-tested):
  - `app/sitemap.ts` (static routes + all published posts, paged), `app/robots.ts` (allow
    crawlers incl. AI bots; disallow admin/auth), `app/llms.txt/route.ts` (`text/plain` GEO feed
    built from the profile + services + FAQ + posts).
  - `generateMetadata` in the root layout sets `metadataBase`/title-template/OG/Twitter from the
    profile; pages set their own `title`/canonical; blog posts add `article` OG.
  - JSON-LD via `<JsonLd>` (`lib/seo/json-ld.tsx`): Organization + WebSite on home, BlogPosting
    on posts, Service (ItemList) + FAQPage on `/services`. **Security: `<JsonLd>` escapes every
    `<` to `<`** so admin-editable fields can't break out of the `<script>` (stored XSS).
  - `siteUrl` (`lib/seo/site.ts`) is `NEXT_PUBLIC_SITE_URL` ?? `AUTH_URL` ?? localhost, validated
    (a malformed env falls back, so it can't crash metadata generation).
- **GEO feature**: the admin **SEO & GEO** screen (`/admin/seo`, gated by `canManageSeo`) edits
  the profile/`geoStatement` + Services + FAQ via Server Actions; the public `/services` page
  (rendered through the active theme) + llms.txt + JSON-LD surface them to AI assistants.

## Comments, search, spam (Phase 8)

- **Comments** (`comments` module): `Comment` model (self-referential `parentId` threading,
  `CommentStatus` PENDING→APPROVED/SPAM/TRASH). Guests comment with name+email; signed-in users
  are pre-filled. **All comments start PENDING and are public only once APPROVED.**
  - Public `GET/POST /public/posts/:slug/comments`: GET returns the APPROVED, threaded tree
    (`buildCommentThread`, pure + unit-tested; never exposes `authorEmail`); POST is unauthenticated,
    **rate-limited** and spam-checked, validates the parent is APPROVED on the same post, and stores
    PENDING. Admin `GET/PATCH/DELETE /comments` is CASL-gated on subject **`Comment`** (Editor + Admin).
  - The web **submits comments client-side directly to the API** (`NEXT_PUBLIC_API_URL`) so the
    rate-limiter sees the real client IP; comment content is plain text rendered as escaped React text
    (no `dangerouslySetInnerHTML`). Admin moderation at `/admin/comments` (gated `canModerateComments`).
- **Search**: Postgres full-text (`SearchService`, `$queryRaw` with `to_tsvector` + `websearch_to_tsquery`
  + `ts_rank`; the user query is always a **bound parameter**). Public `GET /public/search` + a `/search`
  page. Postgres-specific by design ("Postgres full-text first").
- **Spam**: `RecaptchaService` is **optional** — when `RECAPTCHA_SECRET_KEY` is unset it skips
  verification (local/demo runs without Google keys); when set it requires a token meeting
  `RECAPTCHA_MIN_SCORE`. Rate limiting via `@nestjs/throttler` (`ThrottlerModule.forRoot`, applied per-route
  with `@UseGuards(ThrottlerGuard)+@Throttle` on auth `login`/`register` (10/min) and comment submit (8/min)).
  `main.ts` sets `trust proxy` so `req.ip` is the real client behind nginx.

## Public site (Phase 9)

- The public frontend is the editorial site rendered **through the active theme** (Phase 5),
  elevated with refined rhythm and restrained, reduced-motion-gated CSS motion
  (`[data-animate="rise"]`, `.ts-cta` in `globals.css`). Public copy avoids em-dashes.
- **Author profiles**: `GET /public/authors/:id` returns `{ id, name, image, bio, posts }`
  (only public fields are selected — never email/role/hash). Page at `/authors/[id]` (avatar,
  bio, their posts). Author bylines on posts link there. Each user has an editable `bio`.
- **Self-service profile**: `PATCH /auth/me` (JWT; identity from the token, never the body)
  updates name/bio/avatar; the `/account` page has a `ProfileEditor` (Server Action). Bio is
  plain text rendered escaped.
- **Likes are signed-in only**, one per user (`PostLike`, `@@unique([postId,userId])`).
  `GET/POST /posts/:slug/like` (JWT, no CASL — any signed-in user); public count at
  `GET /public/posts/:slug/likes`. Toggle is race-resilient (ignores concurrent P2002/P2025
  and recomputes state). Web `LikeButton` toggles via a **Server Action** (the API bearer
  token stays server-side); anonymous visitors see a "Sign in to like" link.

## AI integration / MCP (Phase 10)

- `apps/mcp` (MCP TypeScript SDK, **ESM**) is a **thin, authenticated client of the API**, not a
  second source of truth. It logs in once with a service account (`MCP_API_EMAIL`/
  `MCP_API_PASSWORD` → `POST /auth/login`), caches the bearer token, and **re-logs in once on a
  401** (expiry). Every tool call hits an existing REST endpoint with that token, so the **API
  re-checks CASL** and the MCP server inherits all authorization for free — it carries none of
  its own. Tools are only as powerful as the configured account's role.
- **Config**: `loadConfig()` validates `MCP_API_URL`/`MCP_API_EMAIL`/`MCP_API_PASSWORD` (Zod) and
  throws an actionable error if unset. `ApiClient` (`src/api-client.ts`) takes an injectable
  `fetch` (so the login/retry/error-mapping logic is unit-tested without a network). Tool inputs
  are validated by the **shared `@typress/config` schemas** (e.g. `createPostSchema`,
  `postListQuerySchema`), composed with `.extend({ id })` where a route param is needed — never
  redefined. The bearer token lives only in `ApiClient` + the `authorization` header; it is
  **never logged or returned** (startup logs only `apiUrl`).
- **Tools (48)**, one module per concern under `src/tools/*`, registered via the modern
  `server.registerTool` with `title`/`description`/shared `inputSchema`/`annotations`
  (readOnly/destructive/idempotent hints): posts (incl. publish/unpublish = `PATCH status`,
  delete/restore), pages, categories, tags, media (list/get/update-meta/delete — **no binary
  upload over MCP**), comments (approve/spam/trash/delete = `PATCH /comments/:id`), settings
  (get/set active theme), SEO/GEO (profile + Services + FAQ CRUD), users (list/roles/get/update —
  **no user delete over MCP**). Results are JSON via a shared `tool-kit` (`respond`/`toolResult`,
  25k-char truncation guidance); API 4xx/403 surface as clear tool errors (`errors.ts` —
  403 explicitly names the CASL boundary). **No filesystem, shell, or plugin/theme code execution.**
- **Build/run**: `pnpm --filter @typress/mcp build` → `node apps/mcp/dist/index.js` (stdio; logs to
  stderr). Connecting from Claude (CLI `claude mcp add` / VS Code `mcp.json`) is documented in
  README. Add a tool: add a module fn or entry calling `client.request(method, path, { query, body,
  schema })` and register it in `src/tools/index.ts`.

## Stack (locked decisions — deviate only with a stated reason)

- TypeScript everywhere. Monorepo with **pnpm workspaces** (Turborepo deferred until
  build/CI time warrants it; it layers on top with no migration cost).
  - apps/web: Next.js (App Router) — SSR/SSG/ISR, public site + admin UI. ESM, its own
    build pipeline.
  - apps/api: NestJS — REST/RPC API, modules mirror feature areas. **CommonJS** (cleanest
    for Nest + tsc build and `emitDecoratorMetadata` DI).
  - apps/mcp: MCP server (TypeScript SDK) for AI clients. **ESM** (the SDK is ESM-only).
  - packages/db: Prisma schema + migrations. packages/config: shared zod/env/types.
    Both are **CommonJS**, compile to `dist`, and are consumed from `dist` by the apps;
    Vitest resolves them from `src` via aliases (see vitest.config.ts) so unit tests need
    no prior build.
- Database: PostgreSQL (default). Keep all access through Prisma and DB-agnostic so
  MySQL works for shared hosting.
- Auth + social login: **Auth.js (NextAuth v5)** with the Prisma adapter — handles
  authN + sessions + social on apps/web. Authorization: **CASL** on apps/api (every
  mutation policy-checked). (Lucia was considered and rejected: CASL already owns
  authorization, so Auth.js's batteries-included social providers win.)
- Validation: Zod (forms, API boundaries, env). Rich text: Tiptap (sanitized).
- UI: Tailwind CSS + shadcn/ui + Framer Motion (restrained animation only).
- i18n / multilingual: next-intl + translated fields in Prisma (hreflang).
- Spam: reCAPTCHA v3 + rate limiting. Search: Postgres full-text first.
- Tests: Vitest (unit/integration) + Playwright (e2e). Lint/format: Biome.
- Local infra: Docker + docker compose. Prod: Node on a VPS (Docker or PM2) behind
  nginx; a separate guide for shared hosting (Hostinger / Passenger / cPanel).

## Architecture conventions

- NestJS modules = bounded concerns (accounts, content, media, themes, plugins, seo,
  comments, search, settings). One module = one responsibility.
- Thin controllers; logic in services. Add abstractions only where they remove real
  duplication — not speculatively.
- Themes: swappable template/component sets resolved at runtime. Plugins: extension
  points via a typed hook/event registry, not arbitrary code injection.
- SEO/GEO is first-class: Open Graph + JSON-LD via Next metadata, sitemap.ts, robots.ts,
  hreflang. Public pages render server-side for indexability.
- Types are the contract: share Zod schemas/types across web and api; no `any`.

## Commands (keep this section updated as the project grows)

- Install: `pnpm install` (Node ≥22; pnpm via `corepack enable`).
- Dev up (full stack in Docker): `docker compose up` → web :3000, api :4000, db :5432.
- Dev servers (local, no Docker): `pnpm dev` (runs all apps + package watchers).
- DB: generate client `pnpm db:generate`; apply migrations `pnpm db:migrate`
  (dev migration: `pnpm --filter @typress/db migrate:dev`); seed demo `pnpm db:seed`.
- Tests: `pnpm test` (single: `pnpm vitest run <path> -t "name"`). E2E: `pnpm e2e`.
- Lint/format: `pnpm lint` (check) / `pnpm format` (write). Typecheck: `pnpm typecheck`.
- Build: `pnpm build` (topological: packages → apps).
- MCP server: build `pnpm --filter @typress/mcp build`, run `node apps/mcp/dist/index.js`
  (needs `MCP_API_URL`/`MCP_API_EMAIL`/`MCP_API_PASSWORD`); connect from Claude via
  `claude mcp add` or a VS Code `mcp.json` (see README).

Notes:
- Biome needs `javascript.parser.unsafeParameterDecoratorsEnabled: true` for NestJS
  param decorators (`@Body`, `@Inject`, …), and `style/useImportType` is off because
  Nest DI needs runtime (value) imports for injected types — see biome.json.
- `pnpm typecheck` builds `packages/*` first so apps can resolve them from `dist`.

## Working rules

- Run tests and Biome after every change; a change is not done until both pass.
- Only make changes directly requested or clearly necessary. Do not add extra packages,
  abstractions, or configurability that was not asked for.
- Never commit secrets; all config via environment variables (.env, with .env.example).
- Keep README.md and this file current when commands, stack, or structure change.
- Communicate with the user in English.
