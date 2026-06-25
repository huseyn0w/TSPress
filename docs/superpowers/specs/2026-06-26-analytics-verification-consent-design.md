# §7 #6 — GA4/GTM, site verification & basic consent — Design

**Date:** 2026-06-26 · **Status:** approved · **Feature register:** `REFACTOR_PLAN.md` §7 #6

## Goal

Bring `cmstack-ts` to feature parity for analytics & search-engine ownership:

1. **GA4 + GTM injection** on the **public site only**, driven by settings (measurement
   IDs edited in the admin SEO screen — no code change to switch them).
2. **Site-verification meta tags** for the platforms that actually support an HTML
   `<meta>` ownership mechanism: Google, Bing, Yandex, Meta/Facebook, Pinterest, plus an
   **open list of arbitrary `{name, content}` pairs** for anything else (future-proof, no
   migration to add one). Platforms with no meta mechanism (LinkedIn/Instagram/UpWork and
   the AI engines ChatGPT/Claude/Perplexity/Gemini/xAI) are intentionally **not** faked —
   AI/crawler discoverability is already served by `robots.txt` + `llms.txt` (Phase 7).
3. A **basic consent banner**: analytics scripts load only after the visitor accepts.

Non-secret by nature (IDs/tokens end up in public HTML), so all of this is safe to expose
through the existing unauthenticated `GET /public/seo` payload.

## Decisions

- **Storage:** new columns on the singleton `SiteProfile` (the org-level SEO record that is
  already surfaced publicly and edited as one admin form). No new aggregate.
- **Arbitrary verification tags:** a **`Json` column** (`customVerificationTags`), not a
  separate `SiteVerificationTag` table + repository + CRUD. Rationale: it is a niche
  escape-hatch on a singleton edited by one form; a Json array keeps it to one migration and
  no new module. Shape is validated by Zod, so it stays typed. (Trade-off accepted over the
  project's otherwise-relational style.)
- **Analytics injection:** `@next/third-parties/google` (`GoogleAnalytics`,
  `GoogleTagManager`) — the official Next package (operator choice over hand-rolled
  `next/script`).
- **Public-only boundary:** scripts + verification render from `app/[locale]/layout.tsx`
  (the sole wrapper of the localized public site). `admin`/`account`/`signin`/`signup` live
  at the app root, outside locale routing, and are never touched.
- **No observer event** (§2.7): updating the profile has no real side effect.

## Data model (one additive, reversible migration)

New columns on `SiteProfile`, all `@default("")` except the Json default `"[]"`:

| Column                       | Type   | Notes                                  |
| ---------------------------- | ------ | -------------------------------------- |
| `ga4MeasurementId`           | String | `G-XXXXXXX` or empty                   |
| `gtmContainerId`             | String | `GTM-XXXXXX` or empty                  |
| `googleSiteVerification`     | String | token only (not the full meta tag)     |
| `bingSiteVerification`       | String | → `<meta name="msvalidate.01">`        |
| `yandexVerification`         | String | → `<meta name="yandex-verification">`  |
| `facebookDomainVerification` | String | → `<meta name="facebook-domain-verification">` |
| `pinterestVerification`      | String | → `<meta name="p:domain_verify">`      |
| `customVerificationTags`     | Json   | `Array<{ name, content }>`, default `[]` |

## Contracts (`@cmstack-ts/config`, `seo.ts`)

Extend `updateSiteProfileSchema` (admin write) and `siteProfileSchema` (public read) with
the new fields. **Strict validation** (defense-in-depth — React already escapes attributes):

- `ga4MeasurementId`: `^G-[A-Z0-9]+$` or `''` (max 32).
- `gtmContainerId`: `^GTM-[A-Z0-9]+$` or `''` (max 32).
- Verification tokens: a safe charset excluding `< > " '` and whitespace
  (`^[A-Za-z0-9._:\-+/=]+$`) or `''` (max 256).
- `verificationTagSchema = { name, content }`: `name` a safe meta-name charset
  (`^[A-Za-z0-9._:\-]+$`, max 100), `content` the token charset (max 256); array capped at
  **20** entries, default `[]`.

**Pure builder** `buildVerificationMeta(profile)` (unit-tested) → an object shaped for Next's
`Metadata`: `{ google, yandex }` under `verification`, everything else (Bing/Meta/Pinterest +
custom pairs) merged into a `name → content` map for `verification.other` / `other`. Empty
fields are skipped; duplicate/blank custom names are dropped.

## API

- `SeoService.DEFAULT_PROFILE`, `toProfile`, and the public/admin getters gain the new
  fields. `updateProfile` already forwards the whole validated input into
  `SiteProfileRepository.upsert`, which writes the full writable row — so the new columns
  flow through unchanged. `customVerificationTags` (Zod-typed array) is assigned to the Json
  column.
- `SiteProfileWritableData` widens automatically (`Omit<SiteProfile, 'id'|'updatedAt'>`).
- Admin `GET/PUT /seo/profile` and public `GET /public/seo` carry the new fields. No new
  routes, no CASL change (same `Seo` subject).

## Web (public site only)

- **Verification:** `generateMetadata` in `app/[locale]/layout.tsx` calls the pure builder
  and returns `{ verification, other }`; Next renders the `<meta>` tags. Admin/auth pages
  (root layout) are unaffected.
- **Analytics + consent:**
  - The server `LocaleLayout` reads the `ts-consent` cookie via `cookies()` and renders a
    client `<AnalyticsLoader initialConsent gaId gtmId>`.
  - `<AnalyticsLoader>`: `undecided` → render `<ConsentBanner>` (Accept / Decline; strings
    from next-intl, **en/de/ru parity**); `accepted` → render `<GoogleAnalytics gaId>`
    and/or `<GoogleTagManager gtmId>` (only for non-empty ids); `declined` → render nothing.
    The choice is persisted to the `ts-consent` cookie so SSR reads it on the next load (no
    banner flash). A "manage/change" affordance is out of scope for #6 (the cookie can be
    cleared); revisiting consent UI belongs to the future GDPR module.
- `getSeoContent` `FALLBACK` and the public schema parse gain the new fields.
- **New dependency:** `@next/third-parties` in `apps/web`.

## Seed

Leave `ga4MeasurementId`/`gtmContainerId` **empty** (so the demo never fires a fake GA hit),
but seed one example `googleSiteVerification` token and one `customVerificationTags` pair so
the feature is visible in the live demo.

## Testing (TDD by layer)

- **config:** schema accepts valid GA4/GTM/tokens/custom tags, rejects malformed ids, a
  token with `<`, an over-long list, a blank custom name.
- **builder:** `buildVerificationMeta` emits the right map, skips empties, includes custom
  pairs, drops malformed/duplicate names.
- **service:** fake-repo test — new fields appear in `getProfile`/`getPublicContent` and are
  written by `updateProfile`.
- **repository:** contract test — `upsert` persists the new columns (incl. the Json array).
- **Consent UI** (client) is covered by live/e2e verification, not unit tests; unit coverage
  stays on the pure logic. Coverage gate ≥80% must hold.

## Out of scope (logged, not silent)

Google Consent Mode v2, granular cookie categories, a consent audit log, and a persistent
"manage cookies" surface — these constitute a full GDPR module and are deferred. #6 ships the
minimal "load analytics only after Accept" behavior. AI-engine "verification" is not faked;
`robots.txt`/`llms.txt` already serve that discoverability.
