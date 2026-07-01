# Spec + Plan — Category/Tag name translation (per-locale)

**Date:** 2026-07-01 · **Status:** DONE (585 tests, typecheck/lint clean, coverage 89.39%,
e2e 11/11; live-verified) · **Owner:** engagement (autonomous)

Fast-follow of §7 #1 (per-locale content translation) and §7 #8 (translation editing
UI): the last genuine multilingual parity gap. Post/Page content already translates
per-locale; taxonomy term **names** (Category, Tag) do not, so on `/de` and `/ru` the
category/tag chips on posts still show the English name. This closes that gap by
mirroring the proven `PostTranslation`/`PageTranslation` pattern, scaled down to a
single translatable field (**name**).

## Scope

- **Translate:** `Category.name` and `Tag.name` per non-default locale (de/ru), with
  per-field fallback to the base (en) value at read time — identical policy to
  `localizeContent`.
- **Do NOT translate (scoped out, logged):** `Category.description` (no public surface
  anywhere — not even the base value is rendered publicly; translating it is pure
  speculation); `slug` (shared by design, like Post/Page); taxonomy structure.
- **Public surface:** term names surface only as **post chips** (categories/tags on a
  post summary/detail) and the `?category=` blog filter — both already flow `?locale=`
  through the localized post read (§7 #1). No public category/tag archive page exists,
  so no new public route. The managed-menu category items already localize via
  `MenuItemTranslation` — untouched.
- **Admin:** English UI (per project rule). Category/Tag editing is dialog-based inline
  CRUD, so per-locale **name** inputs go directly inside the edit dialog (compact),
  prefilled from the term's translation rows; save = base update + per-locale
  upsert/delete via new endpoints.

## Design (mirrors §7 #1)

### Model (additive, reversible migration `term_translations`)
```
model CategoryTranslation {
  id, categoryId (FK cascade), locale, name String?, createdAt, updatedAt
  @@unique([categoryId, locale]); @@index([locale])
}
model TagTranslation { ... tagId ... }  // same shape
```
`name` nullable → a missing field falls back to base at read time. Category/Tag gain a
`translations` relation.

### Config (`packages/config/src/content.ts`)
- `termTranslationInputSchema = { name: string.trim().min(1).max(120).optional() }`
  (shared for both; both term names are max 120). An empty/absent name = no override
  → the service clears the row (all-empty = delete), exactly like post translations.
- `termTranslationSchema = { locale, name: string.nullable() }` (output row).
- Reused by both Category and Tag (a term is a term).

### Repositories (`packages/db`)
- `CategoryRepository` / `TagRepository` gain:
  - `list()` and `findById*` include `translations` (all rows — admin needs them).
  - `findByIdWithTranslations(id)` (admin edit prefill; `list` already carries them so
    this may just be `findById` returning translations).
  - `upsertTranslation(id, locale, { name })` — full-row replace (`name ?? null`).
  - `deleteTranslation(id, locale)` — repo never catches P2025 (service does).
- `PostRepository.localizedPostInclude(locale)` additionally includes the term
  translations for that locale on `categories`/`tags`:
  `categories: { include: { translations: { where: { locale } } } }` (same for tags).
  The **base** `postInclude` (default-locale reads) is **unchanged** → default reads stay
  byte-identical (invariant §10). `LocalizedPost` widens so each term optionally carries
  `translations?: { name: string | null }[]`.

### Services
- `CategoriesService`/`TagsService`: `findById` returns a view with `translations`;
  new `upsertTranslation(id, locale, input)` (drop empty name → delete row) +
  `deleteTranslation(id, locale)` (idempotent; swallow P2025). No observer event — a
  term-name change has no cached public read of its own (post reads ARE cached, but the
  term name is only reachable through a post; a category rename is rare and the post
  cache TTL bounds staleness — consistent with §7 #1 which emits no event for a Post
  translation change either... **actually** §7 #1 DOES `emit('content.changed')` on a
  post translation. A term rename affects cached post lists/details. So: emit
  `content.changed` (posts namespace) on a term translation upsert/delete so localized
  post reads re-render. Cheap and correct.)
- `PostsService.toSummary`: overlay each term name with
  `term.translations?.[0]?.name ?? term.name` (present only on localized reads).

### Controllers (thin, CASL-gated on the existing `Category`/`Tag` subjects)
- `PUT /categories/:id/translations/:locale` + `DELETE …` — `update Category`.
- `PUT /tags/:id/translations/:locale` + `DELETE …` — `update Tag`.
- `locale` validated by `localeSchema`; body by `termTranslationInputSchema`.

### Web
- `CategoryView`/`TagView` (`apps/web/types/content.ts`) gain `translations`.
- Edit dialog (categories-client / tags-client): a compact "Translations" block with a
  **name** input per override locale (de/ru), prefilled; on Save, run the base
  update then per-locale upsert/delete server actions.
- New server actions `upsert/deleteCategoryTranslationAction`,
  `upsert/deleteTagTranslationAction`.
- Public chips: **no change** — the API already returns the localized name.

### Seed
- Add de/ru name translations for a couple of demo categories/tags (idempotent upsert).

## Invariants / risks
- Default-locale reads byte-identical (base `postInclude` untouched).
- Repos never catch P2002/P2025; services map them.
- Term name is plain text (no HTML) → nothing to sanitize.
- `emit('content.changed')` on a term translation write keeps the §7 #10 post cache correct.

## Test plan (TDD by layer)
- config: schema accept/reject (name length, empty). 
- repo: upsert full-row replace, delete, list includes translations, post localized
  include carries term translations (contract test with mock Prisma).
- service: overlay fallback (present → override, null/absent → base); empty name → delete;
  P2025 delete → no-op; emit content.changed.
- posts.service: `toSummary` localizes term names on a localized read; default read
  unchanged.
- web: reuse existing helpers; smoke via build + live SSR.

## Out of scope (logged)
Category description translation; category/tag archive pages; machine translation;
per-locale slugs; translation completeness indicators.
