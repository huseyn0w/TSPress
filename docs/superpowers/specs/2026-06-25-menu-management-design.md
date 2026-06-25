# Menu management — design (Task 1 · §7 #4)

**Date:** 2026-06-25 · **Branch:** `refactor/repository-layer` · **Status:** approved, ready for plan

Bring `cmstack-ts` to feature parity with the Laravel reference's menu system: an
admin drag-sortable menu builder whose items reference posts / pages / categories /
custom URLs, are **per-locale** (label translation, reusing the §7 #1 pattern), and
are rendered as managed navigation in the public site header + footer (replacing the
current hardcoded nav links).

## Goals
- Editors manage one or more **named menus**, each bound to a theme **location**
  (`primary`, `footer`).
- Menu items are **nested** (parent/child → public dropdowns; full Laravel parity).
- Items link to a **Post**, **Page**, **Category**, or a **custom URL**; the public
  URL is **resolved at read time** from the target's current slug (slug drift never
  breaks a link).
- Item **labels are translatable** (en base + de/ru overrides, per-field fallback).
- Public themes render managed menus; a missing menu degrades to the existing static
  links so the site always renders.

## Non-goals (YAGNI / scoped out — logged, not silent)
- Mega-menus / >2 visual levels, menu-item icons, role-conditional visibility,
  per-item CSS classes — not in the matrix; skip.
- Caching / `menu.changed` observer event — there is no API-side cache yet; the hook
  point is recorded for the future caching layer (REFACTOR_PLAN §2.7), not emitted now.
- Category **archive** template beyond a `?category=` filter on the existing blog
  index; a dedicated category landing page is out of scope.

## Architecture (three layers, per REFACTOR_PLAN §2.0)
New NestJS module `apps/api/src/menus/`:
`MenuController` (thin) → `MenuService` (business logic, URL resolution, translation
overlay, structure validation, observer decisions) → `MenuRepository` +
`MenuItemRepository` (data access only, framework-free, Prisma payloads).

Repositories live in `packages/db/src/repositories/`. Cross-aggregate slug lookups
(Post/Page/Category) reuse the existing repositories via DI (the menus module imports
the owning providers), per the established cross-domain convention — the menu repos
never query foreign models.

## Data model (Prisma migration — additive, reversible)
```prisma
model Menu {
  id        String     @id @default(cuid())
  name      String                          // admin-facing label, e.g. "Main navigation"
  location  String     @unique              // theme render key: "primary" | "footer"
  items     MenuItem[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

enum MenuItemType { POST PAGE CATEGORY CUSTOM }

model MenuItem {
  id           String                @id @default(cuid())
  menuId       String
  menu         Menu                  @relation(fields: [menuId], references: [id], onDelete: Cascade)
  parentId     String?
  parent       MenuItem?             @relation("MenuItemTree", fields: [parentId], references: [id], onDelete: Cascade)
  children     MenuItem[]            @relation("MenuItemTree")
  order        Int                   @default(0)   // position among siblings, ascending
  type         MenuItemType
  label        String                              // default-locale (en) label
  targetId     String?                             // related row id for POST/PAGE/CATEGORY; null for CUSTOM
  url          String?                             // custom URL for CUSTOM; null otherwise
  openInNewTab Boolean               @default(false)
  translations MenuItemTranslation[]
  createdAt    DateTime              @default(now())
  updatedAt    DateTime              @updatedAt

  @@index([menuId])
  @@index([parentId])
}

model MenuItemTranslation {
  id         String   @id @default(cuid())
  menuItemId String
  menuItem   MenuItem @relation(fields: [menuItemId], references: [id], onDelete: Cascade)
  locale     String
  label      String?                              // only translatable field; null → falls back to base
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([menuItemId, locale])
  @@index([locale])
}
```
`targetId` is intentionally **not** a foreign key (polymorphic across three tables).
Referential integrity for the target is enforced at the **service** layer on write
(the referenced post/page/category must exist).

## URL resolution
Pure, unit-tested `resolveMenuItemUrl(type, slug | null, url | null)`:
- `POST` → `/blog/{slug}`
- `PAGE` → `/{slug}`
- `CATEGORY` → `/blog?category={slug}`
- `CUSTOM` → `url`

`MenuService` batch-loads slugs by type (one query per type for the whole tree, no
N+1) via `PostRepository.slugsByIds` / `PageRepository.slugsByIds` /
`CategoryRepository.slugsByIds` (each returns `Record<id, slug>`), then maps every
item. An item whose target row no longer exists (slug unresolved) is **dropped** from
the public tree (no broken link).

**Security:** for `CUSTOM`, the service validates the URL at write time — only a
site-relative path (`/…`) or an absolute `http(s)://…` URL is accepted; anything else
(`javascript:`, `data:`, …) is rejected (`400`). Labels are plain text, rendered
escaped by React (no `dangerouslySetInnerHTML`).

## New public web routes (so all four item types resolve to a live page in the demo)
- `app/[locale]/[slug]/page.tsx` — public single **Page** rendered through the active
  theme. Next.js prioritises the static sibling segments (`blog`, `search`,
  `services`, `authors`), so this dynamic catch-all only matches real page slugs; no
  collision. This route also starts rendering the §7 #2 page-level SEO meta
  (previously stored but unrendered).
- `/blog?category={slug}` — the blog index reads `searchParams.category` and forwards
  `categorySlug` to the existing public post-list API (filter already supported
  server-side).

## API surface
**Public (unauthenticated — SSR needs it before any session):**
- `GET /public/menus/:location?locale=` → resolved, localized tree:
  `{ location, items: MenuNode[] }` where
  `MenuNode = { label, url, openInNewTab, children: MenuNode[] }`. Unknown/absent
  location or junk locale → empty `items` (junk locale → default per §7 #1).

**Admin (`@UseGuards(JwtAuthGuard, PoliciesGuard)`, CASL subject `Menu`):**
- `GET /menus` — list menus (`{ id, name, location }`).
- `GET /menus/:id` — full builder payload: menu + nested item tree + every
  translation row (admin sees all locales, per §7 #1 admin-read convention).
- `POST /menus` — create `{ name, location }` (location unique → `P2002`→409).
- `PATCH /menus/:id` — update `{ name?, location? }`.
- `DELETE /menus/:id` — cascade-deletes items + translations.
- `POST /menus/:id/items` — create item `{ type, label, targetId?, url?,
  openInNewTab?, parentId?, order? }` (target existence + custom-url validated).
- `PATCH /menus/:id/items/:itemId` — edit the same fields.
- `DELETE /menus/:id/items/:itemId` — cascade-deletes descendants + translations.
- `PUT /menus/:id/structure` — **bulk reorder + reparent**: body
  `{ nodes: [{ id, parentId | null, order }] }`; the drag-builder saves the whole tree
  in one call. Validated: every id belongs to this menu, parents reference ids in the
  same payload, no cycles.
- `PUT /menus/:id/items/:itemId/translations/:locale` — upsert label override
  (empty/absent label → no override → falls back; idempotent).
- `DELETE /menus/:id/items/:itemId/translations/:locale` — clear override (idempotent).

All bodies validated with shared Zod schemas in `@cmstack-ts/config` (`menuSchema`,
`createMenuSchema`, `updateMenuSchema`, `createMenuItemSchema`, `updateMenuItemSchema`,
`menuStructureSchema`, `menuItemTranslationInputSchema`, plus `menuItemTypeSchema` and
the public `menuNodeSchema`/`publicMenuSchema`). `LOCALES`/`DEFAULT_LOCALE` from config.

## Authorization
New CASL subject **`Menu`** (`read`/`create`/`update`/`delete`). Seeded to
**Administrator** (already `manage all`) and **Editor** (`manage Menu`) — menus are
editorial site structure, consistent with the `Seo` grant. Web admin gate
`canManageMenus` mirrors `canManageSeo`.

## Admin UI (`apps/web/app/admin/menus`, English, outside locale routing)
- List/select a menu (or create one for a location).
- **Drag-sortable builder**: reorder items within a level and indent/outdent to nest;
  a single "Save structure" action calls `PUT /menus/:id/structure`.
- Item editor: type selector → target picker (loads posts / pages / categories admin
  lists) or a custom-URL field; label; open-in-new-tab; a per-locale label tab strip
  (de/ru) calling the translation endpoints.
- All mutations are Server Actions (`'use server'`) that `revalidatePath` the public
  layout so changes show immediately; the API bearer token never reaches the client.

## Public rendering
- Server component `components/public/site-menu.tsx` (`<SiteMenu location=... />`):
  fetches `/public/menus/:location?locale`, renders a nested `<ul>` (2-level dropdown),
  labels as escaped text, `target="_blank" rel="noopener noreferrer"` when
  `openInNewTab`. On fetch error / empty tree → renders the theme's existing static
  links (graceful degradation; the site always renders).
- Wired into the **editorial** and **magazine** theme layouts (header `primary`,
  footer `footer`). The `LocaleSwitcher`, sign-in, and account links stay as theme
  chrome (auth-state / locale UI, not menu content).

## Observer / events
No genuine side effect today → **no event emitted** (REFACTOR_PLAN §2.7). The
`menu.changed` action is recorded as the future hook point for cache invalidation when
the caching layer (§7 #10) lands.

## Seed
Idempotent (upsert by `location`): a `primary` menu (Blog, Services, Search, plus one
nested example under a parent) and a `footer` menu, each with de/ru label
translations — the demo shows managed, localized navigation replacing the hardcoded
nav.

## Behaviour-preservation / invariants
- Repos never catch `P2002`/`P2025` — the service maps them to HTTP (location
  conflict → 409, missing item/menu → 404), per REFACTOR_PLAN §2.4.
- `$transaction` array-batch form where a multi-write is atomic (the structure bulk
  update applies all `{parentId, order}` updates in one `$transaction([...])`).
- Translation overlay reuses the pure `localizeContent` resolver from §7 #1 (label
  only); junk/absent locale → default.
- Public payload never exposes admin-only fields (raw `targetId`/`type`); it returns
  only the resolved `{ label, url, openInNewTab, children }`.

## Testing
- **Repository contract tests** (mocked Prisma): nested `include` shape for the
  builder read; `slugsByIds` query shape; the structure bulk `$transaction` form;
  ordering (`order asc`). Trivial inherited CRUD not tautologically tested.
- **Service tests** (fake repos): URL resolution per type; slug-drift drop; custom-URL
  validation (accept relative/http(s), reject `javascript:`); translation overlay +
  fallback; structure validation (foreign id, cycle, cross-menu id rejected);
  P2002/P2025 → HTTP mapping.
- **Pure tests**: `resolveMenuItemUrl`, custom-URL validator, tree builder.
- **Web**: unit-test the public tree → rendered-node mapping if a pure helper is
  extracted.
- Gates: `pnpm test` green, `pnpm typecheck`, `pnpm lint`, coverage ≥80% on
  services+repos; rebuild + `pnpm e2e` 11/11; live curl/SSR verification (header +
  footer menus render localized; page route + category filter resolve).

## Rollback
One reversible migration; the module is additive. Revert = drop the module + migration
down; themes fall back to static links automatically.
