# Shared net-new #1 — Revision restore UI — Design

**Date:** 2026-06-26 · **Status:** approved · **Register:** `REFACTOR_PLAN.md` §7 shared net-new; canon `../FEATURE_MATRIX.md` rows 23–24 ("revision restore UI" — a gap in all three stacks)

## Goal

Let an editor view a post's/page's revision history, compare a prior revision against the
current values field-by-field, and **restore** it. Restoring is itself reversible.

## Context (in place)

- `Revision` model: `{ id, postId?, pageId?, authorId, snapshot Json, createdAt }`. A snapshot is
  written **before every `update`** (`PostsService.update`/`PagesService.update`): posts snapshot
  `{ title, slug, excerpt, content, status }`, pages `{ title, slug, content, status }` — scalar
  fields only (no taxonomy).
- `RevisionRepository`: `create` / `listForPost` / `listForPage`. No `findById` yet.
- `GET /posts/:id/revisions` + `GET /pages/:id/revisions` → `RevisionView[]`
  (`{ id, authorId, snapshot, createdAt }`). `POST /:id/restore` already exists — it is **trash**
  restore (soft-delete), unrelated to revisions.
- Admin edit pages: `apps/web/app/admin/posts/[id]/edit`, `.../pages/[id]/edit`. §7 #8 added a
  reusable client panel pattern (`components/admin/translations-panel.tsx`) mounted below the form
  + Server Actions that `revalidatePath`.
- §7 #10 cache: `PostsService.update`/`PagesService.update` already `emit('content.changed')`.

## Decisions

- **Restore goes through the existing `update`** path with the snapshot's scalar fields. That
  reuse gives three properties for free: (1) the current state is snapshotted *before* the
  overwrite, so **restore is reversible**; (2) content is re-sanitized; (3) `content.changed` is
  emitted, so the §7 #10 cache is invalidated. No new observer event.
- **New endpoints** (the bare `/:id/restore` is taken by trash restore):
  `POST /posts/:id/revisions/:revisionId/restore` and
  `POST /pages/:id/revisions/:revisionId/restore`. CASL `update Post` / `update Page`. The
  authoring user id (`@CurrentUser`) is the author of the new (pre-restore) snapshot.
- **Ownership check:** the revision must belong to the target (`revision.postId === id` /
  `revision.pageId === id`), else **404** — you cannot restore another content item's revision.
  A missing revision is **404**.
- **Snapshot parsing:** the snapshot is `Json` (`unknown`). A pure helper extracts the known
  scalar fields into an `Update{Post,Page}Input` (title/slug/content/status [+ excerpt for posts]);
  unknown/malformed fields are ignored, `status` is validated against `ContentStatus`. Taxonomy is
  not in the snapshot, so categories/tags are left untouched on restore (logged, by design).
- **Slug collision on restore** is handled by `update`'s existing `uniqueSlug(slug, id)` (a
  restored slug now taken by another item gets a numeric suffix) — no 409, no crash.
- **Web UI:** reusable client `components/admin/revisions-panel.tsx` mounted below the edit form
  (edit-only — needs an id), posts + pages. Lists revisions (localized date, author id, status
  badge); selecting one shows **field-level compare** — its fields beside the current values, with
  changed fields highlighted (plain render of both, no diff library; content shown as a truncated,
  escaped text preview). A **Restore** button (confirm dialog + `useTransition` + toast) calls a new
  Server Action.
- **Diff is field-level, not a visual text diff** (operator choice) — satisfies canon's "diff and
  restore" without a new dependency.

## Components

- **`packages/db` `RevisionRepository.findById(id): Promise<Revision | null>`** (+ Prisma impl
  `findUnique`). Re-exported already via the barrel.
- **API `RevisionView`** is unchanged. New service methods:
  - `PostsService.restoreRevision(id: string, revisionId: string, authorId: string): Promise<PostDetail>`
  - `PagesService.restoreRevision(id: string, revisionId: string, authorId: string): Promise<PageDetail>`
  Each: `findById` → 404 if absent or not owned → build the typed update input from the snapshot via
  the pure parser → call `this.update(id, input, authorId)` (reuse) → return its result.
- **Pure parser** (in the content module, unit-tested): `revisionToPostUpdate(snapshot: unknown)` /
  `revisionToPageUpdate(snapshot: unknown)` → `UpdatePostInput` / `UpdatePageInput` (only recognized
  fields; `status` guarded).
- **Controllers:** two thin handlers (above), mirroring the existing `restore` handler shape.
- **Web:** `lib/admin/revision-compare.ts` pure `compareRevisionFields(current, snapshot, fields)`
  → `[{ field, current, revision, changed }]` (+ `localeLabel`-style helpers as needed);
  `components/admin/revisions-panel.tsx`; Server Actions `restorePostRevisionAction(id, revisionId)`
  / `restorePageRevisionAction(id, revisionId)` in the existing `actions.ts`.

## Behaviour invariants

- Restoring writes a new revision of the *current* state first (reversible) — verified by the
  reuse of `update`.
- Restoring a revision that doesn't belong to the target → 404 (no cross-item restore).
- Content is sanitized on restore (same `update` write path).
- The cache is invalidated on restore (`content.changed` via `update`).
- Taxonomy/translations are unaffected by a restore (snapshot is scalar-only).

## Testing (TDD by layer)

1. `RevisionRepository.findById` contract test (mock Prisma `findUnique`).
2. Pure parser: known fields mapped; unknown ignored; invalid `status` dropped.
3. `PostsService.restoreRevision` (fake repo): 404 on missing, 404 on wrong owner, calls `update`
   with the parsed snapshot fields + authorId, returns the detail; same for pages.
4. Controller: CASL `update` gate (covered by the existing guard pattern; no new guard logic).
5. Web pure `compareRevisionFields`: changed/unchanged flags, content present.
6. Full gates (`pnpm test` / `typecheck` / `lint` / coverage ≥80%); rebuild + `pnpm e2e` 11/11;
   live: restore an older revision → fields revert, the pre-restore state becomes the newest
   revision (reversible); cross-item restore → 404.

## Out of scope (logged, not silent)

- Restoring taxonomy/translations (not in the snapshot — by design); a rich visual text diff
  (field-level compare chosen); revisions for `create` (snapshot is taken only before `update`,
  unchanged); pruning/retention of old revisions; per-revision permalink/preview route.
