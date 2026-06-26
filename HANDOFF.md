# cmstack-ts — HANDOFF

**Updated:** 2026-06-26 — **Task 2 + Task 4 COMPLETE; E2E re-run green; Task 1 IN PROGRESS (§7 #1–#10 done).** · **Branch:** `refactor/repository-layer` (off `main`)
**Next phases:** Task 1 (feature parity) continuing — §7 register fully ticked; next is the **shared net-new** (revision-restore UI, scheduled publishing, RSS/Atom, comment-notification email). Task 3 (UI), Task 5 (README) not started.

## Task 1 progress (feature parity, `REFACTOR_PLAN.md` §7 — strict order per operator)
- **E2E baseline re-run (pre-Task-1):** full stack up (docker db + built api + built web),
  `pnpm e2e` = **11/11 green** → repository-layer refactor confirmed black-box-invariant.
  One pre-existing i18n/a11y drift fixed on the way (search input `aria-label` now a distinct
  `search.inputLabel` = "Search query"; the e2e test predated the i18n foundation).
- **§7 #1 — Per-locale content translation (Post + Page): DONE.** Model B3 (operator-chosen):
  base Post/Page columns are the canonical **en** values; new `PostTranslation`/`PageTranslation`
  tables hold de/ru overrides (nullable fields, **per-field fallback**); shared slug/status/author.
  Spec: `docs/superpowers/specs/2026-06-24-per-locale-content-translation-design.md`; plan:
  `docs/superpowers/plans/2026-06-24-per-locale-content-translation.md`.
  - Additive reversible migration `20260624205514_content_translations` (+ base `metaTitle`/
    `metaDescription` on Post/Page — translatable meta folded in now so §7 #2 won't re-migrate).
  - `@cmstack-ts/config` owns `LOCALES`/`DEFAULT_LOCALE`/`localeSchema` (web i18n routing imports
    them — no drift) + translation/meta schemas. Pure `localizeContent` resolver (unit-tested).
  - Repos gained locale-aware finders (`localizedPostInclude`/`localizedPageInclude`) +
    `findByIdWithTranslations` + full-row `upsertTranslation`/`deleteTranslation` on the
    `[contentId, locale]` unique; repos stay framework/config-free, never catch P2002/P2025.
  - Public reads take `?locale=` (junk/absent → default); admin GET returns all translation rows;
    CASL-gated `PUT/DELETE /{posts,pages}/:id/translations/:locale` (content sanitized; empty field
    = no override → falls back; all-empty save clears the row; idempotent delete). No observer
    events (§2.7 — no real side effect). Authors profile + web blog/post/author pages forward locale.
  - Seed adds de/ru demo translations. **Verified live** (curl + SSR): en base, de/ru overlay with
    per-field fallback, junk locale → en. **301 tests, typecheck/lint clean, coverage ≥80%, e2e 11/11.**
  - Adversarial self-review found + fixed **1 MED bug** (empty-string field overlaid base instead of
    falling back) with a regression test.
  - **Scoped out (logged, not silent):** admin per-locale tab-strip UI → §7 #8; meta `<head>` render +
    canonical/noindex → §7 #2 (columns already in place); multilingual de/ru full-text search → future
    (canon rates ts search non-multilingual); Category/Tag name translation → fast-follow.
- **§7 #2 — Per-content SEO meta: DONE** (2026-06-25). Structural `canonicalUrl` + `noindex` added
  to Post/Page (migration `20260625..._content_seo_meta`, additive/reversible; NOT per-locale).
  metaTitle/metaDescription were already translatable from #1. Surfacing: blog post `generateMetadata`
  uses **localized** metaTitle/metaDescription over title/excerpt, applies a custom canonical override,
  emits robots `noindex` (index:false, follow kept); `noindex` posts are excluded from the **sitemap**
  and **llms.txt**. Admin post + page forms gained an **SEO fieldset** (meta title/description,
  canonical URL, noindex checkbox). **302 tests, typecheck/lint clean, coverage ≥80%, e2e 11/11**;
  live-verified (custom `<title>`/description/canonical render, `noindex,follow` meta, sitemap excludes
  the noindex post). Adversarial self-review fixed one SEO nit (`noindex` no longer implies `nofollow`).
  - **Known pre-existing limitation (not a #2 regression):** the admin forms send empty optional fields
    as `undefined`, so clearing an existing excerpt/meta/canonical via the form is a no-op (the value
    persists). Systemic to the form pattern (excerpt already behaved this way); fix later by sending an
    explicit empty/`null` if field-clearing is required.
  - **Pages** store meta/canonical/noindex but have **no public route** yet, so page-level meta is not
    rendered anywhere (wire it when pages get a public surface).
- **§7 #3 — Password reset + transactional email: DONE** (2026-06-25). New `mail` module:
  `MailService` sends through a pluggable `MailTransport` (real SMTP via **nodemailer** when
  `SMTP_HOST` is set; a logging no-op otherwise, so the demo prints the reset link to the API log
  and needs no SMTP server) + a pure `passwordResetEmail` builder (HTML-escaped link).
  `PasswordResetToken` model (migration `20260625..._password_reset_tokens`): only the **SHA-256
  hash** of the token is stored, single-use (`usedAt`), TTL (`PASSWORD_RESET_TTL_MINUTES`, default
  60). Rate-limited `POST /auth/password-reset/request` (always 200 — no account enumeration; a mail
  failure is caught so it can't 500-leak existence) and `/confirm` (validates token unused+unexpired,
  Argon2id-rehashes, marks used). Web `/forgot-password` + `/reset-password?token=` pages (outside
  locale routing; added to middleware `PANEL_PREFIXES`) + a "Forgot your password?" link on sign-in.
  `.env.example` documents the SMTP vars. **316 tests, typecheck/lint clean, coverage ≥80%, e2e
  11/11**; live-verified end-to-end (request → emailed link from the API log → confirm → login with
  the new password; reuse of a spent token → 400). Adversarial self-review fixed the mail-failure
  enumeration leak (above).
  - **New dependency:** `nodemailer` (+ `@types/nodemailer`) in `apps/api` — required for real SMTP
    delivery; justified by the feature (not speculative).
- **§7 #4 — Menu management: DONE** (2026-06-25). Spec/plan:
  `docs/superpowers/{specs,plans}/2026-06-25-menu-management.*`. Model: `Menu` (unique `location`),
  nested `MenuItem` (self-tree, polymorphic **non-FK** `targetId` for POST/PAGE/CATEGORY, `url` for
  CUSTOM), `MenuItemTranslation` (label-only, reuses §7 #1 `localizeContent` + per-field fallback).
  Migration `20260625125551_menu_management` (additive/reversible). New `menus` NestJS module
  (controller → `MenuService` → `MenuRepository`/`MenuItemRepository`); `Post/Page/CategoryRepository`
  gained `slugsByIds` (batch, no N+1). Pure `resolveMenuItemUrl` + `normalizeCustomUrl` in
  `@cmstack-ts/config` (CUSTOM url restricted to `/…` or `http(s)://…`; `javascript:`/`//` rejected).
  Public `GET /public/menus/:location?locale=` → resolved, localized tree `{label,url,openInNewTab,
  children}` (unresolved target → link dropped; orphan of a dropped parent dropped; junk/absent locale
  → default). Admin (CASL subject **`Menu`**, seeded to Administrator + Editor): `GET/POST/PATCH/DELETE
  /menus`, item CRUD, **`PUT /menus/:id/structure`** (bulk reorder+reparent, validates ids ⊆ menu +
  no cycle), per-locale label `PUT/DELETE …/items/:itemId/translations/:locale`. New web routes:
  `/[locale]/[slug]` (public **Page** through the active theme — also starts rendering §7 #2 page meta)
  and `/blog?category=` filter. `<SiteMenu>` (`components/public/site-menu.tsx`) renders managed nav in
  **editorial + magazine** (locale-aware `Link` for internal hrefs → `/de/…`, plain `<a>` for external;
  empty/unavailable → theme's static-link fallback; `.ts-menu` dropdown CSS in globals). Admin
  drag-sortable builder at `/admin/menus` (HTML5 drag reorder + indent/outdent capped at 2 levels,
  item editor with target picker, per-locale label fields; Server Actions). Seed adds `primary`
  (Blog/Services→Search nested/Featured POST) + `footer`, with de/ru labels (idempotent by location).
  **No observer event** (no real side effect; `menu.changed` recorded for the future cache layer, §2.7).
  **357 tests, typecheck/lint clean, coverage 87.5% (gate ≥80%)**; live-verified (de/en/junk-locale menu
  JSON; `/de` header renders localized managed nav with `/de/…` links; `/about` page route + custom
  `<title>`; `/blog?category=guides` → 200). Adversarial self-review: 0 HIGH/MED (XSS, P2002/P2025,
  slug-drift, cycle, locale fallback, payload-leak all checked); 1 LOW (PATCH item is full-replace,
  consistent with the form pattern).
  - **Scoped out (logged):** pointer-drag polish / nicer dropdowns → Task 3 (UI); the builder reorders
    via HTML5 drag + indent/outdent buttons (keyboard-usable) which is functional, not yet polished.
    Category items resolve to `/blog?category=`; a dedicated category archive page is not built.
- **§7 #5 — Contact form + email: DONE** (2026-06-25). Spec/plan:
  `docs/superpowers/{specs,plans}/2026-06-25-contact-form.*`. New `contact` module (3-layer +
  observer): public `POST /public/contact` (throttled **5/min**, honeypot `company` → silent 201 drop,
  reCAPTCHA) → `ContactService` persists `ContactSubmission` then **`hooks.emit('contact.submitted')`**
  → fault-isolated `ContactMailListener` sends via the #3 `MailService`. Recipient is **settings-driven**:
  pure `resolveContactRecipient(profile.contactEmail → CONTACT_RECIPIENT_EMAIL → MAIL_FROM)`. Pure
  `contactNotificationEmail` builder (HTML-escaped). Migration `20260625135931_contact_submissions`
  (new table + `SiteProfile.contactEmail` column, additive). Admin inbox `GET /contact` (newest-first),
  `PATCH /contact/:id` (handled toggle, P2025→404), `DELETE /contact/:id` — CASL subject **`Contact`**
  (Administrator + Editor). Web `/[locale]/contact` localized form (posts **client-side** to the API for
  real-IP throttle, like comments; honeypot hidden field) + admin `/admin/contact` inbox (mark-handled +
  delete) + a **Contact email** field on the SEO profile form. `contact.submitted` added to `ActionMap`
  — **first real side effect wired to the observer per §2.7** (comment-notification email is its sibling,
  still pending). Seed: `contactEmail` on the profile + 2 demo submissions (one handled; count-guarded).
  `.env.example` documents `CONTACT_RECIPIENT_EMAIL`. **393 tests, typecheck/lint clean, coverage ~89%
  (contact module 93%), e2e 11/11**; live-verified end-to-end (real submit stored + emailed to the log;
  honeypot submit → 201 but not stored; admin inbox lists it; `/contact` + `/de/contact` render localized).
  Adversarial self-review: 0 HIGH/MED (honeypot/recaptcha order, email-header injection, HTML escape,
  P2025→404, listener fault-isolation verified in `emit`, recipient fallback, no payload leak, throttle).
  - **Scoped out (logged):** the seeded "Contact" **content page** (slug `contact`) is shadowed by the
    static `/[locale]/contact` form route (Next prioritises the static segment) — accepted; the page
    stays in the DB/admin. No auto-responder to the sender / threaded replies / attachments.
- **§7 #6 — GA4/GTM + site verification + basic consent: DONE** (2026-06-26). Spec/plan:
  `docs/superpowers/{specs,plans}/2026-06-26-analytics-verification-consent.*`. Eight additive
  `SiteProfile` columns (migration `20260625230456_analytics_verification`): `ga4MeasurementId`,
  `gtmContainerId`, named verification tokens (Google/Bing/Yandex/Meta-`facebook-domain-verification`/
  Pinterest-`p:domain_verify`), and a **Json** `customVerificationTags` (`[{name,content}]`) escape
  hatch. `@cmstack-ts/config` owns strict schemas (GA4 `^G-[A-Z0-9]+$`, GTM `^GTM-[A-Z0-9]+$`,
  token charset excludes `<>"'`/whitespace, custom list ≤20) + pure `buildVerificationMeta` (named
  field wins over a same-named custom pair; empties dropped). Public `GET /public/seo` + admin
  `GET/PUT /seo/profile` carry the fields; `SeoService` casts the Json via `Prisma.InputJsonValue`,
  repo `SiteProfileWritableData` overrides that field's type. **No observer event** (no real side
  effect, §2.7). Web: verification `<meta>` via `generateMetadata` in **`app/[locale]/layout.tsx`**
  (public-only — admin/auth at the app root never see them). Analytics via **`@next/third-parties`**
  (pinned to v15 to match Next 15), gated behind a basic consent banner: server reads cookie
  `ts-consent`, client `<AnalyticsLoader>` shows Accept/Decline (next-intl en/de/ru) and only injects
  GA4/GTM after Accept. Admin SEO form gained an "Analytics & verification" fieldset incl. an
  add/remove custom-pairs editor (stable row ids via a ref counter, not array-index keys). Seed sets
  a demo `googleSiteVerification` + custom pair; GA4/GTM left empty (no fake hits). **404 tests,
  typecheck/lint clean, coverage 89.55% (gate ≥80%), e2e 11/11**; live-verified (curl `/public/seo`
  has the fields; home renders google/bing/pinterest metas; `/admin` has **0**; GA absent without
  consent, injected with `ts-consent=accepted`). Adversarial self-review fixed **1 MED** (consent
  banner styled via theme vars it sits outside → moved colors to `.ts-consent` with fallbacks).
  - **Scoped out (logged):** Google Consent Mode v2 / granular cookie categories / consent audit log /
    persistent "manage cookies" surface → future GDPR module. AI-engine "verification" not faked
    (LinkedIn/Instagram/UpWork/ChatGPT/Claude/Perplexity/Gemini/xAI have no meta mechanism); their
    discoverability is already served by `robots.txt`/`llms.txt` (Phase 7).
- **§7 #7 — Auto thumbnails / image processing: DONE** (2026-06-26). Spec/plan:
  `docs/superpowers/{specs,plans}/2026-06-26-auto-thumbnails.*`. New dep **`sharp`** in `apps/api`.
  On image upload, an injected `ImageProcessor` (`IMAGE_PROCESSOR` token, `SharpImageProcessor`,
  bound in `MediaModule` with the env megapixel cap) generates **WebP** derivatives — `thumb` (≤400)
  and `medium` (≤1024), `THUMBNAIL_SIZES` in `@cmstack-ts/config` — resize-to-fit, **no upscale**,
  EXIF auto-rotate, GIF → static first frame, **PDF skipped**. Generation is **synchronous +
  fault-isolated**: a sharp failure logs, cleans partial files, and the original still uploads with
  `thumbnails: []`. **Decompression-bomb guard:** `MediaService.validateAndMeasure` rejects
  `width*height > MEDIA_MAX_MEGAPIXELS*1e6` (env, default **40**, read directly so unit tests stay
  default-safe — NOT via full `parseEnv()` which would throw on missing secrets) on the
  `image-size` header **before any decode**, and `sharp` is constructed with `{ limitInputPixels }`.
  Migration `20260625..._media_thumbnails` adds `Media.thumbnails Json @default("[]")` (additive);
  config `thumbnailSchema` + `thumbnailKey(base,label)` → `<base>-<label>.webp`; `mediaSchema.thumbnails`
  is **required**. `MediaService.upload` saves original → generates+saves derivatives (tracking keys)
  → writes the row; **row-create failure rolls back original + all derivatives**; `remove` deletes
  every derivative key. Repo `MediaCreateData.thumbnails: Prisma.InputJsonValue`, `findFilename` now
  also selects `thumbnails`. Admin media grid renders the **thumb** variant (faster). **No observer
  event** (part of upload, §2.7). `.env.example` documents `MEDIA_MAX_MEGAPIXELS`. **415 tests,
  typecheck/lint clean, coverage 89.75% (gate ≥80%), e2e 11/11**; live-verified (6MP jpg → thumb
  400x267 + medium 1024x683 served as `image/webp`; derivative files on disk; 48MP png → **400**).
  Adversarial self-review added a regression test for derivative rollback on row-create failure;
  0 HIGH/MED.
  - **Scoped out (logged):** PDF thumbnails (needs a heavy PDF renderer); backfill of pre-existing
    media (only new uploads — a future one-off script); public `<img srcset>` responsive delivery;
    crop / focal-point / on-demand resize.
- **§7 #8 — Dashboard translation editing UI: DONE** (2026-06-26). Spec/plan:
  `docs/superpowers/{specs,plans}/2026-06-26-translation-editing-ui.*`. **Web-only** — drives the
  existing §7 #1 endpoints (`PUT/DELETE /{posts,pages}/:id/translations/:locale`); no API/schema/
  migration change. Reusable client `components/admin/translations-panel.tsx` renders a **tab strip**
  of override locales (`LOCALES` minus `DEFAULT_LOCALE` → de/ru) below the base (en) post/page form,
  **edit mode only** (needs an id). Each locale: fields title/excerpt[post]/content (RichTextEditor)/
  metaTitle/metaDescription pre-filled from the existing translation row (null→''), **base value as
  the placeholder** (per-field fallback hint); **Save** (PUT) + **Clear translation** (DELETE,
  idempotent) with per-locale `useTransition` + toasts. Pure `lib/admin/translation-input.ts`
  (`buildTranslationInput` trims + drops empty → empty = no override, all-empty PUT clears the row;
  `localeLabel`). New Server Actions `upsert/delete{Post,Page}TranslationAction` (validate
  `{post,page}TranslationInputSchema`, `revalidatePath('/admin/{posts,pages}')` + `'/','layout'`).
  Admin stays **English** (tab labels "Deutsch (de)"/"Русский (ru)"). Content stays
  **server-sanitized** on the same `upsertTranslation` write path (verified — no new XSS surface).
  **419 tests, typecheck/lint clean, coverage 89.75% (gate ≥80%), e2e 11/11**; live-verified
  (panel Save PUT de → `/de/blog/<slug>` shows the override, en falls back to base; Clear DELETE →
  `/de` falls back). Adversarial self-review: 0 HIGH/MED (locale validated by `localeSchema`, edit-only,
  empty→fallback on both client+server, idempotent clear, sanitization confirmed).
  - **Scoped out (logged):** Category/Tag name translation (no API yet — fast-follow from §7 #1);
    translating slug/status/taxonomy (shared by design); machine translation; completeness indicator.
  - **Gotcha hit during live verify:** the Docker daemon had stopped (DB unreachable, API 500s) —
    `open -a Docker`, wait for `docker info`, `docker compose up -d db`, restart the API.
- **§7 #9 — Plugin admin UI + runtime enable/disable + render-region hooks: DONE** (2026-06-26).
  Spec/plan: `docs/superpowers/{specs,plans}/2026-06-26-plugin-admin-ui.*`. **Runtime toggle (no
  restart):** every in-repo plugin registers at boot via a **scoped `PluginApi` facade** that tags its
  handlers with the plugin `id` (`owner`); `HookRegistry` gained `owner?` on `addFilter/addAction/
  addRegion`, a `setEnabledPlugins(ids)` gate, and `isActive(owner)` — owned handlers run only if
  enabled, **un-owned (core) handlers always run** (so the `contact.submitted` mail listener, which
  calls `hooks.addAction` directly with no owner, is never disableable). **Render regions:** new hook
  kind — `RegionMap` (ships `site.footer`, extensible), `addRegion`/`renderRegion` (concatenates
  enabled contributors by priority, fault-isolated). `CmstackTsPlugin` gained `id` + `description`;
  `enabled-plugins.ts` → `available-plugins.ts` (all in-repo plugins). `PluginService` (list/setEnabled/
  loadEnabled/renderRegions) persists the enabled set in `Setting['enabledPlugins']` (JSON, **no
  migration**) and drives the registry; `renderRegions` sanitizes region HTML via `HtmlSanitizerService`.
  Admin `GET /plugins` + `PUT /plugins/:id {enabled}` (CASL subject **`Plugin`**, Administrator-only);
  public `GET /public/plugins/regions`. Web: `/admin/plugins` toggle screen (Administrator-only,
  `canManageSettings`) + nav link; public `[locale]` layout renders the `site.footer` region via
  sanitized `dangerouslySetInnerHTML` (after children, like the consent banner). New demo plugin
  `samples/site-footer-note.plugin.ts`. Seed: `enabledPlugins=["reading-time","site-footer-note"]`
  + `Plugin` permission. **No observer event** (toggle = config write, §2.7). **432 tests,
  typecheck/lint clean, coverage 89.93% (gate ≥80%), e2e 11/11**; live-verified end-to-end (both the
  reading-time **filter** badge and the footer **region** gate on/off at runtime with no restart;
  regions `{}` when disabled; unknown id → 404; admin `/plugins` → 401 without token; public regions
  → 200). Adversarial self-review: 0 HIGH/MED.
  - **Known interaction (logged):** `HtmlSanitizerService` strips the `class` attribute from region
    HTML (not in its allowlist), so style plugin regions via the React-rendered **`.ts-plugin-region`**
    wrapper, not inner element classes. The `RegionMap` value type is a `true` marker (biome's
    `noConfusingVoidType` rejects `void`).
  - **Scoped out (logged):** regions beyond `site.footer` (extensible — a few lines each); loading
    user-uploaded plugin code (in-repo only by design); per-plugin settings/config screens;
    inter-plugin dependencies beyond `priority`.
- **§7 #10 — Caching layer (Redis + page/fragment cache, invalidate via `HookRegistry`): DONE**
  (2026-06-26). Spec/plan: `docs/superpowers/{specs,plans}/2026-06-26-caching-layer.*`. New `cache`
  module: `CacheService` over a pluggable `CacheStore` (`CACHE_STORE` token) — `RedisCacheStore`
  (**new dep `ioredis`**, non-blocking `SCAN`+`DEL` prefix flush) when `REDIS_URL` is set, else
  `MemoryCacheStore` (Map+TTL) so the cache runs/tests without Redis (like the logging mail
  transport). `getOrSet(key, factory, ttl?)` is **fault-isolated** — a store error is logged and
  falls through to the source (a read never fails); the `factory` runs **outside** the try so a
  `NotFoundException` propagates and is never cached; `CACHE_ENABLED=false` is a pure passthrough.
  Cached hot public reads (locale + query in the discriminator): `settings/theme` (ns `settings`),
  `public/seo` (`seo`), `public/posts` list + `:slug` detail (`content:posts`), `public/pages/:slug`
  (`content:pages`), `public/menus/:location` (`menus`). **Post detail is cached pre-`applyFilters`**
  — the plugin filter runs after the cache, so runtime plugin toggles are never frozen in. Four new
  **core** `ActionMap` events (`content.changed`/`settings.theme.changed`/`menu.changed`/`seo.changed`)
  emitted by the write services; `CacheInvalidationListener` (un-owned → never gated off by the
  plugin toggle) flushes one namespace per event. New env `REDIS_URL`/`CACHE_TTL_SECONDS` (300)/
  `CACHE_ENABLED` (read directly in the module factory + in `envSchema`); `redis` service added to
  dev+prod compose; `.env.example` documented. **No migration** (cache is not persisted). **463
  tests, typecheck/lint clean, coverage 90.19% (gate ≥80%), e2e 11/11**; live-verified (Redis keys
  populate on public reads; admin PATCH post flushes only `content:posts:*`, leaving seo/settings;
  theme PUT flushes `settings`; reading-time badge present on a cache **hit**; memory-fallback banner
  without `REDIS_URL`). Adversarial self-review: 0 HIGH/MED (NotFound-not-cached, store-down
  fall-through, no secret in keys/values, plugin filter on hit, namespace-scoped flush, disable
  bypass all checked).
  - **Scoped out (logged):** caching search/authors/comments/likes; per-namespace TTLs; single-flight/
    stampede locks (TTL bounds staleness); HTTP response caching (`Cache-Control`); web/Next-side
    caching beyond the existing `revalidatePath`. Draft writes also emit `content.changed`
    (over-eager but safe — over-invalidation never serves stale).
- **Next §7 item:** none — the §7 register is fully ticked. Next is the **shared net-new**
  (revision-restore UI, scheduled publishing, RSS/Atom feeds, comment-notification email — the next
  `HookRegistry` consumer after `contact.submitted`).

---

## What this work is
Bring `cmstack-ts` to the shared cross-stack standard. The active sub-task is the
**repository-layer refactor**: extract all Prisma access out of the NestJS services in
`apps/api` into per-aggregate repositories in `packages/db`, wired via DI. Full plan +
decision record: **`REFACTOR_PLAN.md`** (read it first). Canon specs (read-only, do
NOT edit): `../FEATURE_MATRIX.md`, `../DESIGN_SYSTEM.md`.

## Architecture (target, three layers — operator-enforced)
`controller (thin) → service (business logic + emits observer events on real side
effects) → repository (data access, framework-free, returns Prisma payloads)`.
- Repositories live in `packages/db/src/repositories/`, one file per aggregate:
  export `interface XRepository`, `X_REPOSITORY` Symbol token, `PrismaXRepository`.
  Re-exported from `packages/db/src/index.ts` (which now also `export * from
  '@prisma/client'` so the API never imports `@prisma/client` directly).
- Each feature module binds its token via `{ provide: X_REPOSITORY, useFactory:
  (p: PrismaClient) => new PrismaXRepository(p), inject: [PRISMA] }`. **No @Global
  god-module.** `PRISMA` token is in `apps/api/src/prisma/prisma.module.ts`.
- **Observer policy (operator decision):** service emits domain events via
  `HookRegistry` only where a write has a genuine side effect (see plan §2.7 event
  map). Repository never touches `HookRegistry`. No speculative events.
- **Behaviour preservation is non-negotiable** — see `REFACTOR_PLAN.md` §10
  invariants (connect-vs-set, media ordering, repos never catch P2002/P2025,
  $transaction array form, raw-SQL binding, 4 distinct user shapes, asymmetric
  upserts, revision/publish ordering).

## DONE
- **Baseline pinned:** `pnpm test` = 27 files / 134 tests green (now **140** after the
  Settings slice).
- **`REFACTOR_PLAN.md`** written, adversarially reviewed (2 independent skeptics:
  over-engineering + behaviour-preservation), revised; observer policy + fat-controller
  finding integrated.
- **Premise corrected:** controllers were NOT fat — 18/19 already thin; services held
  logic; only the repository layer was missing. **One genuine fat controller found:**
  `apps/api/src/admin/admin.controller.ts` (injects PrismaClient, runs
  `Promise.all([user.count, role.count])`) — fix planned in plan §4.10b (AdminService +
  repo counts), scheduled with the Auth domain.
- **Scaffolding committed:** `packages/db/src/repositories/` (barrel, `crud.repository.ts`
  base, per-aggregate files), `packages/db/src/index.ts` re-exports the Prisma surface
  + repositories, and `apps/api/src/persistence/repository.providers.ts`
  (`provideRepository(token, Impl)` DI helper).
- **7 domains refactored, each its own commit (TDD, full suite green, tsc + biome clean):**
  1. **Settings** → `SettingRepository`.
  2. **SEO/GEO** → `SiteProfile` + `Service` + `Faq` repositories (asymmetric upsert).
  3. **Tags** + **Categories** → repos + `PrismaCrudRepository` base; `findIdBySlug`
     keeps the uniqueSlug excludeId loop; Category unchecked scalar `parentId`.
  4. **Media** → `MediaRepository` (storage/DB ordering + rollback pinned by tests).
  5. **Likes** → `PostLikeRepository` + incremental `PostRepository.findPublishedIdBySlug`
     (race-resilient toggle preserved; repos never catch P2002/P2025).
  6. **Comments** → `CommentRepository` (email never selected; status filter; post include);
     reuses `PostRepository.findPublishedIdBySlug`.
- **Adversarial review** of the simple-CRUD batch (Settings/SEO/Tags/Categories): two
  independent skeptics — behaviour-preservation found **0** issues; correctness found only
  minors (one type-honesty nit fixed).
- **ALL 12 service domains now refactored** (added after the 7-domain checkpoint):
  Media, Likes, Comments, Search, Pages, Posts (+Revisions), and Auth (Users/Accounts/
  Roles). The **one genuine fat controller** (`admin.controller.ts`) was fixed via a new
  `AdminService` + `UserRepository.count()`/`RoleRepository.count()`.
- **Verified end state:** `grep` confirms **no `this.prisma` / `@Inject(PRISMA)` in any
  service or controller** (only the allowed `health` `DATABASE_PINGER` + the repo DI
  factory use the singleton). Controllers are all thin.
- **Adversarial reviews** run per high-risk domain (Posts/Pages, Auth security + behaviour):
  **0 behaviour-preservation findings**; only minors, accepted/fixed.
- **Coverage gate** (V8): services + repositories **86.2% statements / 86.2% lines /
  86.2% branches / 80.9% functions** — `vitest.config.ts` now enforces an 80% threshold
  (the run fails below it). Critical paths covered.
- **Quality gates green:** `pnpm test` = **48 files / 268 tests**, `pnpm typecheck` clean,
  `pnpm lint` clean (whole repo), `pnpm vitest run --coverage` exits 0.
- A **completeness-critic** pass found no blockers; its two SHOULD-FIX items (enforce the
  coverage threshold; refresh this HANDOFF) are resolved here.

## PENDING (Task 2 + Task 4 are DONE — these are the remaining engagement tasks)
1. **Task 1 — feature parity** (`REFACTOR_PLAN.md` §7): per-locale content translation,
   per-content SEO meta, password reset + transactional email, menu builder, contact form,
   GA4/GTM, auto thumbnails, plugin admin UI, Redis cache, and the shared net-new
   (revision-restore UI, scheduled publishing, RSS, comment-notification email). These bring
   DB migrations (ship reversible) and will attach side-effects to the observer per §2.7.
2. **Task 3 — UI** (`REFACTOR_PLAN.md` §8): conform public site + admin to
   `../DESIGN_SYSTEM.md`; Lighthouse ≥95 mobile + WCAG AA, measured.
3. **Task 5 — README**: rewrite to match the other two stacks' READMEs (architecture now
   includes the repository layer — a short note was added; a fuller rewrite belongs with
   Task 1/3 when the feature set settles).
4. **E2E (Playwright)**: re-run `pnpm e2e` against a running stack to confirm the refactor
   is black-box-invariant (needs a DB + web/api up; not run in this unit-only pass).

### Carry-over notes
- Pre-existing biome debt in 13 unrelated files was format-only cleaned in the coverage
  commit so the lint gate is green; no behaviour touched.
- Two accepted minors (not regressions): `RevisionCreateData` permits both postId+pageId
  (callers never do); `recaptcha.service.ts` low coverage is pre-existing/out-of-scope.

**Conventions established (reuse for remaining domains):**
- Repo file exports `interface`, `X_REPOSITORY` Symbol, `PrismaXRepository`; trivial repos
  extend `PrismaCrudRepository` (super(prisma.<model>)) for `exists`/`hardDelete`.
- Module wiring: `provideRepository(TOKEN, PrismaImpl)` in the feature module's providers.
- Service tests use fakes typed `Record<keyof XRepository, Mock>` cast `as unknown as X`.
- Tests/services import model + repo types from `@cmstack-ts/db` (NOT `@prisma/client`).
- `$transaction` stays the array-batch form; repos never catch P2002/P2025.

## Decisions / rejected options
- **Operator chose a FULL repository layer** for all domains (over my
  hybrid/keep-as-is recommendation) for cross-stack parity; consciously overrides
  CLAUDE.md "no speculative abstraction" — for the repository layer only.
- **Repos return Prisma payload types** (not DDD entities): buys testability + query
  encapsulation, NOT store portability (accepted; no entity mappers).
- **Observer:** service emits where side effect is real; repo pure (operator choice).
- **`export * from '@prisma/client'`** in `packages/db` (was minimal `{Prisma,
  PrismaClient}`) so consumers get model types without depending on `@prisma/client`.

## Open questions
- None blocking. Matrix-gap flags: none found yet (recorded in plan §7).

## How to run
- Install: `pnpm install` (Node ≥22). Tests: `pnpm test` (single: `pnpm vitest run
  <path>`). Lint: `pnpm lint` / fix `pnpm format`. Types: `pnpm typecheck` (builds
  packages first). E2E: `pnpm e2e`.
- Per-domain loop: write repo contract test (mock Prisma) → impl → service test (fake
  repo) → refactor service → wire module → `pnpm test` + biome + typecheck → commit →
  adversarial skeptics.

### Full stack for LIVE verification (the recipe used for §7 #1–#3, copy verbatim)
The unit suite mocks Prisma and needs no DB; **live** checks (curl the API, SSR the web,
`pnpm e2e` against a real stack) need db + api + web up. Gotcha: `packages/db` does NOT
auto-load the root `.env`, so pass `DATABASE_URL` explicitly to every prisma command. The
docker compose DB is named **`typress`** (legacy creds `typress/typress/typress`).
```bash
cd cmstack-ts
docker compose up -d db                       # postgres on :5432 (named volume; persists)
export DATABASE_URL="postgresql://typress:typress@localhost:5432/typress?schema=public"
pnpm db:generate
pnpm --filter @cmstack-ts/db exec prisma migrate deploy   # apply migrations
pnpm db:seed                                  # idempotent demo seed (admin@cmstack-ts.local / admin12345)
# Build (Next inlines NEXT_PUBLIC_* at BUILD time, so export before `pnpm build`):
export NEXT_PUBLIC_API_URL=http://localhost:4000 NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
  AUTH_URL=http://localhost:3000 AUTH_SECRET=dev-only-change-me-32+chars-please \
  INTERNAL_API_SECRET=dev-only-change-me-internal-secret API_INTERNAL_URL=http://localhost:4000 \
  WEB_ORIGIN=http://localhost:3000 NODE_ENV=production
pnpm build
# Run API (needs DATABASE_URL + AUTH_SECRET + INTERNAL_API_SECRET + WEB_ORIGIN + UPLOAD_DIR exported):
UPLOAD_DIR=uploads node apps/api/dist/main.js &          # health: curl 127.0.0.1:4000/health/ready
pnpm --filter @cmstack-ts/web start &                    # next start on :3000 (reuses the exported env)
pnpm e2e                                                  # 11/11 (web-alone; live API checks are manual curl)
```
- **Password-reset live check:** with `SMTP_HOST` unset the mailer logs the reset link to
  the API stdout — grep it: `grep -oE "reset-password\?token=[a-f0-9]+" <api-log>`.
- **Reset the admin password** if a live test changed it: re-run request→confirm with
  `admin12345`, or it's a throwaway dev DB.

## Gotchas
- **`Write`-tool artifact:** files written via the Write tool get a stray `</content>`
  line appended — strip it (`perl -0pi -e 's/\n?<\/content>\s*$//' <file>`) and
  re-run `pnpm format` (also restores the final newline biome wants) before testing.
- Vitest resolves `@cmstack-ts/{db,config}` to `src` (no build needed for tests);
  `pnpm typecheck` DOES build packages to `dist` first.
- `packages/db` is CommonJS; `apps/api` CommonJS (Nest); `apps/web`/`apps/mcp` ESM.
- **Playwright e2e:** if `pnpm e2e` fails with `Executable doesn't exist … chromium_headless_shell-1148`,
  install the matching browser once: `pnpm exec playwright install chromium-headless-shell` (the e2e
  runner pins build **1148**; a generic `playwright install chromium` may fetch a newer build and not
  satisfy it). Then re-run `pnpm e2e`.
- Reply to the operator in **Russian**; code/comments/docs in **English**.

---

## Continuation prompt (paste into a fresh window)
> You are continuing the `cmstack-ts` engagement (senior TS engineer, autonomous).
> Working dir `/Users/huseyn0w/Desktop/SWE/cmstack/cmstack-ts`, branch
> `refactor/repository-layer` (clean tree, all committed; **463 tests, typecheck + biome
> clean, coverage gate ≥80% (actual 90.19%)**). **DONE:** Task 2 (repository-layer refactor) + Task 4
> (tests); the E2E baseline re-run (11/11, refactor confirmed black-box-invariant); and
> **Task 1 §7 items #1 (per-locale content translation), #2 (per-content SEO meta), #3
> (password reset + transactional email), #4 (menu management), #5 (contact form + email),
> #6 (GA4/GTM + site verification + basic consent), #7 (auto thumbnails / image processing),
> #8 (dashboard translation editing UI), #9 (plugin admin UI + runtime toggle + render regions),
> #10 (caching layer — Redis/memory, event-driven invalidation via `HookRegistry`)** —
> all live-verified. **The §7 register is now fully ticked.** **Read first:**
> `cmstack-ts/HANDOFF.md` (the Task-1 progress section + "Full stack for LIVE verification"
> recipe + Gotchas), `cmstack-ts/REFACTOR_PLAN.md` (§2.0 layering, §2.7 observer policy,
> §7 feature register with #1–#10 checked, §10 invariants), `cmstack-ts/CLAUDE.md`, and the
> read-only canon `../FEATURE_MATRIX.md` + `../DESIGN_SYSTEM.md` (do NOT edit the canon).
> The design+plan docs for finished items are in `docs/superpowers/{specs,plans}/`.
>
> **Resume with the Task 1 shared net-new** (operator directive): revision-restore UI,
> scheduled publishing, RSS/Atom feeds, comment-notification email. Then Task 3 (UI §8) +
> Task 5 (full README rewrite). **Observer note:** §7 #5 wired the first real side effect
> (`contact.submitted` → mail listener); §7 #10 added four cache-invalidation events
> (`content.changed`/`settings.theme.changed`/`menu.changed`/`seo.changed`); the
> comment-notification email (shared net-new) is the next observer consumer. **Cache note:**
> a new side effect that changes a cached public read should `emit` the matching `*.changed`
> event (or add a new one + a `CacheInvalidationListener` line) so the cache stays correct.
>
> Per-feature loop (proven this session): brainstorm scope if unclear → spec+plan under
> `docs/superpowers/` → TDD by layer (config schema → prisma migration (additive/reversible)
> → repository (+contract test) → service (+fake-repo test) → thin controller → web) → wire
> through the EXISTING three-layer pattern (never `this.prisma` in a service) → observer
> (`HookRegistry`) only on a real side effect (§2.7) → run full gates (`pnpm test` /
> `typecheck` / `lint` / `pnpm vitest run --coverage`) → rebuild + `pnpm e2e` + **live curl/SSR
> verification** (use the HANDOFF stack recipe) → adversarial self-review (inline, do NOT
> spawn parallel agents — the operator dislikes the permission prompts) → refresh HANDOFF +
> tick the §7 box → commit.
>
> Operating rules (operator-set, see saved memories): **work fully autonomously** — only ask
> when truly critical; **NO `Co-Authored-By`/Claude trailer in commit messages**; reply to the
> operator in **Russian**, code/comments/docs in English. Show real command output — never claim
> green without the run. Conventions: repo = interface + `X_REPOSITORY` Symbol +
> `PrismaXRepository` (trivial ones extend `PrismaCrudRepository`); wire via
> `provideRepository(TOKEN, Impl)`; service test fakes typed `Record<keyof XRepo, Mock>`; import
> model+repo types from `@cmstack-ts/db` (never `@prisma/client`); repos never catch P2002/P2025;
> locales come from `@cmstack-ts/config` `LOCALES`/`DEFAULT_LOCALE`. **Gotcha:** if the Write tool
> appends a stray `</content>` line, strip it (`perl -0pi -e 's/\n?<\/content>\s*$//' <file>`) +
> `pnpm format`. The docker `db` container is likely already up (named DB `typress`); `packages/db`
> needs `DATABASE_URL` passed explicitly to prisma commands.