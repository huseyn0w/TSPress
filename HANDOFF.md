# cmstack-ts — HANDOFF

**Updated:** 2026-06-24 — **Task 2 (architecture) + Task 4 (tests) COMPLETE.** · **Branch:** `refactor/repository-layer` (off `main`)
**Next phases:** Task 1 (feature parity) and Task 3 (UI) — not started (architecture-first per operator decision).

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

## Gotchas
- **`Write`-tool artifact:** files written via the Write tool get a stray `</content>`
  line appended — strip it (`perl -0pi -e 's/\n?<\/content>\s*$//' <file>`) and
  re-run `pnpm format` (also restores the final newline biome wants) before testing.
- Vitest resolves `@cmstack-ts/{db,config}` to `src` (no build needed for tests);
  `pnpm typecheck` DOES build packages to `dist` first.
- `packages/db` is CommonJS; `apps/api` CommonJS (Nest); `apps/web`/`apps/mcp` ESM.
- Reply to the operator in **Russian**; code/comments/docs in **English**.

---

## Continuation prompt (paste into a fresh window)
> You are resuming the `cmstack-ts` repository-layer refactor (senior TS engineer,
> autonomous). Working dir `/Users/huseyn0w/Desktop/SWE/cmstack/cmstack-ts`, branch
> `refactor/repository-layer`. **Read first:** `cmstack-ts/HANDOFF.md`,
> `cmstack-ts/REFACTOR_PLAN.md` (esp. §2.0 layering, §2.7 observer policy, §4 per-domain
> contracts, §10 behaviour-preservation invariants), and the read-only canon
> `../FEATURE_MATRIX.md` + `../DESIGN_SYSTEM.md` (do NOT edit the canon). Operating
> rules: work autonomously (read/edit/run pnpm/vitest/biome/git locally without asking);
> use Superpowers skills (TDD, subagent-driven-development, requesting-code-review,
> verification-before-completion); model routing — Opus for architecture/refactor/review,
> Sonnet for low-risk impl, Haiku only for lookups; for every refactored module dispatch
> 2–3 independent adversarial Opus skeptics (behaviour/correctness/security/perf) and fix
> findings; **reply to the operator in Russian**, code/docs in English. Resume from the
> first PENDING item in HANDOFF (SEO/GEO domain). Keep the three-layer invariant
> (controller→service→repository) and the observer policy. Refresh HANDOFF.md at each
> milestone; show real `pnpm test`/biome/typecheck output, never claim green without it.
> Mind the Write-tool `</content>` artifact (strip + re-format).