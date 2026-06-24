# Per-locale content translation (Post + Page) — design

**Date:** 2026-06-24 · **Engagement task:** Task 1 (feature parity), `REFACTOR_PLAN.md` §7 #1
**Branch:** `refactor/repository-layer` · **Canon:** `../FEATURE_MATRIX.md` rows 126/127/131/102/36 (read-only)

## Goal

Translatable content (title / excerpt / body / meta) per locale for Post and Page,
with shared structural fields (slug / status / author / publishedAt / taxonomy) and
fallback to the default locale when a translation is missing. Locales: `en` (default,
unprefixed), `de`, `ru` — matching the shipped next-intl routing.

## Model decision (operator-approved)

**B3 — "base = default locale, translation table = overrides."** The existing
`Post`/`Page` columns remain the canonical **en** values (no data migration, existing
en read/write/search path untouched). New `PostTranslation`/`PageTranslation` tables
hold only `de`/`ru`. Public reads overlay the translation onto the base **per field**
(`translation.field ?? base.field`); a `null` field falls back to base.

Rejected: strict parler/astrotomic (move all translatable fields incl. en into the
translation table) — canonically cleaner but requires a data backfill and rewrites every
query/DTO/search/admin path on a freshly-refactored repository layer. High blast radius
for no user-visible behaviour difference (B3 delivers the same translatable-fields +
shared-structure + fallback contract).

## Scope

**In:** Post + Page translatable `title`, `excerpt` (Post only), `content`,
`metaTitle`, `metaDescription`; locale-aware public read with fallback; admin
translation write (sub-resource endpoints); web public pages forward the active locale;
seed gains de/ru demo translations.

**Explicitly deferred (noted so consumers attach cleanly later):**
- Admin per-locale tab-strip editing UI → §7 #8 (this slice ships the API it calls).
- Rendering meta into `<head>` + `canonical`/`noindex` → §7 #2 (this slice stores +
  returns meta; #2 surfaces it).
- Multilingual full-text search over de/ru → future (canon rates ts search non-multilingual,
  `❌`). Search stays on the base/en columns; de/ru content is not indexed yet. Logged, not silent.
- Category/Tag name/description translation → fast-follow (same mechanism), out of this slice.

## Data model

Add to `Post`: `metaTitle String?`, `metaDescription String?`, `translations PostTranslation[]`.
Add to `Page`: `metaTitle String?`, `metaDescription String?`, `translations PageTranslation[]`.

```prisma
model PostTranslation {
  id              String   @id @default(cuid())
  postId          String
  post            Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  locale          String   // 'de' | 'ru' — en lives on the base Post
  title           String?
  excerpt         String?
  content         String?  // sanitized HTML when present
  metaTitle       String?
  metaDescription String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([postId, locale])
  @@index([locale])
}

model PageTranslation {
  id              String   @id @default(cuid())
  pageId          String
  page            Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  locale          String   // 'de' | 'ru'
  title           String?
  content         String?
  metaTitle       String?
  metaDescription String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([pageId, locale])
  @@index([locale])
}
```

Nullable translatable fields → per-field fallback. `onDelete: Cascade` (translations die
with their content). Migration is reversible (`migrate:dev`, additive only).

## `packages/config`

- New single source of locales: `LOCALES = ['en','de','ru'] as const`, `DEFAULT_LOCALE = 'en'`,
  `localeSchema = z.enum(LOCALES)`. `apps/web/i18n/routing.ts` imports these (removes the
  duplicate literal — drift guard).
- `createPostSchema`/`createPageSchema` gain optional `metaTitle` (≤200), `metaDescription`
  (≤300); `update*` inherit via `.partial()`.
- `translationInputSchema`: all fields optional (`title?/excerpt?/content?/metaTitle?/metaDescription?`)
  — Page variant omits `excerpt`. Empty object (all absent) is a valid "clear" → service deletes the row.
- `postTranslationSchema`/`pageTranslationSchema` (output): `{ locale, title, excerpt?, content,
  metaTitle, metaDescription }` nullable fields.
- Admin detail schemas (`postDetailSchema`/`pageDetailSchema`) gain `translations: [...]` +
  base `metaTitle`/`metaDescription` (nullable). Public detail gains nullable `metaTitle`/`metaDescription`
  (stored now, rendered in #2). Public summary unchanged in shape (localized values fill the existing fields).

## Repository (`packages/db`, aggregate cohesion — no separate translation repo)

`PostRepository` / `PageRepository` gain:
- Locale-aware finders: `findPublicBySlug(slug, locale)`, `listAndCount(filter, locale)`,
  `publicByAuthor(authorId, locale)` (Post). For `locale !== 'en'` add
  `include: { translations: { where: { locale } } }` (0-or-1 row per record); for `en` the
  existing include is used unchanged (cheap, identical query).
- `findByIdWithTranslations(id)` for admin GET — base include + all translations.
- `upsertTranslation(contentId, locale, data)` — `upsert` on the `@@unique([postId, locale])`;
  `deleteTranslation(contentId, locale)`. Repo stays framework-free; never catches P2002/P2025 (§2.4).

The `PostWithRelations` / `PageWithAuthor` payload aliases extend to optionally carry the
`translations` array (the localized include is a distinct exported `include` constant).

## Service

- Pure resolver `localizeContent(base, translation | null, locale)` in a small framework-free
  module (unit-tested in isolation): returns the localized field set with per-field fallback;
  `en` or `null` translation → base values verbatim. Used by `findPublicBySlug`, the list mapper,
  and `publicByAuthor`.
- `PostsService`/`PagesService` public reads take a `locale` arg, fetch with that locale, run the
  resolver before the existing `toSummary`/`toDetail` mappers (output shape byte-identical, values
  localized).
- Translation write: `upsertTranslation(id, locale, input, authorId)` — sanitizes `content` (and
  passes title/excerpt/meta through), upserts via repo; an all-empty input deletes the row.
  `deleteTranslation(id, locale)`. `404` when the base content is missing/trashed (service maps,
  repo returns null). No observer event (§2.7 — no genuine side effect).

## Controllers

- `PublicContentController`: `GET /public/posts`, `/public/posts/:slug`, `/public/pages/:slug`
  read `?locale=` via `localeSchema` (parse failure / absent → `en`). Authors read forwards locale.
- `PostsController`/`PagesController` (admin, CASL `update Post`/`update Page`):
  `PUT /:id/translations/:locale` (body `translationInputSchema`, `ZodValidationPipe`),
  `DELETE /:id/translations/:locale`. `GET /:id` returns base + `translations`.
  Controllers stay thin (parse + delegate).

## Web (public)

Forward the route `[locale]` to the API as `?locale=`:
- `app/[locale]/blog/page.tsx` (index), `app/[locale]/blog/[slug]/page.tsx`,
  `app/[locale]/pages/[slug]` (if present), `app/[locale]/authors/[id]/page.tsx`.
- hreflang/`alternates` already emitted via `alternatesFor`; unchanged (fallback guarantees content
  exists at every advertised locale).

## Seed

Add de + ru `PostTranslation` rows to 1–2 demo posts and a `PageTranslation` to one page (idempotent
upsert by `[contentId, locale]`), so the localized public pages and any manual/e2e check show real
translated content.

## Tests (coverage gate ≥80% stays green)

- Repo contract (mocked Prisma): localized include is added only for non-en; `upsertTranslation`
  issues an upsert on the composite key; `deleteTranslation` deletes by composite key; en path
  unchanged.
- Service: resolver fallback (per-field, en-passthrough, null-translation); translation content is
  sanitized on upsert; all-empty input deletes; 404 on missing base; locale passthrough on reads.
- Config: `localeSchema` rejects junk; `translationInputSchema` accepts empty + partial.
- Pure resolver: standalone unit test (the payoff of isolating it).
- Then 2–3 independent adversarial Opus skeptics (behaviour/security): no email/private field leak
  via the translation include; sanitize applied to translated HTML; fallback correctness; CASL gates
  the translation writes; en read path is byte-identical.

## Invariants preserved

- Existing en read/write/search path unchanged (B3). DTO output shapes unchanged (values localized).
- Repo never catches P2002/P2025; `$transaction` array form for list; service owns HTTP mapping + sanitize.
- `slug` global-unique and shared across locales; locale differentiation is the URL prefix only.

## Rollback

Single additive, reversible migration; the feature is one logical unit. Revert = drop the two tables
+ the four base columns and revert the code commit(s).
