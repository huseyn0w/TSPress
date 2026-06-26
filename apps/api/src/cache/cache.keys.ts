/** Cache namespaces — each is flushed as a unit on the matching write event. */
export const CACHE_NS = {
  SETTINGS: 'settings',
  SEO: 'seo',
  POSTS: 'content:posts',
  PAGES: 'content:pages',
  MENUS: 'menus',
} as const;

export type CacheNamespace = (typeof CACHE_NS)[keyof typeof CACHE_NS];

/** Full key: `cms:<ns>:<discriminator>` (locale/query live in the discriminator). */
export function cacheKey(ns: CacheNamespace, discriminator: string): string {
  return `cms:${ns}:${discriminator}`;
}

/** Prefix covering an entire namespace, for {@link CacheStore.delByPrefix}. */
export function cachePrefix(ns: CacheNamespace): string {
  return `cms:${ns}:`;
}
