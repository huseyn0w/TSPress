import { z } from 'zod';
import { localeSchema } from './locale';

/**
 * Menu / navigation contracts (Task 1 §7 #4). A menu is bound to a theme render
 * location; its items are nested (public dropdowns) and reference a Post, Page,
 * Category, or a free custom URL. Item labels are translatable (en base + de/ru
 * overrides) reusing the per-locale content pattern. Labels are plain text
 * (rendered escaped); custom URLs are validated against a strict allow-list.
 */

/** A menu item points at a Post, Page, Category, or a free custom URL. */
export const menuItemTypeSchema = z.enum(['POST', 'PAGE', 'CATEGORY', 'CUSTOM']);
export type MenuItemType = z.infer<typeof menuItemTypeSchema>;

/**
 * Validate a custom URL: only a site-relative path ("/...", not "//...") or an
 * absolute http(s) URL is allowed. Returns the trimmed URL or null when unsafe —
 * guards against `javascript:`/`data:` XSS in the rendered href.
 */
export function normalizeCustomUrl(raw: string): string | null {
  const url = raw.trim();
  if (url.startsWith('//')) return null;
  if (url.startsWith('/')) return url;
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
type MenuItemBase = z.infer<typeof menuItemBase>;

/** A reference item needs a targetId; a CUSTOM item needs a safe url. */
function refineItem(schema: typeof menuItemBase) {
  return schema.superRefine((val: MenuItemBase, ctx) => {
    if (val.type === 'CUSTOM') {
      if (!val.url || normalizeCustomUrl(val.url) === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CUSTOM items need a valid http(s) or "/" url',
          path: ['url'],
        });
      }
    } else if (!val.targetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${val.type} items need a targetId`,
        path: ['targetId'],
      });
    }
  });
}

export const createMenuItemSchema = refineItem(menuItemBase);
export type CreateMenuItemInput = MenuItemBase;

export const updateMenuItemSchema = refineItem(menuItemBase);
export type UpdateMenuItemInput = MenuItemBase;

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
