# Menu Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin drag-sortable menu builder whose nested items reference posts/pages/categories/custom URLs, are per-locale, and render as managed navigation in the public site header + footer.

**Architecture:** New NestJS `menus` module (`MenuController → MenuService → MenuRepository/MenuItemRepository`); repositories in `packages/db`; per-locale label translation reuses the §7 #1 pattern (`localizeContent`); public reads return a resolved, localized tree; new public web routes (`/[slug]` page, `/blog?category=`) make all four item types resolve.

**Tech Stack:** NestJS 10 (CommonJS), Prisma + Postgres, Zod (`@cmstack-ts/config`), Next.js 15 App Router (web), Vitest, Biome.

## Global Constraints (copied from the spec / engagement rules)
- Three-layer rule: controller thin; service owns business logic + observer; repository framework-free, returns Prisma payloads, **never catches P2002/P2025** (REFACTOR_PLAN §2.0/§2.4).
- Repo file exports: `interface XRepository`, `X_REPOSITORY` Symbol, `PrismaXRepository`; trivial CRUD extends `PrismaCrudRepository`. Wire via `provideRepository(TOKEN, Impl)`.
- Service tests use fakes typed `Record<keyof XRepository, Mock>` cast `as unknown as XRepository`. Import model + repo types from `@cmstack-ts/db`, never `@prisma/client` (web/api code); the repo **impl files** may import from `@prisma/client` like the existing ones.
- Locales from `@cmstack-ts/config` `LOCALES`/`DEFAULT_LOCALE`; junk/absent locale → default.
- `$transaction` array-batch form for multi-write atomic ops; never interactive form.
- No observer event now (no real side effect; REFACTOR_PLAN §2.7) — record `menu.changed` as a future hook point only.
- Migrations additive/reversible. Coverage ≥80% on services+repos. Code/comments/docs in English; operator replies in Russian. **No `Co-Authored-By` trailer in commits.**
- **Write-tool gotcha:** after any `Write`, strip a stray trailing `</content>` line: `perl -0pi -e 's/\n?<\/content>\s*$//' <file>` then `pnpm format`.
- `packages/db` prisma commands need `DATABASE_URL` passed explicitly; docker `db` container (DB `typress`, creds `typress/typress/typress`) is likely already up.

---

### Task 1: Config schemas + pure URL resolver

**Files:**
- Create: `packages/config/src/menu.ts`
- Create: `packages/config/src/menu.test.ts`
- Modify: `packages/config/src/index.ts` (re-export the new symbols)

**Interfaces:**
- Produces: `menuItemTypeSchema`, `MenuItemType`; `createMenuSchema`/`CreateMenuInput`, `updateMenuSchema`/`UpdateMenuInput`, `menuSummarySchema`/`MenuSummary`; `createMenuItemSchema`/`CreateMenuItemInput`, `updateMenuItemSchema`/`UpdateMenuItemInput`; `menuStructureSchema`/`MenuStructureInput`; `menuItemTranslationInputSchema`/`MenuItemTranslationInput`; `menuNodeSchema`/`MenuNode`, `publicMenuSchema`/`PublicMenu`; pure `resolveMenuItemUrl(type, slug, url)` and `normalizeCustomUrl(url)`.

- [ ] **Step 1: Write the failing test** — `packages/config/src/menu.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createMenuItemSchema,
  menuStructureSchema,
  normalizeCustomUrl,
  resolveMenuItemUrl,
} from './menu';

describe('resolveMenuItemUrl', () => {
  it('maps POST to the blog post path', () => {
    expect(resolveMenuItemUrl('POST', 'hello-world', null)).toBe('/blog/hello-world');
  });
  it('maps PAGE to the root slug path', () => {
    expect(resolveMenuItemUrl('PAGE', 'about', null)).toBe('/about');
  });
  it('maps CATEGORY to the blog category filter', () => {
    expect(resolveMenuItemUrl('CATEGORY', 'guides', null)).toBe('/blog?category=guides');
  });
  it('returns the custom url verbatim', () => {
    expect(resolveMenuItemUrl('CUSTOM', null, 'https://x.test/a')).toBe('https://x.test/a');
  });
  it('returns null when a reference slug is missing (dropped at render)', () => {
    expect(resolveMenuItemUrl('POST', null, null)).toBeNull();
  });
});

describe('normalizeCustomUrl', () => {
  it('accepts a site-relative path', () => {
    expect(normalizeCustomUrl('/contact')).toBe('/contact');
  });
  it('accepts an absolute http(s) url', () => {
    expect(normalizeCustomUrl('https://x.test')).toBe('https://x.test');
  });
  it('rejects a javascript: url', () => {
    expect(normalizeCustomUrl('javascript:alert(1)')).toBeNull();
  });
  it('rejects a relative path without a leading slash', () => {
    expect(normalizeCustomUrl('contact')).toBeNull();
  });
});

describe('createMenuItemSchema', () => {
  it('requires url for CUSTOM and rejects a bad protocol', () => {
    expect(createMenuItemSchema.safeParse({ type: 'CUSTOM', label: 'X', url: 'javascript:1' }).success).toBe(false);
    expect(createMenuItemSchema.safeParse({ type: 'CUSTOM', label: 'X', url: '/ok' }).success).toBe(true);
  });
  it('requires targetId for POST', () => {
    expect(createMenuItemSchema.safeParse({ type: 'POST', label: 'X' }).success).toBe(false);
    expect(createMenuItemSchema.safeParse({ type: 'POST', label: 'X', targetId: 'abc' }).success).toBe(true);
  });
});

describe('menuStructureSchema', () => {
  it('accepts a flat list of nodes', () => {
    const r = menuStructureSchema.safeParse({ nodes: [{ id: 'a', parentId: null, order: 0 }] });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/config/src/menu.test.ts`
Expected: FAIL — cannot resolve `./menu`.

- [ ] **Step 3: Write the implementation** — `packages/config/src/menu.ts`:

```ts
import { z } from 'zod';
import { localeSchema } from './locale';

/** A menu item points at a Post, Page, Category, or a free custom URL. */
export const menuItemTypeSchema = z.enum(['POST', 'PAGE', 'CATEGORY', 'CUSTOM']);
export type MenuItemType = z.infer<typeof menuItemTypeSchema>;

/**
 * Validate a custom URL: only a site-relative path ("/...") or an absolute
 * http(s) URL is allowed. Returns the trimmed URL or null when unsafe — guards
 * against `javascript:`/`data:` XSS in the rendered href.
 */
export function normalizeCustomUrl(raw: string): string | null {
  const url = raw.trim();
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** Resolve a menu item to its public href from its current target slug. */
export function resolveMenuItemUrl(
  type: MenuItemType,
  slug: string | null,
  url: string | null,
): string | null {
  switch (type) {
    case 'POST':
      return slug ? `/blog/${slug}` : null;
    case 'PAGE':
      return slug ? `/${slug}` : null;
    case 'CATEGORY':
      return slug ? `/blog?category=${slug}` : null;
    case 'CUSTOM':
      return url ?? null;
  }
}

const labelSchema = z.string().trim().min(1).max(200);
const locationSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9-]+$/, 'location must be lowercase alphanumeric with dashes');

// --- Menu (container) --------------------------------------------------------

export const createMenuSchema = z.object({
  name: z.string().trim().min(1).max(120),
  location: locationSchema,
});
export type CreateMenuInput = z.infer<typeof createMenuSchema>;

export const updateMenuSchema = createMenuSchema.partial();
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;

export const menuSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
});
export type MenuSummary = z.infer<typeof menuSummarySchema>;

// --- Menu item ---------------------------------------------------------------

const menuItemBase = z.object({
  type: menuItemTypeSchema,
  label: labelSchema,
  targetId: z.string().trim().min(1).max(64).optional(),
  url: z.string().trim().min(1).max(2000).optional(),
  openInNewTab: z.boolean().optional(),
  parentId: z.string().trim().min(1).max(64).nullable().optional(),
  order: z.number().int().min(0).max(100000).optional(),
});

/** A reference item needs targetId; CUSTOM needs a safe url. */
function refineItem<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((val: z.infer<typeof menuItemBase>, ctx) => {
    if (val.type === 'CUSTOM') {
      if (!val.url || normalizeCustomUrl(val.url) === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CUSTOM items need a valid http(s) or "/" url', path: ['url'] });
      }
    } else if (!val.targetId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${val.type} items need a targetId`, path: ['targetId'] });
    }
  });
}

export const createMenuItemSchema = refineItem(menuItemBase);
export type CreateMenuItemInput = z.infer<typeof menuItemBase>;

export const updateMenuItemSchema = refineItem(menuItemBase);
export type UpdateMenuItemInput = z.infer<typeof menuItemBase>;

// --- Structure (bulk reorder + reparent) -------------------------------------

export const menuStructureSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(64),
        parentId: z.string().trim().min(1).max(64).nullable(),
        order: z.number().int().min(0).max(100000),
      }),
    )
    .max(500),
});
export type MenuStructureInput = z.infer<typeof menuStructureSchema>;

// --- Translation (label only) ------------------------------------------------

export const menuItemTranslationInputSchema = z.object({
  label: z.string().trim().max(200).optional(),
});
export type MenuItemTranslationInput = z.infer<typeof menuItemTranslationInputSchema>;

// --- Public resolved tree ----------------------------------------------------

export type MenuNode = {
  label: string;
  url: string;
  openInNewTab: boolean;
  children: MenuNode[];
};
export const menuNodeSchema: z.ZodType<MenuNode> = z.lazy(() =>
  z.object({
    label: z.string(),
    url: z.string(),
    openInNewTab: z.boolean(),
    children: z.array(menuNodeSchema),
  }),
);
export const publicMenuSchema = z.object({
  location: z.string(),
  items: z.array(menuNodeSchema),
});
export type PublicMenu = z.infer<typeof publicMenuSchema>;

export { localeSchema };
```

- [ ] **Step 4: Add re-exports to `packages/config/src/index.ts`** — append a block mirroring the existing export groups:

```ts
export {
  menuItemTypeSchema,
  type MenuItemType,
  createMenuSchema,
  type CreateMenuInput,
  updateMenuSchema,
  type UpdateMenuInput,
  menuSummarySchema,
  type MenuSummary,
  createMenuItemSchema,
  type CreateMenuItemInput,
  updateMenuItemSchema,
  type UpdateMenuItemInput,
  menuStructureSchema,
  type MenuStructureInput,
  menuItemTranslationInputSchema,
  type MenuItemTranslationInput,
  menuNodeSchema,
  type MenuNode,
  publicMenuSchema,
  type PublicMenu,
  resolveMenuItemUrl,
  normalizeCustomUrl,
} from './menu';
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm vitest run packages/config/src/menu.test.ts && pnpm --filter @cmstack-ts/config build`
Expected: PASS; config builds clean.

- [ ] **Step 6: Strip Write artifact + format + commit**

```bash
perl -0pi -e 's/\n?<\/content>\s*$//' packages/config/src/menu.ts packages/config/src/menu.test.ts
pnpm format
git add packages/config/src/menu.ts packages/config/src/menu.test.ts packages/config/src/index.ts
git commit -m "feat(config): menu schemas + pure url resolver/validator"
```

---

### Task 2: Prisma schema + migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (add `Menu`, `MenuItem`, `MenuItemTranslation`, `MenuItemType` enum; add `menus`/back-relations are not needed on Post/Page/Category since `targetId` is non-FK)
- Create: migration dir `packages/db/prisma/migrations/<timestamp>_menu_management/migration.sql`

**Interfaces:**
- Produces: Prisma models `Menu`, `MenuItem`, `MenuItemTranslation`; generated client types reused by Task 3.

- [ ] **Step 1: Add the models to `schema.prisma`** (after the SEO section, before Comments):

```prisma
// --- Menus / Navigation (Task 1 §7 #4) ---------------------------------------

enum MenuItemType {
  POST
  PAGE
  CATEGORY
  CUSTOM
}

/// A named navigation menu bound to a theme render location (e.g. "primary",
/// "footer"). The location is the stable key the public theme renders by.
model Menu {
  id        String     @id @default(cuid())
  name      String
  location  String     @unique
  items     MenuItem[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

/// A single menu entry. Nested via self-referential parentId (public dropdowns).
/// targetId is a polymorphic, non-FK reference to a Post/Page/Category row for
/// the matching type; CUSTOM items carry a url instead. The base label is the
/// default locale (en); per-locale overrides live in MenuItemTranslation.
model MenuItem {
  id           String                @id @default(cuid())
  menuId       String
  menu         Menu                  @relation(fields: [menuId], references: [id], onDelete: Cascade)
  parentId     String?
  parent       MenuItem?             @relation("MenuItemTree", fields: [parentId], references: [id], onDelete: Cascade)
  children     MenuItem[]            @relation("MenuItemTree")
  order        Int                   @default(0)
  type         MenuItemType
  label        String
  targetId     String?
  url          String?
  openInNewTab Boolean               @default(false)
  translations MenuItemTranslation[]
  createdAt    DateTime              @default(now())
  updatedAt    DateTime              @updatedAt

  @@index([menuId])
  @@index([parentId])
}

/// Per-locale label override for a MenuItem (see PostTranslation pattern). Only
/// the label is translatable; a null label falls back to the base item label.
model MenuItemTranslation {
  id         String   @id @default(cuid())
  menuItemId String
  menuItem   MenuItem @relation(fields: [menuItemId], references: [id], onDelete: Cascade)
  locale     String
  label      String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([menuItemId, locale])
  @@index([locale])
}
```

- [ ] **Step 2: Create the migration** (do not let Prisma reset; the db is shared):

```bash
export DATABASE_URL="postgresql://typress:typress@localhost:5432/typress?schema=public"
pnpm --filter @cmstack-ts/db exec prisma migrate dev --name menu_management --create-only
```

- [ ] **Step 3: Review the generated `migration.sql`** — confirm it only `CREATE TYPE "MenuItemType"`, `CREATE TABLE "Menu"/"MenuItem"/"MenuItemTranslation"`, indexes, FKs (`ON DELETE CASCADE` for menu/parent/menuItem). No `DROP`/`ALTER` of existing tables (additive/reversible).

- [ ] **Step 4: Apply + generate**

```bash
pnpm --filter @cmstack-ts/db exec prisma migrate deploy
pnpm db:generate
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): Menu/MenuItem/MenuItemTranslation models + migration"
```

---

### Task 3: Repositories (+ slugsByIds on Post/Page/Category) + contract tests

**Files:**
- Create: `packages/db/src/repositories/menu.repository.ts`
- Create: `packages/db/src/repositories/menu.repository.spec.ts`
- Modify: `packages/db/src/repositories/post.repository.ts` (add `slugsByIds`)
- Modify: `packages/db/src/repositories/page.repository.ts` (add `slugsByIds`)
- Modify: `packages/db/src/repositories/category.repository.ts` (add `slugsByIds`)
- Modify: `packages/db/src/repositories/index.ts` (barrel export the new file)

**Interfaces:**
- Consumes: `PrismaCrudRepository` base; `PrismaClient` from `@prisma/client`.
- Produces:
  - `MENU_REPOSITORY` Symbol, `MenuRepository` interface, `PrismaMenuRepository`.
  - `MenuWithTree = Prisma.MenuGetPayload<{ include: typeof menuWithTreeInclude }>`.
  - `MenuItemRow`, `MenuItemTranslationRow` payload aliases.
  - `MenuItemCreateData`, `MenuItemUpdateData`, `StructureNode` types.
  - `MENU_REPOSITORY` methods (below).
  - `PostRepository.slugsByIds(ids: string[]): Promise<Record<string, string>>` (+ on Page/Category).

- [ ] **Step 1: Write the repository contract test** — `packages/db/src/repositories/menu.repository.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { PrismaMenuRepository } from './menu.repository';

function fakePrisma() {
  return {
    menu: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    menuItem: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    menuItemTranslation: { upsert: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    // biome-ignore lint/suspicious/noExplicitAny: test double
  } as any;
}

describe('PrismaMenuRepository', () => {
  it('findByLocation includes the nested item tree ordered by order asc', async () => {
    const p = fakePrisma();
    p.menu.findUnique.mockResolvedValue({ id: 'm1', location: 'primary', items: [] });
    const repo = new PrismaMenuRepository(p);
    await repo.findByLocation('primary');
    const arg = p.menu.findUnique.mock.calls[0][0];
    expect(arg.where).toEqual({ location: 'primary' });
    expect(arg.include.items.orderBy).toEqual([{ order: 'asc' }, { createdAt: 'asc' }]);
    expect(arg.include.items.include.translations).toBeDefined();
  });

  it('applyStructure issues one $transaction of per-node updates', async () => {
    const p = fakePrisma();
    const repo = new PrismaMenuRepository(p);
    await repo.applyStructure('m1', [
      { id: 'a', parentId: null, order: 0 },
      { id: 'b', parentId: 'a', order: 0 },
    ]);
    expect(p.$transaction).toHaveBeenCalledTimes(1);
    expect(p.menuItem.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { parentId: null, order: 0 } });
    expect(p.menuItem.update).toHaveBeenCalledWith({ where: { id: 'b' }, data: { parentId: 'a', order: 0 } });
  });

  it('listItemIds returns the ids belonging to a menu', async () => {
    const p = fakePrisma();
    p.menuItem.findMany = vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const repo = new PrismaMenuRepository(p);
    const ids = await repo.listItemIds('m1');
    expect(p.menuItem.findMany).toHaveBeenCalledWith({ where: { menuId: 'm1' }, select: { id: true } });
    expect(ids).toEqual(['a', 'b']);
  });

  it('upsertTranslation writes a full row on the [menuItemId, locale] unique', async () => {
    const p = fakePrisma();
    const repo = new PrismaMenuRepository(p);
    await repo.upsertTranslation('i1', 'de', { label: 'Hallo' });
    const arg = p.menuItemTranslation.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ menuItemId_locale: { menuItemId: 'i1', locale: 'de' } });
    expect(arg.create).toEqual({ menuItemId: 'i1', locale: 'de', label: 'Hallo' });
    expect(arg.update).toEqual({ label: 'Hallo' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/db/src/repositories/menu.repository.spec.ts`
Expected: FAIL — cannot resolve `./menu.repository`.

- [ ] **Step 3: Write `packages/db/src/repositories/menu.repository.ts`:**

```ts
import { type Menu, type Prisma, type PrismaClient } from '@prisma/client';
import { PrismaCrudRepository } from './crud.repository';

export const menuItemTranslationInclude = true as const;

export const menuWithTreeInclude = {
  items: {
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] as const,
    include: { translations: menuItemTranslationInclude },
  },
} satisfies Prisma.MenuInclude;

export type MenuWithTree = Prisma.MenuGetPayload<{ include: typeof menuWithTreeInclude }>;
export type MenuItemRow = MenuWithTree['items'][number];
export type MenuItemTranslationRow = MenuItemRow['translations'][number];

export type MenuItemCreateData = {
  menuId: string;
  parentId: string | null;
  order: number;
  type: MenuItemRow['type'];
  label: string;
  targetId: string | null;
  url: string | null;
  openInNewTab: boolean;
};
export type MenuItemUpdateData = Partial<Omit<MenuItemCreateData, 'menuId'>>;
export type StructureNode = { id: string; parentId: string | null; order: number };

export interface MenuRepository {
  list(): Promise<Menu[]>;
  findById(id: string): Promise<MenuWithTree | null>;
  findByLocation(location: string): Promise<MenuWithTree | null>;
  create(data: { name: string; location: string }): Promise<Menu>;
  update(id: string, data: { name?: string; location?: string }): Promise<Menu>;
  exists(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<void>;
  // items
  createItem(data: MenuItemCreateData): Promise<MenuItemRow>;
  updateItem(id: string, data: MenuItemUpdateData): Promise<MenuItemRow>;
  itemExists(id: string, menuId: string): Promise<boolean>;
  deleteItem(id: string): Promise<void>;
  listItemIds(menuId: string): Promise<string[]>;
  applyStructure(menuId: string, nodes: StructureNode[]): Promise<void>;
  // translations
  upsertTranslation(menuItemId: string, locale: string, data: { label: string | null }): Promise<void>;
  deleteTranslation(menuItemId: string, locale: string): Promise<void>;
}

export const MENU_REPOSITORY = Symbol('MENU_REPOSITORY');

export class PrismaMenuRepository extends PrismaCrudRepository implements MenuRepository {
  constructor(private readonly prisma: PrismaClient) {
    super(prisma.menu);
  }

  list(): Promise<Menu[]> {
    return this.prisma.menu.findMany({ orderBy: [{ location: 'asc' }] });
  }

  findById(id: string): Promise<MenuWithTree | null> {
    return this.prisma.menu.findUnique({ where: { id }, include: menuWithTreeInclude });
  }

  findByLocation(location: string): Promise<MenuWithTree | null> {
    return this.prisma.menu.findUnique({ where: { location }, include: menuWithTreeInclude });
  }

  create(data: { name: string; location: string }): Promise<Menu> {
    return this.prisma.menu.create({ data });
  }

  update(id: string, data: { name?: string; location?: string }): Promise<Menu> {
    return this.prisma.menu.update({ where: { id }, data });
  }

  createItem(data: MenuItemCreateData): Promise<MenuItemRow> {
    return this.prisma.menuItem.create({ data, include: { translations: menuItemTranslationInclude } });
  }

  updateItem(id: string, data: MenuItemUpdateData): Promise<MenuItemRow> {
    return this.prisma.menuItem.update({ where: { id }, data, include: { translations: menuItemTranslationInclude } });
  }

  async itemExists(id: string, menuId: string): Promise<boolean> {
    return (await this.prisma.menuItem.count({ where: { id, menuId } })) > 0;
  }

  async deleteItem(id: string): Promise<void> {
    await this.prisma.menuItem.delete({ where: { id } });
  }

  async listItemIds(menuId: string): Promise<string[]> {
    const rows = await this.prisma.menuItem.findMany({ where: { menuId }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  async applyStructure(_menuId: string, nodes: StructureNode[]): Promise<void> {
    await this.prisma.$transaction(
      nodes.map((n) =>
        this.prisma.menuItem.update({ where: { id: n.id }, data: { parentId: n.parentId, order: n.order } }),
      ),
    );
  }

  async upsertTranslation(menuItemId: string, locale: string, data: { label: string | null }): Promise<void> {
    await this.prisma.menuItemTranslation.upsert({
      where: { menuItemId_locale: { menuItemId, locale } },
      create: { menuItemId, locale, label: data.label },
      update: { label: data.label },
    });
  }

  async deleteTranslation(menuItemId: string, locale: string): Promise<void> {
    await this.prisma.menuItemTranslation.delete({ where: { menuItemId_locale: { menuItemId, locale } } });
  }
}
```

- [ ] **Step 4: Add `slugsByIds` to Post/Page/Category repos.** In each repo's interface add `slugsByIds(ids: string[]): Promise<Record<string, string>>;` and implement (Post example):

```ts
async slugsByIds(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const rows = await this.prisma.post.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true } });
  return Object.fromEntries(rows.map((r) => [r.id, r.slug]));
}
```

Repeat verbatim for `page`/`category` (swap `this.prisma.post` → `.page` / `.category`). Add a contract test for one of them in its existing spec file asserting the `where: { id: { in } }, select: { id, slug }` shape.

- [ ] **Step 5: Barrel export** — add to `packages/db/src/repositories/index.ts`: `export * from './menu.repository';`

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm vitest run packages/db/src/repositories/menu.repository.spec.ts && pnpm --filter @cmstack-ts/db build`
Expected: PASS; db builds clean.

- [ ] **Step 7: Strip artifact + format + commit**

```bash
perl -0pi -e 's/\n?<\/content>\s*$//' packages/db/src/repositories/menu.repository.ts packages/db/src/repositories/menu.repository.spec.ts
pnpm format
git add packages/db/src/repositories
git commit -m "feat(db): menu repository (tree read, structure tx, translations) + slugsByIds"
```

---

### Task 4: MenuService + tests

**Files:**
- Create: `apps/api/src/menus/menu.service.ts`
- Create: `apps/api/src/menus/menu.service.spec.ts`

**Interfaces:**
- Consumes: `MENU_REPOSITORY`/`MenuRepository`, `POST_REPOSITORY`/`PAGE_REPOSITORY`/`CATEGORY_REPOSITORY` (for `slugsByIds`), all from `@cmstack-ts/db`; `localizeContent` (copy the pure helper — see Step 3); config schemas/types; `LOCALES`/`DEFAULT_LOCALE`.
- Produces: `MenuService` with:
  - `listMenus(): Promise<MenuSummary[]>`
  - `getMenu(id): Promise<AdminMenu>` (full tree + all translations; throws 404)
  - `createMenu(input): Promise<MenuSummary>` (P2002 location → 409)
  - `updateMenu(id, input): Promise<MenuSummary>` (404 / 409)
  - `deleteMenu(id): Promise<void>` (404)
  - `createItem(menuId, input): Promise<AdminMenuItem>` (validates target exists / custom url; 404)
  - `updateItem(menuId, itemId, input): Promise<AdminMenuItem>` (404)
  - `deleteItem(menuId, itemId): Promise<void>` (404)
  - `applyStructure(menuId, input): Promise<void>` (validates ids ⊆ menu, no cycle; 400/404)
  - `upsertTranslation(menuId, itemId, locale, input): Promise<void>` (empty label → delete; 404)
  - `deleteTranslation(menuId, itemId, locale): Promise<void>` (idempotent)
  - `getPublicMenu(location, locale): Promise<PublicMenu>` (resolved, localized tree; unknown → empty)

- [ ] **Step 1: Write the failing service test** — `apps/api/src/menus/menu.service.spec.ts` (key behaviours):

```ts
import type { MenuRepository, MenuWithTree } from '@cmstack-ts/db';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuService } from './menu.service';

function item(over: Partial<MenuWithTree['items'][number]>): MenuWithTree['items'][number] {
  return {
    id: 'i1', menuId: 'm1', parentId: null, order: 0, type: 'CUSTOM', label: 'Home',
    targetId: null, url: '/', openInNewTab: false, translations: [],
    createdAt: new Date(), updatedAt: new Date(), ...over,
  } as MenuWithTree['items'][number];
}

let menus: Record<keyof MenuRepository, Mock>;
let posts: { slugsByIds: Mock };
let pages: { slugsByIds: Mock };
let categories: { slugsByIds: Mock };
let service: MenuService;

beforeEach(() => {
  menus = {
    list: vi.fn(), findById: vi.fn(), findByLocation: vi.fn(), create: vi.fn(), update: vi.fn(),
    exists: vi.fn(), hardDelete: vi.fn(), createItem: vi.fn(), updateItem: vi.fn(), itemExists: vi.fn(),
    deleteItem: vi.fn(), listItemIds: vi.fn(), applyStructure: vi.fn(), upsertTranslation: vi.fn(),
    deleteTranslation: vi.fn(),
  };
  posts = { slugsByIds: vi.fn().mockResolvedValue({}) };
  pages = { slugsByIds: vi.fn().mockResolvedValue({}) };
  categories = { slugsByIds: vi.fn().mockResolvedValue({}) };
  service = new MenuService(
    menus as unknown as MenuRepository,
    posts as never, pages as never, categories as never,
  );
});

describe('getPublicMenu', () => {
  it('resolves urls, overlays the locale label, nests children, drops unresolved targets', async () => {
    posts.slugsByIds.mockResolvedValue({ p1: 'hello' });
    menus.findByLocation.mockResolvedValue({
      id: 'm1', name: 'Main', location: 'primary', createdAt: new Date(), updatedAt: new Date(),
      items: [
        item({ id: 'a', type: 'POST', targetId: 'p1', url: null, label: 'Post', translations: [{ id: 't', menuItemId: 'a', locale: 'de', label: 'Beitrag', createdAt: new Date(), updatedAt: new Date() }] }),
        item({ id: 'b', parentId: 'a', type: 'POST', targetId: 'missing', url: null, label: 'Gone' }),
        item({ id: 'c', type: 'CUSTOM', url: '/x', label: 'X' }),
      ],
    } as MenuWithTree);
    const menu = await service.getPublicMenu('primary', 'de');
    expect(menu.items).toHaveLength(2); // 'a' (with no children — 'b' dropped) and 'c'
    expect(menu.items[0]).toMatchObject({ label: 'Beitrag', url: '/blog/hello', children: [] });
    expect(menu.items[1]).toMatchObject({ label: 'X', url: '/x' });
  });

  it('returns an empty tree for an unknown location', async () => {
    menus.findByLocation.mockResolvedValue(null);
    expect((await service.getPublicMenu('nope', 'en')).items).toEqual([]);
  });
});

describe('createMenu', () => {
  it('maps a duplicate location P2002 to 409', async () => {
    menus.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5' }));
    await expect(service.createMenu({ name: 'A', location: 'primary' })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('createItem', () => {
  it('rejects a reference item whose target does not exist', async () => {
    menus.exists.mockResolvedValue(true);
    posts.slugsByIds.mockResolvedValue({}); // target missing
    await expect(service.createItem('m1', { type: 'POST', label: 'X', targetId: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('applyStructure', () => {
  it('rejects a node id that is not in the menu', async () => {
    menus.exists.mockResolvedValue(true);
    menus.listItemIds.mockResolvedValue(['a']);
    await expect(service.applyStructure('m1', { nodes: [{ id: 'b', parentId: null, order: 0 }] })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects a parent cycle', async () => {
    menus.exists.mockResolvedValue(true);
    menus.listItemIds.mockResolvedValue(['a', 'b']);
    await expect(service.applyStructure('m1', { nodes: [{ id: 'a', parentId: 'b', order: 0 }, { id: 'b', parentId: 'a', order: 0 }] })).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/api/src/menus/menu.service.spec.ts`
Expected: FAIL — cannot resolve `./menu.service`.

- [ ] **Step 3: Write `apps/api/src/menus/menu.service.ts`.** Use `localizeContent` from the existing content module via relative import `../content/localize` (it is pure and framework-free; reuse, don't duplicate). Key shape:

```ts
import {
  CATEGORY_REPOSITORY, type CategoryRepository,
  MENU_REPOSITORY, type MenuRepository, type MenuItemRow, type MenuWithTree,
  PAGE_REPOSITORY, type PageRepository,
  POST_REPOSITORY, type PostRepository,
} from '@cmstack-ts/db';
import {
  DEFAULT_LOCALE, LOCALES,
  type CreateMenuInput, type CreateMenuItemInput, type MenuNode, type MenuStructureInput,
  type MenuSummary, type MenuItemTranslationInput, type PublicMenu, type UpdateMenuInput,
  type UpdateMenuItemInput, normalizeCustomUrl, resolveMenuItemUrl,
} from '@cmstack-ts/config';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type AdminMenuItem = {
  id: string; parentId: string | null; order: number; type: MenuItemRow['type'];
  label: string; targetId: string | null; url: string | null; openInNewTab: boolean;
  translations: { locale: string; label: string | null }[];
};
export type AdminMenu = { id: string; name: string; location: string; items: AdminMenuItem[] };

@Injectable()
export class MenuService {
  constructor(
    @Inject(MENU_REPOSITORY) private readonly menus: MenuRepository,
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(PAGE_REPOSITORY) private readonly pages: PageRepository,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
  ) {}

  // ... methods per the Interfaces block. Implementation notes:
  // - createMenu/updateMenu: try/catch → P2002 ConflictException; P2025 NotFoundException.
  // - createItem/updateItem: if type !== CUSTOM, look up the single slug via the matching
  //   repo.slugsByIds([targetId]); empty → BadRequestException('target not found').
  //   if CUSTOM, normalizeCustomUrl(url) ?? throw BadRequestException. Persist normalized url.
  // - new items get order = (current max sibling order + 1); parentId defaults null.
  // - applyStructure: assert menu exists (404); ids set === listItemIds set (else 400);
  //   detect a cycle by walking parent links (else 400); then menus.applyStructure.
  // - upsertTranslation: trim label; empty → menus.deleteTranslation; else upsert.
  // - getMenu/getPublicMenu below.
  }
```

Resolution + localization helpers (the heart of the feature):

```ts
private async resolveSlugMaps(items: MenuWithTree['items']) {
  const byType = (t: string) => items.filter((i) => i.type === t && i.targetId).map((i) => i.targetId as string);
  const [postSlugs, pageSlugs, catSlugs] = await Promise.all([
    this.posts.slugsByIds(byType('POST')),
    this.pages.slugsByIds(byType('PAGE')),
    this.categories.slugsByIds(byType('CATEGORY')),
  ]);
  return { POST: postSlugs, PAGE: pageSlugs, CATEGORY: catSlugs } as Record<string, Record<string, string>>;
}

async getPublicMenu(location: string, locale: string): Promise<PublicMenu> {
  const safeLocale = (LOCALES as readonly string[]).includes(locale) ? locale : DEFAULT_LOCALE;
  const menu = await this.menus.findByLocation(location);
  if (!menu) return { location, items: [] };
  const slugs = await this.resolveSlugMaps(menu.items);

  const resolve = (i: MenuWithTree['items'][number]): MenuNode | null => {
    const slug = i.type === 'CUSTOM' ? null : (slugs[i.type]?.[i.targetId ?? ''] ?? null);
    const url = resolveMenuItemUrl(i.type, slug, i.url);
    if (url === null) return null; // unresolved target → drop
    const tr = i.translations.find((t) => t.locale === safeLocale);
    const label = tr?.label != null && tr.label !== '' ? tr.label : i.label;
    return { label, url, openInNewTab: i.openInNewTab, children: [] };
  };

  // Build the tree from the flat ordered list (items already ordered asc).
  const nodesById = new Map<string, { item: MenuWithTree['items'][number]; node: MenuNode }>();
  for (const i of menu.items) {
    const node = resolve(i);
    if (node) nodesById.set(i.id, { item: i, node });
  }
  const roots: MenuNode[] = [];
  for (const { item, node } of nodesById.values()) {
    const parent = item.parentId ? nodesById.get(item.parentId) : null;
    if (parent) parent.node.children.push(node);
    else roots.push(node);
  }
  return { location, items: roots };
}
```

(`getMenu` returns the full admin tree with **all** translation rows mapped to `{ locale, label }`, nesting via the same parent-map but without dropping/resolving — admin sees raw items. Implement analogously, no slug resolution.)

- [ ] **Step 4: Run tests until green**

Run: `pnpm vitest run apps/api/src/menus/menu.service.spec.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Strip artifact + format + commit**

```bash
perl -0pi -e 's/\n?<\/content>\s*$//' apps/api/src/menus/menu.service.ts apps/api/src/menus/menu.service.spec.ts
pnpm format
git add apps/api/src/menus
git commit -m "feat(api): MenuService (url resolution, locale overlay, structure validation)"
```

---

### Task 5: Controllers + module wiring + CASL subject

**Files:**
- Create: `apps/api/src/menus/menu.controller.ts` (admin, gated `Menu`)
- Create: `apps/api/src/menus/public-menu.controller.ts` (unauthenticated)
- Create: `apps/api/src/menus/menus.module.ts`
- Modify: `apps/api/src/app.module.ts` (import `MenusModule`)
- Modify: `apps/api/src/authz/*` if a subject allow-list exists (grep `'Seo'` to find where subjects are typed/listed; add `'Menu'`)

**Interfaces:**
- Consumes: `MenuService`; the content module's `POST/PAGE/CATEGORY` repository providers (import `ContentModule` or re-provide the three repos in `MenusModule`).
- Produces: REST routes per the spec's API surface.

- [ ] **Step 1: Write `public-menu.controller.ts`:**

```ts
import { type PublicMenu, localeSchema } from '@cmstack-ts/config';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { MenuService } from './menu.service';

@Controller('public/menus')
export class PublicMenuController {
  constructor(private readonly menus: MenuService) {}

  @Get(':location')
  getMenu(@Param('location') location: string, @Query('locale') locale?: string): Promise<PublicMenu> {
    const parsed = localeSchema.safeParse(locale);
    return this.menus.getPublicMenu(location, parsed.success ? parsed.data : 'en');
  }
}
```

- [ ] **Step 2: Write `menu.controller.ts`** — thin admin controller, every route `@CheckPolicies((a) => a.can('<action>', 'Menu'))`, bodies via `ZodValidationPipe`. Routes: `GET /menus`, `GET /menus/:id`, `POST /menus`, `PATCH /menus/:id`, `DELETE /menus/:id` (`@HttpCode(204)`), `POST /menus/:id/items`, `PATCH /menus/:id/items/:itemId`, `DELETE /menus/:id/items/:itemId` (204), `PUT /menus/:id/structure` (204), `PUT /menus/:id/items/:itemId/translations/:locale` (204, body `menuItemTranslationInputSchema`, `locale` param via `localeSchema`), `DELETE /menus/:id/items/:itemId/translations/:locale` (204). Mirror `seo.controller.ts` decorators exactly.

- [ ] **Step 3: Write `menus.module.ts`:**

```ts
import {
  CATEGORY_REPOSITORY, MENU_REPOSITORY, PAGE_REPOSITORY, POST_REPOSITORY,
  PrismaCategoryRepository, PrismaMenuRepository, PrismaPageRepository, PrismaPostRepository,
} from '@cmstack-ts/db';
import { Module } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { provideRepository } from '../persistence/repository.providers';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { PublicMenuController } from './public-menu.controller';

@Module({
  imports: [AccountsModule],
  controllers: [MenuController, PublicMenuController],
  providers: [
    MenuService,
    provideRepository(MENU_REPOSITORY, PrismaMenuRepository),
    provideRepository(POST_REPOSITORY, PrismaPostRepository),
    provideRepository(PAGE_REPOSITORY, PrismaPageRepository),
    provideRepository(CATEGORY_REPOSITORY, PrismaCategoryRepository),
  ],
})
export class MenusModule {}
```

(Confirm `PrismaPostRepository`/`PrismaPageRepository`/`PrismaCategoryRepository` constructors take only `PrismaClient` — they do, per the existing impls. Providing fresh repo instances here is consistent with the "each feature module provides its own bindings" convention, REFACTOR_PLAN §2.1.)

- [ ] **Step 4: Register in `app.module.ts`** — add `MenusModule` to the `imports` array (mirror how `SeoModule` is imported).

- [ ] **Step 5: Add the `Menu` CASL subject** — grep for where subjects are enumerated:

Run: `grep -rn "'Seo'" apps/api/src/authz apps/api/src/auth packages/config/src`
Add `'Menu'` everywhere `'Seo'` appears in a subject union/list (ability factory subject type). If subjects are free strings (no union), no code change is needed beyond the seed (Task 6).

- [ ] **Step 6: Typecheck + lint + run the API spec subset**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run apps/api/src/menus`
Expected: clean; tests green.

- [ ] **Step 7: Commit**

```bash
perl -0pi -e 's/\n?<\/content>\s*$//' apps/api/src/menus/*.ts
pnpm format
git add apps/api/src/menus apps/api/src/app.module.ts apps/api/src/authz packages/config/src
git commit -m "feat(api): menu admin + public controllers, module wiring, Menu CASL subject"
```

---

### Task 6: Seed (menus + CASL grant)

**Files:**
- Modify: `packages/db/prisma/seed.ts`

- [ ] **Step 1: Add `{ action: 'manage', subject: 'Menu' }`** to the global permission list and to the **Editor** role's permission list (mirroring the `Seo` lines at seed.ts:23 and :46). Administrator already has `manage all`.

- [ ] **Step 2: Add idempotent menu seeding** (upsert by `location`). After the existing content seed, create a `primary` menu and a `footer` menu with items + de/ru label translations. Example (idempotent via delete-then-recreate items by menu, or upsert menu + recreate items):

```ts
// Idempotent: upsert the menu by location, then reset its items to the demo set.
async function seedMenu(location: string, name: string, build: (menuId: string) => Promise<void>) {
  const menu = await prisma.menu.upsert({
    where: { location }, update: { name }, create: { location, name },
  });
  await prisma.menuItem.deleteMany({ where: { menuId: menu.id } }); // cascade clears translations
  await build(menu.id);
}

await seedMenu('primary', 'Main navigation', async (menuId) => {
  const blog = await prisma.menuItem.create({ data: { menuId, type: 'CUSTOM', label: 'Blog', url: '/blog', order: 0 } });
  await prisma.menuItemTranslation.createMany({ data: [
    { menuItemId: blog.id, locale: 'de', label: 'Blog' },
    { menuItemId: blog.id, locale: 'ru', label: 'Блог' },
  ]});
  const services = await prisma.menuItem.create({ data: { menuId, type: 'CUSTOM', label: 'Services', url: '/services', order: 1 } });
  await prisma.menuItemTranslation.createMany({ data: [
    { menuItemId: services.id, locale: 'de', label: 'Leistungen' },
    { menuItemId: services.id, locale: 'ru', label: 'Услуги' },
  ]});
  // nested example: a child under Services
  await prisma.menuItem.create({ data: { menuId, parentId: services.id, type: 'CUSTOM', label: 'Search', url: '/search', order: 0 } });
});

await seedMenu('footer', 'Footer', async (menuId) => {
  await prisma.menuItem.create({ data: { menuId, type: 'CUSTOM', label: 'Search', url: '/search', order: 0 } });
});
```

- [ ] **Step 3: Run the seed against the live db**

```bash
export DATABASE_URL="postgresql://typress:typress@localhost:5432/typress?schema=public"
pnpm db:seed
```
Expected: completes; re-running is idempotent (no duplicate menus).

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/seed.ts
git commit -m "feat(db): seed primary/footer menus with de/ru labels + Menu permission"
```

---

### Task 7: Web public routes (page `/[slug]` + blog `?category=`)

**Files:**
- Create: `apps/web/app/[locale]/[slug]/page.tsx`
- Modify: `apps/web/app/[locale]/blog/page.tsx` (read `searchParams.category`)
- Check: `apps/web/lib` for the existing public API fetch helper + the post-list query type

**Interfaces:**
- Consumes: existing public API client (find it: `grep -rn "public/pages/" apps/web` to reuse the page fetch; `grep -rn "public/posts" apps/web/app/\[locale\]/blog`).

- [ ] **Step 1: Add the page route** — `app/[locale]/[slug]/page.tsx`: fetch `GET /public/pages/:slug?locale=`; on 404 call `notFound()`; render the page body through the active theme (reuse the theme resolution already used by `blog/[slug]`), and add `generateMetadata` that emits the §7 #2 page meta (localized metaTitle/metaDescription, canonicalUrl, `noindex`). Mirror `app/[locale]/blog/[slug]/page.tsx` for theme + metadata wiring.

- [ ] **Step 2: Add category filter to blog index** — in `blog/page.tsx`, accept `searchParams` (Next 15: `searchParams: Promise<{ category?: string }>`), read `category`, and pass it as `categorySlug` into the existing public posts fetch query. Verify the public posts endpoint already filters by `categorySlug` (it does — `postListQuerySchema` carries it).

- [ ] **Step 3: Live-verify the routes**

```bash
# (stack already built/running per the HANDOFF recipe)
curl -s "http://localhost:4000/public/pages/about?locale=de" | head -c 300
curl -s "http://localhost:3000/about" | grep -o "<title>[^<]*"
curl -s "http://localhost:3000/blog?category=guides" | grep -oc "article" || true
```
Expected: page JSON returns; `/about` renders (200, themed); blog filters to the category.

- [ ] **Step 4: Typecheck + lint + commit**

Run: `pnpm typecheck && pnpm lint`

```bash
git add apps/web/app/\[locale\]
git commit -m "feat(web): public page route /[slug] + blog category filter"
```

---

### Task 8: Public menu rendering (`<SiteMenu>` + theme layouts)

**Files:**
- Create: `apps/web/components/public/site-menu.tsx`
- Modify: `apps/web/themes/editorial/layout.tsx`
- Modify: `apps/web/themes/magazine/layout.tsx`

**Interfaces:**
- Consumes: `GET /public/menus/:location?locale`; `getLocale()` from next-intl; the public API base (`NEXT_PUBLIC_API_URL`/server fetch — match how `blog` fetches public data).

- [ ] **Step 1: Write `<SiteMenu>`** — an async server component:

```tsx
import type { MenuNode, PublicMenu } from '@cmstack-ts/config';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

async function fetchMenu(location: string, locale: string): Promise<PublicMenu | null> {
  try {
    const base = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const res = await fetch(`${base}/public/menus/${location}?locale=${locale}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as PublicMenu;
  } catch {
    return null;
  }
}

function renderNodes(nodes: MenuNode[], linkStyle: React.CSSProperties): ReactNode {
  return nodes.map((n, i) => (
    <li key={`${n.url}-${i}`} style={{ position: 'relative', listStyle: 'none' }}>
      <a href={n.url} style={linkStyle} {...(n.openInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {n.label}
      </a>
      {n.children.length > 0 && (
        <ul style={{ display: 'flex', gap: '0.75rem', margin: 0, padding: 0 }}>{renderNodes(n.children, linkStyle)}</ul>
      )}
    </li>
  ));
}

export async function SiteMenu({
  location, linkStyle, fallback,
}: { location: string; linkStyle: React.CSSProperties; fallback: ReactNode }) {
  const locale = await getLocale();
  const menu = await fetchMenu(location, locale);
  if (!menu || menu.items.length === 0) return <>{fallback}</>;
  return <ul style={{ display: 'flex', gap: '1.25rem', margin: 0, padding: 0 }}>{renderNodes(menu.items, linkStyle)}</ul>;
}
```

(Labels render as escaped React text — no `dangerouslySetInnerHTML`. The 2-level dropdown styling can be refined in Task 3/UI later; functional nesting is the requirement here. Use the theme's `--muted`/`--fg` link colors as `linkStyle`.)

- [ ] **Step 2: Wire into the editorial layout** — replace the hardcoded `<Link href="/blog|/services|/search">` cluster in `themes/editorial/layout.tsx` with `<SiteMenu location="primary" linkStyle={{ color: 'var(--muted)', textDecoration: 'none' }} fallback={<>…existing links…</>} />`. Keep `LocaleSwitcher`, sign-in, account as chrome. In the footer, optionally render `<SiteMenu location="footer" … fallback={null} />`.

- [ ] **Step 3: Wire into the magazine layout** — same substitution in `themes/magazine/layout.tsx` (its nav uses `var(--fg)` link color).

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
perl -0pi -e 's/\n?<\/content>\s*$//' apps/web/components/public/site-menu.tsx
pnpm format
git add apps/web/components/public/site-menu.tsx apps/web/themes
git commit -m "feat(web): SiteMenu public rendering wired into editorial + magazine themes"
```

---

### Task 9: Admin menu builder UI

**Files:**
- Create: `apps/web/app/admin/menus/page.tsx` (list/select menus)
- Create: `apps/web/app/admin/menus/[id]/page.tsx` (builder for one menu)
- Create: `apps/web/app/admin/menus/actions.ts` (Server Actions)
- Create: `apps/web/app/admin/menus/menu-builder.tsx` (client component: drag reorder + indent/outdent + item editor + locale tabs)
- Modify: the admin nav/sidebar (grep `admin/seo` to find the nav list) to add a "Menus" link
- Modify: the admin auth helper (find `canManageSeo`) to add `canManageMenus`

**Interfaces:**
- Consumes: the server-only admin API client (`lib/admin/api.ts`), `AdminMenu`/`AdminMenuItem` shapes returned by `GET /menus/:id`, the admin lists for posts/pages/categories (target pickers).

- [ ] **Step 1: Add `canManageMenus`** mirroring `canManageSeo` (checks `read`/`manage` on `Menu`). Find it: `grep -rn "canManageSeo" apps/web`.

- [ ] **Step 2: Server Actions** (`actions.ts`, `'use server'`) — one per endpoint: `createMenu`, `updateMenu`, `deleteMenu`, `createItem`, `updateItem`, `deleteItem`, `saveStructure`, `upsertItemTranslation`, `deleteItemTranslation`. Each calls the server-only API client then `revalidatePath('/', 'layout')` (so the public menu refreshes) and `revalidatePath('/admin/menus/[id]', 'page')`. Mirror the SEO actions file structure.

- [ ] **Step 3: List page** (`menus/page.tsx`) — server component: `requireAdminSession()` + `canManageMenus` gate (redirect otherwise, mirror `/admin/seo`), list menus, a "create menu" form (name + location).

- [ ] **Step 4: Builder page** (`menus/[id]/page.tsx`) — fetch `GET /menus/:id`, fetch posts/pages/categories admin lists for the target picker, render `<MenuBuilder menu={…} targets={…} />`.

- [ ] **Step 5: `MenuBuilder` client component** — local state holding the ordered/nested item list; drag to reorder within siblings + indent/outdent buttons that mutate `parentId`; "Save order" → `saveStructure({ nodes })`. An item editor row (type select, target picker or url input, label, open-in-new-tab, delete) calling `createItem`/`updateItem`/`deleteItem`. A per-item locale tab strip (de/ru) with a label field → `upsertItemTranslation`/`deleteItemTranslation`. Use the existing admin UI kit (`components/ui/*`), `sonner` toasts, `lucide-react` icons. Drag can use the HTML5 drag events (no new dependency) — list items `draggable`, reorder on drop; keep it simple and robust.

- [ ] **Step 6: Add the sidebar link** to `/admin/menus` (gated by `canManageMenus`), mirroring the SEO entry.

- [ ] **Step 7: Typecheck + lint + build web**

Run: `pnpm typecheck && pnpm lint && pnpm --filter @cmstack-ts/web build`
Expected: clean build.

- [ ] **Step 8: Commit**

```bash
perl -0pi -e 's/\n?<\/content>\s*$//' apps/web/app/admin/menus/*.tsx apps/web/app/admin/menus/*.ts
pnpm format
git add apps/web/app/admin/menus apps/web/lib apps/web/components
git commit -m "feat(web): admin drag-sortable menu builder with per-locale labels"
```

---

### Task 10: Full verification + HANDOFF refresh

**Files:**
- Modify: `cmstack-ts/HANDOFF.md`, `cmstack-ts/REFACTOR_PLAN.md` (tick §7 #4)

- [ ] **Step 1: Full gates**

Run:
```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm vitest run --coverage
```
Expected: all green; coverage ≥80% on services+repos; record real numbers.

- [ ] **Step 2: Rebuild + e2e** (per the HANDOFF full-stack recipe)

```bash
# build with NEXT_PUBLIC_* exported, restart api + web, then:
pnpm e2e
```
Expected: 11/11.

- [ ] **Step 3: Live curl/SSR verification**

```bash
curl -s "http://localhost:4000/public/menus/primary?locale=de" | head -c 400   # de labels, resolved urls, nested
curl -s "http://localhost:3000/de" | grep -o "Leistungen"                       # managed nav rendered, localized
curl -s "http://localhost:3000/about" | grep -o "<title>[^<]*"                  # page route + #2 meta
```
Expected: localized resolved tree; managed nav in the header; page route renders.

- [ ] **Step 4: Adversarial self-review (inline, no parallel agents)** — re-read the diff as a skeptic for: custom-URL XSS bypass, P2002/P2025 handling, slug-drift drop correctness, cycle detection, locale fallback, public payload leaking `targetId`/`type`. Fix findings with a regression test each.

- [ ] **Step 5: Refresh HANDOFF + tick §7 #4** in `REFACTOR_PLAN.md` (`- [x] Menu management …`) and add the §7 #4 progress block to `HANDOFF.md` (test count, coverage, e2e, live-verify notes, any scoped-out items). Update the "Next §7 item" to **#5 contact form**.

- [ ] **Step 6: Final commit**

```bash
git add cmstack-ts/HANDOFF.md cmstack-ts/REFACTOR_PLAN.md
git commit -m "docs: mark Task 1 §7 #4 (menu management) done; refresh HANDOFF"
```

---

## Self-Review (against the spec)

**Spec coverage:** data model → T2; resolver + safe custom URL → T1; new public routes → T7; API surface (public + admin + structure + translations) → T4/T5; CASL `Menu` → T5/T6; admin builder UI → T9; public rendering + theme wiring → T8; seed → T6; observer (no event, hook noted) → covered in T4 notes + HANDOFF; testing + verification → T1–T6 unit, T10 gates/e2e/live; rollback → T2 migration review. All spec sections map to a task.

**Placeholder scan:** code blocks are concrete for the pure/repo/service layers (the highest-risk, behaviour-bearing code). T8/T9 web UI steps describe components with the key code (fetch, resolver render, structure save) shown and boilerplate delegated to named existing patterns (`/admin/seo`, theme layouts) — acceptable since those are established, low-risk conventions to mirror, not novel logic.

**Type consistency:** `MenuNode`/`PublicMenu` defined in T1 and consumed in T4/T8; `MenuWithTree`/`MenuItemRow`/`MENU_REPOSITORY`/`MenuRepository` defined in T3 and consumed in T4/T5; `slugsByIds` signature identical across T3 (def) and T4 (use); `AdminMenu`/`AdminMenuItem` defined in T4 and consumed in T9. `resolveMenuItemUrl`/`normalizeCustomUrl` signatures match between T1 def and T4 use.
