# cmstack-ts — HANDOFF

**Updated:** 2026-06-24 · **Branch:** `refactor/repository-layer` (off `main`)
**Phase:** Task 2 (architecture refactor) + Task 4 (tests) — *architecture-first per operator decision.*

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
- **Scaffolding + Settings domain (first repository slice) — committed (`4c35988`):**
  - `packages/db/src/repositories/{index.ts, setting.repository.ts, setting.repository.spec.ts}`
  - `packages/db/src/index.ts` re-exports Prisma surface + repositories.
  - `apps/api/src/settings/settings.service.ts` injects `SETTING_REPOSITORY` (no Prisma).
  - `apps/api/src/settings/settings.module.ts` wires the token (useFactory + PRISMA).
  - `apps/api/src/settings/settings.service.spec.ts` (new, fake-repo tests).
  - tsc + biome clean, full suite green.

## PENDING (ordered — resume here)
1. **SEO/GEO** → `SiteProfileRepository` + `ServiceRepository` + `FaqRepository`
   (plan §4.13). Watch asymmetric upsert (profile create `{id:'default',...}` vs update)
   and raw-null fallback to `DEFAULT_PROFILE` staying in the service (§10.10).
2. **Tags** (§4.4) then **Categories** (§4.3) — introduce the `PrismaCrudRepository`
   base here (plan §2.6). Categories: keep `CategoryUncheckedUpdateInput` + scalar
   `parentId` + `'parentId' in input` semantics (§10.8).
3. **Adversarial review** of the simple-CRUD batch (Settings/SEO/Tags/Categories).
4. **Media** (§4.9, storage/DB ordering §10.2/§10.4) → **Likes** (§4.5, race-resilience
   §10.5; uses `PostRepository.findPublishedIdBySlug`) → **Comments** (§4.8).
5. **Revisions** (§4.6) + **Search** (§4.7, raw SQL one-unit, bound param, NULLS LAST,
   bigint→Number §10.6).
6. **Pages** (§4.2) → **Posts** (§4.1 — connect-vs-set §10.1, publish/revision order
   §10.9, `post.published` observer event stays). Full adversarial pass.
7. **Auth**: Users/Accounts/Roles (§4.10–4.12, 4 user shapes §10.7, oauth writes §10.8b)
   + **Admin fat-controller fix** (§4.10b). Security-focused adversarial pass. Rewrite
   the two specs that construct services with a PrismaClient and WILL break:
   `auth/users.service.spec.ts`, `auth/accounts.service.spec.ts`.
8. **Coverage gate**: enable V8 coverage in `vitest.config.ts`, hit ≥80% services+repos
   / 100% critical paths; **completeness-critic** pass.
9. Then **Task 1 (feature parity)** + **Task 3 (UI)** — plan §7/§8.

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