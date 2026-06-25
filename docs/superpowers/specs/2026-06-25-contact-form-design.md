# Contact form + email — design (Task 1 · §7 #5)

**Date:** 2026-06-25 · **Branch:** `refactor/repository-layer` · **Status:** approved, ready for plan

Parity with the Laravel reference's contact feature (`FEATURE_MATRIX.md` §14): a public,
reCAPTCHA-protected contact form that delivers messages to a **settings-driven recipient**
by email. We additionally **persist** each submission (admin inbox) and decouple the email
send through the observer (`HookRegistry`), exactly the side-effect wiring anticipated by
`REFACTOR_PLAN.md` §2.7. Reuses the §7 #3 `MailService` and the existing `RecaptchaService`.

## Goals
- A public form (`/[locale]/contact`) posts name / email / optional subject / message.
- Submissions are **persisted** (`ContactSubmission`) and visible in an admin **inbox**.
- Each submission **emits `contact.submitted`**; a fault-isolated mail listener emails the
  recipient — a mail failure can never fail the already-stored submission.
- Recipient is **settings-driven**: `SiteProfile.contactEmail`, falling back to
  `CONTACT_RECIPIENT_EMAIL` then `MAIL_FROM`.
- Spam-resistant: reCAPTCHA (optional, same as comments), per-IP rate limiting, and a
  honeypot field.

## Non-goals (YAGNI / scoped out — logged, not silent)
- Threaded replies / email-from-admin, attachments, auto-responder to the sender — not in
  the matrix; skip.
- A rich inbox (search, pagination, status workflow beyond handled/unhandled) — the inbox
  is a simple newest-first list with mark-handled + delete.
- The seeded "Contact" **content page** (slug `contact`) is shadowed by the new static
  `/[locale]/contact` form route (Next prioritises the static segment). Accepted; the
  seeded page stays in the DB/admin but is not reachable at `/contact`.

## Architecture (three layers + observer, per REFACTOR_PLAN §2.0/§2.7)
New NestJS module `apps/api/src/contact/`:
`ContactController` + `PublicContactController` (thin) → `ContactService` (validation beyond
shape is in the schema; recaptcha verify; honeypot; persist; **emit `contact.submitted`**;
error→HTTP) → `ContactRepository` (`packages/db`, data access only).
`ContactMailListener` subscribes to `contact.submitted` via `HookRegistry.addAction` in
`ContactModule.onModuleInit`, resolves the recipient, and sends through `MailService`.
`SiteProfileRepository` is reused for the recipient lookup (`SeoModule` already owns it; the
contact module binds its own provider per the §2.1 convention).

## Data model (Prisma migration — additive, reversible)
```prisma
/// A message sent through the public contact form. Persisted for the admin inbox;
/// delivery to the recipient is a fault-isolated side effect (contact.submitted).
model ContactSubmission {
  id        String    @id @default(cuid())
  name      String
  email     String
  subject   String?
  message   String
  /// Set when an admin marks the message handled (null = new/unhandled).
  handledAt DateTime?
  createdAt DateTime  @default(now())

  @@index([createdAt])
}
```
And on the existing singleton profile:
```prisma
model SiteProfile {
  // ...existing fields...
  /// Recipient for contact-form notifications. Empty falls back to env/MAIL_FROM.
  contactEmail String @default("")
}
```

## Config (`@cmstack-ts/config`, shared contracts)
- `contactSubmissionSchema` (public POST body):
  - `name` `z.string().trim().min(1).max(120)`
  - `email` `z.string().trim().email().max(200)`
  - `subject` `z.string().trim().max(200).optional()`
  - `message` `z.string().trim().min(1).max(5000)`
  - `recaptchaToken` `z.string().optional()`
  - `company` `z.string().optional()` — **honeypot** (real users never fill it)
  - `type ContactSubmissionInput`
- `adminContactSchema` (inbox row): `{ id, name, email, subject: string|null, message,
  handledAt: string|null, createdAt }` (all plain text); `adminContactListSchema =
  z.array(adminContactSchema)`.
- `updateSiteProfileSchema` + `siteProfileSchema` gain `contactEmail`
  (`z.literal('').or(z.string().trim().email().max(200))`, default `''`).

## URL / submit transport
The web form posts **client-side directly** to `${NEXT_PUBLIC_API_URL}/public/contact`
(like the comments form) so the API's `trust proxy` rate limiter sees the real client IP.
The reCAPTCHA token (when keys are configured) is attached client-side.

## API surface
**Public (unauthenticated, throttled, recaptcha):**
- `POST /public/contact` — `@UseGuards(ThrottlerGuard) @Throttle({ default: { limit: 5, ttl: 60_000 } })`.
  Flow: if `company` (honeypot) is non-empty → return `204` **without** storing (silent
  drop). Else `recaptcha.verify(token)` → false → `400`. Else persist the submission, then
  `hooks.emit('contact.submitted', { id, name, email, subject, message })`, return `201`.
  The emit is fault-isolated, so a mail failure cannot 500 the request.

**Admin (`@UseGuards(JwtAuthGuard, PoliciesGuard)`, CASL subject `Contact`):**
- `GET /contact` → `adminContactList` (newest-first).
- `PATCH /contact/:id` — body `{ handled: boolean }` → sets/clears `handledAt`; `404` if
  absent.
- `DELETE /contact/:id` — `204`; `404` if absent.

All bodies validated with `ZodValidationPipe(<shared schema>)`.

## Repository (`packages/db`)
```
// CONTACT_SUBMISSION_REPOSITORY
create(data: { name; email; subject: string | null; message: string }): Promise<ContactSubmission>
list(): Promise<ContactSubmission[]>          // orderBy createdAt desc
setHandledAt(id, when: Date | null): Promise<ContactSubmission>   // P2025 propagates → service 404
exists(id): Promise<boolean>                  // via PrismaCrudRepository
hardDelete(id): Promise<void>                 // via PrismaCrudRepository
```
Repo never catches `P2002`/`P2025` (§2.4); the service maps `P2025 → 404`.

## Authorization
New CASL subject **`Contact`** (`read`/`update`/`delete`), seeded to **Administrator**
(`manage all`) and **Editor** (`manage Contact`) — contact handling is editorial, consistent
with the `Seo`/`Comment` grants. Web admin gate `canManageContacts` mirrors `canModerateComments`.

## Observer / events
- New action `contact.submitted` in `ActionMap` (`apps/api/src/plugins/hooks.ts`), payload
  `{ id: string; name: string; email: string; subject: string | null; message: string }`.
- `ContactMailListener` registers via `HookRegistry.addAction('contact.submitted', handler)`
  in `ContactModule.onModuleInit`. The handler resolves the recipient
  (`SiteProfile.contactEmail` → `CONTACT_RECIPIENT_EMAIL` → `MAIL_FROM`), builds the message
  with the pure `contactNotificationEmail(submission)` (HTML-escaped name/email/subject/
  message + a plain-text body), and sends through `MailService`. Errors are swallowed by
  `emit`'s fault isolation (logged), so the stored submission and the `201` are unaffected.
- This is the first genuine new side effect wired to the observer per §2.7 (the
  comment-notification email is its sibling, still pending).

## Web
- `app/[locale]/contact/page.tsx` — rendered through the active theme (`Layout`): a short
  intro + `<ContactForm>` (client component). `generateMetadata` sets a localized title +
  `alternatesFor(locale, '/contact')`. Static segment, so it shadows the `/[slug]` route for
  `contact` (accepted).
- `components/public/contact-form.tsx` (client): controlled fields (name/email/subject/
  message) + a visually-hidden honeypot `company` input; on submit POSTs to
  `${NEXT_PUBLIC_API_URL}/public/contact` with the reCAPTCHA token when available; shows
  success/error via `sonner`. Plain-text fields, rendered as escaped React text.
- Localized strings under a new `contact` namespace in `messages/{en,de,ru}.json` (keys in
  parity).
- Admin inbox `app/admin/contact/page.tsx` (gated `canManageContacts`): newest-first list of
  submissions (name, email, subject, message, received date, handled badge); per-row
  mark-handled/unhandle + delete via Server Actions (`actions.ts`) that call the server-only
  admin API client and `revalidatePath('/admin/contact')`. A sidebar entry "Contact" under
  Moderation (next to Comments).

## Seo screen
The existing `/admin/seo` profile form gains a **Contact email** field (wired through the
existing `updateProfile` action + `updateSiteProfileSchema`).

## Seed
Idempotent: set `SiteProfile.contactEmail` to the demo admin address; insert 1–2 demo
submissions (one handled, one new) only when the table is empty (so re-seed doesn't
duplicate) — the admin inbox and recipient resolution are visible in the demo without SMTP.

## Behaviour-preservation / invariants
- Repos never catch `P2002`/`P2025`; the service maps `P2025 → 404` (§2.4).
- `emit` runs after the repo write succeeds, inside the success path; fault-isolated so a
  listener failure cannot fail the request (§2.7) — and crucially cannot leak/blow up the
  public submit.
- Public submit never reflects stored data back (returns `201`/`204` only); the honeypot
  path is indistinguishable from success (no enumeration of the filter).
- Recipient resolution is pure/deterministic and unit-tested; an unset profile email falls
  back deterministically.

## Testing
- **Pure**: `contactNotificationEmail` (HTML-escape, subject/body); recipient resolver
  (`profile → env → from` precedence, empty handling).
- **Service** (fake repos + fake recaptcha + spy hooks): honeypot → no store + no emit;
  recaptcha fail → `400` + no store; success → store + `emit('contact.submitted', …)`;
  `markHandled`/`delete` → `404` mapping.
- **Listener**: resolves recipient and calls `MailService.send` with the built message; a
  `MailService` throw is swallowed (does not propagate).
- **Repository contract** (mocked Prisma): `create` shape, `list` `orderBy createdAt desc`,
  `setHandledAt`.
- Gates: `pnpm test` green, `typecheck`, `lint`, coverage ≥80% on services+repos; rebuild +
  `pnpm e2e` 11/11; live curl/SSR (submit stores a row, appears in the inbox, email printed
  to the API log; honeypot drop; reCAPTCHA disabled locally).

## Rollback
One reversible migration (new table + one nullable-with-default column); the module is
additive. Revert = drop the module + migration; the `contact.submitted` hook entry and the
web routes are additive and harmless if unused.
