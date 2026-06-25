# GA4/GTM, Site Verification & Basic Consent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add settings-driven GA4 + GTM injection, search-engine site-verification meta tags, and a basic consent banner to the public site of `cmstack-ts`.

**Architecture:** New columns on the singleton `SiteProfile` carry the measurement IDs, named verification tokens, and a Json array of arbitrary `{name,content}` verification pairs. Shared Zod schemas validate them; a pure `buildVerificationMeta` builder turns the profile into Next `Metadata`. The public localized layout (`app/[locale]/layout.tsx`) renders verification `<meta>` and a consent-gated `<AnalyticsLoader>` (using `@next/third-parties/google`). Admin/auth surfaces (root layout) are untouched.

**Tech Stack:** NestJS (API, CommonJS), Prisma/Postgres, Next.js App Router (web, ESM), next-intl, `@next/third-parties`, Zod (`@cmstack-ts/config`), Vitest, Biome.

## Global Constraints

- Reply to the operator in **Russian**; code/comments/docs in **English**.
- Repos never catch P2002/P2025; services hold logic; controllers thin (no change needed here — reusing `seo` module).
- Import model + repo types from `@cmstack-ts/db`, shared contracts from `@cmstack-ts/config` (never `@prisma/client` directly, never redefine schemas).
- Migrations are **additive and reversible**; `packages/db` needs `DATABASE_URL` passed explicitly to every prisma command.
- **No observer event** for the profile update (§2.7 — no real side effect).
- All gates must pass before commit: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm vitest run --coverage` (≥80%), then live curl/SSR + `pnpm e2e` (11/11).
- No `Co-Authored-By`/Claude trailer in the commit message.
- **Write-tool gotcha:** if a stray `</content>` line is appended, strip it (`perl -0pi -e 's/\n?<\/content>\s*$//' <file>`) and `pnpm format`.
- next-intl message keys must stay in **parity across en/de/ru**.

---

### Task 1: Config schemas + pure verification-meta builder

**Files:**
- Modify: `packages/config/src/seo.ts`
- Modify: `packages/config/src/index.ts` (export new symbols)
- Test: `packages/config/src/seo.test.ts`
- Create: `packages/config/src/verification.ts`
- Create: `packages/config/src/verification.test.ts`
- Modify: `packages/config/src/index.ts` (export builder)

**Interfaces:**
- Produces:
  - `verificationTagSchema` → `{ name: string; content: string }`
  - `VerificationTag` type
  - extended `updateSiteProfileSchema` / `siteProfileSchema` / `SiteProfile` / `UpdateSiteProfileInput` with: `ga4MeasurementId`, `gtmContainerId`, `googleSiteVerification`, `bingSiteVerification`, `yandexVerification`, `facebookDomainVerification`, `pinterestVerification` (all `string`), `customVerificationTags` (`VerificationTag[]`).
  - `buildVerificationMeta(profile: Pick<SiteProfile, ...verification fields>) => { google?: string; yandex?: string; other: Record<string,string> }`

- [ ] **Step 1: Write failing schema tests**

Add to `packages/config/src/seo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { updateSiteProfileSchema } from './seo';

describe('updateSiteProfileSchema — analytics & verification', () => {
  const base = { organizationName: 'Acme' };

  it('accepts a valid GA4 and GTM id', () => {
    const p = updateSiteProfileSchema.parse({
      ...base,
      ga4MeasurementId: 'G-ABC123',
      gtmContainerId: 'GTM-XYZ99',
    });
    expect(p.ga4MeasurementId).toBe('G-ABC123');
    expect(p.gtmContainerId).toBe('GTM-XYZ99');
  });

  it('defaults the new fields to empty / []', () => {
    const p = updateSiteProfileSchema.parse(base);
    expect(p.ga4MeasurementId).toBe('');
    expect(p.gtmContainerId).toBe('');
    expect(p.googleSiteVerification).toBe('');
    expect(p.customVerificationTags).toEqual([]);
  });

  it('rejects a malformed GA4 id', () => {
    expect(() => updateSiteProfileSchema.parse({ ...base, ga4MeasurementId: 'UA-123' })).toThrow();
  });

  it('rejects a malformed GTM id', () => {
    expect(() => updateSiteProfileSchema.parse({ ...base, gtmContainerId: 'GTM_bad' })).toThrow();
  });

  it('rejects a verification token containing angle brackets', () => {
    expect(() =>
      updateSiteProfileSchema.parse({ ...base, googleSiteVerification: 'abc<script>' }),
    ).toThrow();
  });

  it('accepts custom verification pairs and rejects a blank name', () => {
    const p = updateSiteProfileSchema.parse({
      ...base,
      customVerificationTags: [{ name: 'p:domain_verify', content: 'token123' }],
    });
    expect(p.customVerificationTags).toHaveLength(1);
    expect(() =>
      updateSiteProfileSchema.parse({ ...base, customVerificationTags: [{ name: '', content: 'x' }] }),
    ).toThrow();
  });

  it('caps the custom verification list at 20', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ name: `m${i}`, content: 'x' }));
    expect(() => updateSiteProfileSchema.parse({ ...base, customVerificationTags: many })).toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run packages/config/src/seo.test.ts`
Expected: FAIL (`ga4MeasurementId` undefined / no such key).

- [ ] **Step 3: Extend the schemas**

In `packages/config/src/seo.ts`, add above `updateSiteProfileSchema`:

```ts
/** Token-ish charset for verification meta values — excludes < > " ' and whitespace. */
const verificationToken = (max: number) =>
  z.literal('').or(z.string().trim().regex(/^[A-Za-z0-9._:\-+/=]+$/).max(max));

/** A single arbitrary verification meta tag. */
export const verificationTagSchema = z.object({
  name: z.string().trim().regex(/^[A-Za-z0-9._:\-]+$/).min(1).max(100),
  content: z.string().trim().regex(/^[A-Za-z0-9._:\-+/=]+$/).min(1).max(256),
});
export type VerificationTag = z.infer<typeof verificationTagSchema>;
```

Add these fields to the `updateSiteProfileSchema` object (after `contactEmail`):

```ts
  /** GA4 measurement id (`G-XXXX`) or empty. Public-site analytics. */
  ga4MeasurementId: z.literal('').or(z.string().trim().regex(/^G-[A-Z0-9]+$/).max(32)).default(''),
  /** GTM container id (`GTM-XXXX`) or empty. */
  gtmContainerId: z.literal('').or(z.string().trim().regex(/^GTM-[A-Z0-9]+$/).max(32)).default(''),
  googleSiteVerification: verificationToken(256).default(''),
  bingSiteVerification: verificationToken(256).default(''),
  yandexVerification: verificationToken(256).default(''),
  facebookDomainVerification: verificationToken(256).default(''),
  pinterestVerification: verificationToken(256).default(''),
  customVerificationTags: z.array(verificationTagSchema).max(20).default([]),
```

Add the same field names (as plain `z.string()` / array) to `siteProfileSchema`:

```ts
  ga4MeasurementId: z.string(),
  gtmContainerId: z.string(),
  googleSiteVerification: z.string(),
  bingSiteVerification: z.string(),
  yandexVerification: z.string(),
  facebookDomainVerification: z.string(),
  pinterestVerification: z.string(),
  customVerificationTags: z.array(verificationTagSchema).default([]),
```

- [ ] **Step 4: Run schema tests, verify pass**

Run: `pnpm vitest run packages/config/src/seo.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing builder test**

Create `packages/config/src/verification.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildVerificationMeta } from './verification';

const empty = {
  googleSiteVerification: '',
  bingSiteVerification: '',
  yandexVerification: '',
  facebookDomainVerification: '',
  pinterestVerification: '',
  customVerificationTags: [],
};

describe('buildVerificationMeta', () => {
  it('returns no google/yandex and an empty other map when nothing is set', () => {
    const m = buildVerificationMeta(empty);
    expect(m.google).toBeUndefined();
    expect(m.yandex).toBeUndefined();
    expect(m.other).toEqual({});
  });

  it('maps named tokens to google/yandex and the canonical other names', () => {
    const m = buildVerificationMeta({
      ...empty,
      googleSiteVerification: 'g-tok',
      yandexVerification: 'y-tok',
      bingSiteVerification: 'b-tok',
      facebookDomainVerification: 'fb-tok',
      pinterestVerification: 'pin-tok',
    });
    expect(m.google).toBe('g-tok');
    expect(m.yandex).toBe('y-tok');
    expect(m.other['msvalidate.01']).toBe('b-tok');
    expect(m.other['facebook-domain-verification']).toBe('fb-tok');
    expect(m.other['p:domain_verify']).toBe('pin-tok');
  });

  it('includes custom pairs and drops blank/duplicate names', () => {
    const m = buildVerificationMeta({
      ...empty,
      bingSiteVerification: 'b-tok',
      customVerificationTags: [
        { name: 'custom-one', content: 'c1' },
        { name: 'custom-one', content: 'c2' }, // duplicate name → first wins
        { name: 'msvalidate.01', content: 'override-ignored' }, // named field wins
      ],
    });
    expect(m.other['custom-one']).toBe('c1');
    expect(m.other['msvalidate.01']).toBe('b-tok');
  });
});
```

- [ ] **Step 6: Run, verify fail**

Run: `pnpm vitest run packages/config/src/verification.test.ts`
Expected: FAIL (`buildVerificationMeta` not found).

- [ ] **Step 7: Implement the builder**

Create `packages/config/src/verification.ts`:

```ts
import type { VerificationTag } from './seo';

/** The verification fields the builder reads off the site profile. */
export interface VerificationSource {
  googleSiteVerification: string;
  bingSiteVerification: string;
  yandexVerification: string;
  facebookDomainVerification: string;
  pinterestVerification: string;
  customVerificationTags: VerificationTag[];
}

export interface VerificationMeta {
  google?: string;
  yandex?: string;
  /** name → content for `<meta>` tags Next renders via `verification.other`. */
  other: Record<string, string>;
}

/**
 * Pure: turn a site profile's verification fields into a shape ready for Next's
 * `Metadata.verification`. Named fields take precedence over custom pairs that
 * reuse the same meta name; empty values and blank/duplicate custom names are
 * dropped. No HTML is produced here — Next escapes the rendered attributes.
 */
export function buildVerificationMeta(src: VerificationSource): VerificationMeta {
  const other: Record<string, string> = {};
  const put = (name: string, content: string) => {
    if (content) other[name] = content;
  };
  put('msvalidate.01', src.bingSiteVerification);
  put('facebook-domain-verification', src.facebookDomainVerification);
  put('p:domain_verify', src.pinterestVerification);
  for (const tag of src.customVerificationTags) {
    if (tag.name && tag.content && !(tag.name in other)) other[tag.name] = tag.content;
  }
  return {
    google: src.googleSiteVerification || undefined,
    yandex: src.yandexVerification || undefined,
    other,
  };
}
```

- [ ] **Step 8: Export from the barrel**

In `packages/config/src/index.ts`, add to the `seo` exports block:

```ts
  verificationTagSchema,
  type VerificationTag,
```

and add a new export line:

```ts
export { buildVerificationMeta, type VerificationMeta, type VerificationSource } from './verification';
```

- [ ] **Step 9: Run config suite + typecheck, verify pass**

Run: `pnpm vitest run packages/config && pnpm --filter @cmstack-ts/config build`
Expected: PASS, build clean.

- [ ] **Step 10: Commit**

```bash
git add packages/config/src/seo.ts packages/config/src/seo.test.ts \
  packages/config/src/verification.ts packages/config/src/verification.test.ts packages/config/src/index.ts
git commit -m "feat(config): analytics + verification site-profile schemas and meta builder"
```

---

### Task 2: Prisma migration — additive SiteProfile columns

**Files:**
- Modify: `packages/db/prisma/schema.prisma:285-297` (the `SiteProfile` model)
- Create: `packages/db/prisma/migrations/<timestamp>_analytics_verification/migration.sql` (generated)

**Interfaces:**
- Produces: `SiteProfile` row with new columns → widens `SiteProfileWritableData` (`Omit<SiteProfile,'id'|'updatedAt'>`) automatically.

- [ ] **Step 1: Edit the schema**

In `packages/db/prisma/schema.prisma`, inside `model SiteProfile`, after `contactEmail`:

```prisma
  /// GA4 measurement id (G-XXXX). Empty = analytics disabled.
  ga4MeasurementId           String   @default("")
  /// GTM container id (GTM-XXXX). Empty = disabled.
  gtmContainerId             String   @default("")
  /// Search-engine / platform ownership tokens (meta-tag value only).
  googleSiteVerification     String   @default("")
  bingSiteVerification       String   @default("")
  yandexVerification         String   @default("")
  facebookDomainVerification String   @default("")
  pinterestVerification      String   @default("")
  /// Arbitrary [{ name, content }] verification meta tags (future-proof escape hatch).
  customVerificationTags     Json     @default("[]")
```

- [ ] **Step 2: Generate the migration**

Run (DB up per HANDOFF recipe):

```bash
export DATABASE_URL="postgresql://typress:typress@localhost:5432/typress?schema=public"
pnpm --filter @cmstack-ts/db exec prisma migrate dev --name analytics_verification
```

Expected: a new migration folder; `ALTER TABLE "SiteProfile" ADD COLUMN ...` (8 columns), all with defaults (no data loss). Verify the SQL is purely additive.

- [ ] **Step 3: Regenerate the client + typecheck**

Run: `pnpm db:generate && pnpm --filter @cmstack-ts/db build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): additive SiteProfile columns for analytics + verification"
```

---

### Task 3: API service wiring + repository contract

**Files:**
- Modify: `apps/api/src/seo/seo.service.ts:23-31,134-144` (DEFAULT_PROFILE, toProfile)
- Modify: `apps/api/src/seo/seo.service.spec.ts` (fake-repo coverage of new fields)
- Test: `packages/db/src/repositories/site-profile.repository.spec.ts` (create if absent)

**Interfaces:**
- Consumes: extended `SiteProfile`/`UpdateSiteProfileInput` from Task 1; widened `SiteProfileWritableData` from Task 2.
- Produces: `getProfile`/`getPublicContent`/`updateProfile` round-trip the new fields.

- [ ] **Step 1: Write the failing service test**

Add to `apps/api/src/seo/seo.service.spec.ts` a test that the fake profile repo's `upsert` receives and returns the new fields, and `toProfile` surfaces them. Use the existing fake-repo pattern in that file. Example assertion block:

```ts
it('persists and returns analytics + verification fields', async () => {
  const input = {
    organizationName: 'Acme',
    tagline: '', description: '', url: '', logoUrl: '', geoStatement: '', contactEmail: '',
    ga4MeasurementId: 'G-ABC123',
    gtmContainerId: 'GTM-XYZ99',
    googleSiteVerification: 'g-tok',
    bingSiteVerification: '', yandexVerification: '',
    facebookDomainVerification: '', pinterestVerification: '',
    customVerificationTags: [{ name: 'p:domain_verify', content: 'pin' }],
  };
  profiles.upsert.mockResolvedValue({ id: 'default', updatedAt: new Date(), ...input });
  const out = await service.updateProfile(input as never);
  expect(profiles.upsert).toHaveBeenCalledWith(input);
  expect(out.ga4MeasurementId).toBe('G-ABC123');
  expect(out.customVerificationTags).toEqual([{ name: 'p:domain_verify', content: 'pin' }]);
});
```

(Match the variable names already used in the spec file — read it first; the fake repo there is likely named `profiles`.)

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run apps/api/src/seo/seo.service.spec.ts`
Expected: FAIL (`out.ga4MeasurementId` undefined — `toProfile` drops it).

- [ ] **Step 3: Extend DEFAULT_PROFILE + toProfile**

In `seo.service.ts`, add the new keys to `DEFAULT_PROFILE`:

```ts
  ga4MeasurementId: '',
  gtmContainerId: '',
  googleSiteVerification: '',
  bingSiteVerification: '',
  yandexVerification: '',
  facebookDomainVerification: '',
  pinterestVerification: '',
  customVerificationTags: [],
```

and in `toProfile(row)` return the new fields (the Json column is `row.customVerificationTags` — cast through the shared type):

```ts
      ga4MeasurementId: row.ga4MeasurementId,
      gtmContainerId: row.gtmContainerId,
      googleSiteVerification: row.googleSiteVerification,
      bingSiteVerification: row.bingSiteVerification,
      yandexVerification: row.yandexVerification,
      facebookDomainVerification: row.facebookDomainVerification,
      pinterestVerification: row.pinterestVerification,
      customVerificationTags: (row.customVerificationTags as SiteProfile['customVerificationTags']) ?? [],
```

(`SiteProfile` here is the `@cmstack-ts/config` type already imported.)

- [ ] **Step 4: Run service test, verify pass**

Run: `pnpm vitest run apps/api/src/seo/seo.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Repository contract test**

Ensure a `packages/db/src/repositories/site-profile.repository.spec.ts` asserts `upsert` writes the full data (incl. a Json `customVerificationTags`) through a mocked Prisma `siteProfile.upsert`. If the file exists, add an assertion that the new fields are forwarded in both `create` and `update` branches; if not, create it following the Media/Setting repo spec pattern (mock `prisma.siteProfile.upsert`, assert the `create`/`update` payloads contain `customVerificationTags`).

- [ ] **Step 6: Run db repo tests, verify pass**

Run: `pnpm vitest run packages/db/src/repositories/site-profile.repository.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/seo/seo.service.ts apps/api/src/seo/seo.service.spec.ts \
  packages/db/src/repositories/site-profile.repository.spec.ts
git commit -m "feat(api): surface analytics + verification fields through SeoService"
```

---

### Task 4: Web — verification meta + public data fallback

**Files:**
- Modify: `apps/web/lib/seo/fetch.ts:6-18` (FALLBACK)
- Modify: `apps/web/app/[locale]/layout.tsx` (add `generateMetadata`)

**Interfaces:**
- Consumes: `getSeoContent()` (returns extended profile), `buildVerificationMeta` from `@cmstack-ts/config`.
- Produces: public pages render verification `<meta>` tags; admin/auth (root layout) unaffected.

- [ ] **Step 1: Extend the FALLBACK profile**

In `apps/web/lib/seo/fetch.ts`, add to `FALLBACK.profile` the eight new keys (mirroring `DEFAULT_PROFILE`: empty strings + `customVerificationTags: []`).

- [ ] **Step 2: Add verification metadata to the locale layout**

In `apps/web/app/[locale]/layout.tsx`, add:

```tsx
import { getSeoContent } from '@/lib/seo/fetch';
import { buildVerificationMeta } from '@cmstack-ts/config';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await getSeoContent();
  const v = buildVerificationMeta(profile);
  return {
    verification: {
      ...(v.google ? { google: v.google } : {}),
      ...(v.yandex ? { yandex: v.yandex } : {}),
      ...(Object.keys(v.other).length ? { other: v.other } : {}),
    },
  };
}
```

(Next merges this with the root layout's `generateMetadata`; verification tags appear only on `[locale]` public pages.)

- [ ] **Step 3: Typecheck the web app**

Run: `pnpm --filter @cmstack-ts/web exec tsc --noEmit` (or `pnpm typecheck`)
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/seo/fetch.ts apps/web/app/[locale]/layout.tsx
git commit -m "feat(web): render site-verification meta on public pages"
```

---

### Task 5: Web — consent-gated GA4/GTM loader + i18n strings

**Files:**
- Modify: `apps/web/package.json` (add `@next/third-parties`)
- Create: `apps/web/components/public/analytics-loader.tsx`
- Modify: `apps/web/app/[locale]/layout.tsx` (read cookie, render loader)
- Modify: `apps/web/messages/{en,de,ru}.json` (a `consent` block)

**Interfaces:**
- Consumes: `getSeoContent()` (ga4/gtm ids), `@next/third-parties/google`.
- Produces: `<AnalyticsLoader gaId gtmId initialConsent>` — renders the consent banner or the analytics scripts.

- [ ] **Step 1: Add the dependency**

Run: `pnpm --filter @cmstack-ts/web add @next/third-parties`
Expected: added to `apps/web/package.json`; lockfile updated.

- [ ] **Step 2: Add consent strings (en, then de/ru in parity)**

`apps/web/messages/en.json` — add a top-level `consent` block:

```json
"consent": {
  "message": "We use cookies for analytics. You can accept or decline.",
  "accept": "Accept",
  "decline": "Decline"
}
```

`de.json`:

```json
"consent": {
  "message": "Wir verwenden Cookies für Analysen. Sie können zustimmen oder ablehnen.",
  "accept": "Zustimmen",
  "decline": "Ablehnen"
}
```

`ru.json`:

```json
"consent": {
  "message": "Мы используем cookie для аналитики. Вы можете принять или отклонить.",
  "accept": "Принять",
  "decline": "Отклонить"
}
```

- [ ] **Step 3: Implement the client loader**

Create `apps/web/components/public/analytics-loader.tsx`:

```tsx
'use client';

import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type Consent = 'undecided' | 'accepted' | 'declined';

const COOKIE = 'ts-consent';

function persist(value: Consent) {
  // 1 year, site-wide; SSR reads this on the next navigation to avoid a banner flash.
  document.cookie = `${COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function AnalyticsLoader({
  gaId,
  gtmId,
  initialConsent,
}: {
  gaId: string;
  gtmId: string;
  initialConsent: Consent;
}) {
  const t = useTranslations('consent');
  const [consent, setConsent] = useState<Consent>(initialConsent);

  if (consent === 'accepted') {
    return (
      <>
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
        {gtmId ? <GoogleTagManager gtmId={gtmId} /> : null}
      </>
    );
  }
  if (consent === 'declined') return null;
  // No ids configured → nothing to consent to.
  if (!gaId && !gtmId) return null;

  function decide(value: Consent) {
    persist(value);
    setConsent(value);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="ts-consent fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 border-t border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--fg)] sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="max-w-2xl">{t('message')}</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => decide('declined')} className="ts-consent-btn">
          {t('decline')}
        </button>
        <button
          type="button"
          onClick={() => decide('accepted')}
          className="ts-consent-btn ts-consent-accept"
        >
          {t('accept')}
        </button>
      </div>
    </div>
  );
}
```

(Reuses the theme CSS vars `--bg/--fg/--line`; `.ts-consent-btn` styling added in globals if needed — see Step 5.)

- [ ] **Step 4: Wire the loader into the locale layout**

In `apps/web/app/[locale]/layout.tsx`, read the cookie and render the loader inside the returned tree:

```tsx
import { AnalyticsLoader } from '@/components/public/analytics-loader';
import { cookies } from 'next/headers';

// inside LocaleLayout, after setRequestLocale(locale):
const { profile } = await getSeoContent();
const consentCookie = (await cookies()).get('ts-consent')?.value;
const initialConsent =
  consentCookie === 'accepted' || consentCookie === 'declined' ? consentCookie : 'undecided';

return (
  <>
    {children}
    <AnalyticsLoader
      gaId={profile.ga4MeasurementId}
      gtmId={profile.gtmContainerId}
      initialConsent={initialConsent}
    />
  </>
);
```

(`getSeoContent` is already imported for Task 4's `generateMetadata`; one fetch per layer render — Next dedupes within a request, and `cache: 'no-store'` keeps it fresh.)

- [ ] **Step 5: Minimal consent button CSS**

In `apps/web/app/globals.css`, add (near the other `.ts-*` public styles):

```css
.ts-consent-btn {
  border: 1px solid var(--line);
  border-radius: 0.375rem;
  padding: 0.4rem 0.9rem;
  font-size: 0.85rem;
  cursor: pointer;
}
.ts-consent-accept {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
}
```

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/components/public/analytics-loader.tsx \
  apps/web/app/[locale]/layout.tsx apps/web/app/globals.css apps/web/messages
git commit -m "feat(web): consent-gated GA4/GTM injection on the public site"
```

---

### Task 6: Admin SEO form — analytics & verification fields

**Files:**
- Modify: `apps/web/app/admin/seo/profile-form.tsx`

**Interfaces:**
- Consumes: extended `SiteProfile` type; `updateProfile` action (already forwards the whole form, validated by `updateSiteProfileSchema`).
- Produces: admin can edit all new fields incl. add/remove custom verification pairs.

- [ ] **Step 1: Add an Analytics + Verification fieldset**

In `profile-form.tsx`, after the GEO statement block and before the submit row, add inputs bound through the existing `set(...)` helper for: `ga4MeasurementId`, `gtmContainerId`, `googleSiteVerification`, `bingSiteVerification`, `yandexVerification`, `facebookDomainVerification`, `pinterestVerification`. Example for two of them (repeat the pattern):

```tsx
<fieldset className="space-y-4 border-t border-border pt-4">
  <legend className="text-sm font-medium">Analytics &amp; verification</legend>
  <div className="grid gap-4 sm:grid-cols-2">
    <div className="space-y-1.5">
      <Label htmlFor="ga4MeasurementId">GA4 measurement ID</Label>
      <Input
        id="ga4MeasurementId"
        placeholder="G-XXXXXXX"
        value={form.ga4MeasurementId}
        onChange={(e) => set('ga4MeasurementId', e.target.value)}
      />
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="gtmContainerId">GTM container ID</Label>
      <Input
        id="gtmContainerId"
        placeholder="GTM-XXXXXX"
        value={form.gtmContainerId}
        onChange={(e) => set('gtmContainerId', e.target.value)}
      />
    </div>
    {/* googleSiteVerification, bingSiteVerification, yandexVerification,
        facebookDomainVerification, pinterestVerification — same Input pattern */}
  </div>
</fieldset>
```

- [ ] **Step 2: Add a custom-pairs editor**

Add a repeatable editor for `customVerificationTags` (array of `{name,content}`). Use local handlers that update `form.customVerificationTags` immutably:

```tsx
function setTag(i: number, key: 'name' | 'content', value: string) {
  setForm((f) => {
    const next = [...f.customVerificationTags];
    next[i] = { ...next[i], [key]: value };
    return { ...f, customVerificationTags: next };
  });
}
function addTag() {
  setForm((f) => ({ ...f, customVerificationTags: [...f.customVerificationTags, { name: '', content: '' }] }));
}
function removeTag(i: number) {
  setForm((f) => ({ ...f, customVerificationTags: f.customVerificationTags.filter((_, j) => j !== i) }));
}
```

Render each pair as two `Input`s (`name`, `content`) + a remove button, plus an "Add verification tag" button. Keep it inside the same fieldset.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean (`SiteProfile` now includes the fields the form reads).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/admin/seo/profile-form.tsx
git commit -m "feat(web): admin SEO form fields for analytics + verification"
```

---

### Task 7: Seed, full gates, live verification, adversarial review, HANDOFF

**Files:**
- Modify: `packages/db/prisma/seed.ts` (profile upsert)
- Modify: `cmstack-ts/HANDOFF.md`, `cmstack-ts/REFACTOR_PLAN.md` (§7 #6 tick)

- [ ] **Step 1: Seed a verification example**

In the `SiteProfile` upsert in `seed.ts`, add (leave GA4/GTM empty):

```ts
    googleSiteVerification: 'demo-google-site-verification-token',
    customVerificationTags: [{ name: 'p:domain_verify', content: 'demo-pinterest-token' }],
```

(Both `create` and `update` branches if the seed upsert is asymmetric.)

- [ ] **Step 2: Run the full unit gates**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm vitest run --coverage   # ≥80% gate must hold
```

Expected: all green; record real counts.

- [ ] **Step 3: Live stack verification (HANDOFF recipe)**

Bring the stack up per HANDOFF "Full stack for LIVE verification", reseed, rebuild, then:
- `curl -s localhost:4000/public/seo | jq '.profile | {ga4MeasurementId, googleSiteVerification, customVerificationTags}'` → shows seeded values.
- `curl -s localhost:3000/ | grep -E 'google-site-verification|p:domain_verify'` → verification `<meta>` present on the public home.
- `curl -s localhost:3000/admin | grep -c 'google-site-verification'` → **0** (admin must NOT carry it).
- Set a GA4 id via the admin form (or seed), reload `/`, confirm the consent banner renders and that accepting injects the GA script (`grep googletagmanager` after setting the `ts-consent=accepted` cookie).
- `pnpm e2e` → 11/11 (install `chromium-headless-shell` build 1148 first if needed).

- [ ] **Step 4: Adversarial self-review (inline, no parallel agents)**

Check: GA4/GTM regex blocks script injection; verification token charset rejects `<>"'`; React escapes the meta attributes; admin/auth pages excluded; consent cookie default = undecided; no observer event added; Json column round-trips; coverage gate held. Fix any finding with a regression test.

- [ ] **Step 5: Update HANDOFF + tick §7 #6**

Add a "§7 #6 — DONE" block to `HANDOFF.md` (mirroring the #1–#5 entries: what shipped, the migration name, test counts, live-verify results, scoped-out items) and tick #6 in `REFACTOR_PLAN.md` §7. Update the continuation prompt's "next item" to #7 (auto thumbnails).

- [ ] **Step 6: Final commit**

```bash
git add packages/db/prisma/seed.ts cmstack-ts/HANDOFF.md cmstack-ts/REFACTOR_PLAN.md
git commit -m "feat: GA4/GTM, site verification & basic consent (Task 1 §7 #6)"
```

---

## Self-Review

**Spec coverage:**
- Data model (8 columns) → Task 2. ✓
- Config schemas + strict validation + builder → Task 1. ✓
- API service/repo wiring, no observer → Task 3. ✓
- Verification meta public-only → Task 4. ✓
- Consent-gated GA4/GTM via `@next/third-parties` → Task 5. ✓
- Admin form fields incl. custom pairs → Task 6. ✓
- Seed + gates + live verify + adversarial + HANDOFF → Task 7. ✓
- Out-of-scope items (Consent Mode v2, GDPR module, no faked AI verification) → documented in spec; nothing to build. ✓

**Placeholder scan:** Task 3 Step 5 and Task 6 Step 1/2 intentionally describe a "repeat the pattern" UI with one concrete example each (the pattern is shown in full); all logic steps carry complete code. No TBD/TODO.

**Type consistency:** `buildVerificationMeta`/`VerificationMeta`/`VerificationSource`, `verificationTagSchema`/`VerificationTag`, the eight field names, and `customVerificationTags` are spelled identically across Tasks 1–6. The cookie name `ts-consent` and `Consent` union match between Task 5 Steps 3 and 4.
