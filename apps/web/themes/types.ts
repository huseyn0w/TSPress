import type { PostDetail, PostSummary } from '@cmstack-ts/config';
import type { ReactNode } from 'react';

/** A theme surface; may be an async Server Component (e.g. to read translations). */
type ThemeComponent<P = Record<never, never>> = (props: P) => ReactNode | Promise<ReactNode>;

/**
 * Theme contract (Phase 5). A theme is a swappable set of templates for the
 * public, server-rendered site, resolved at runtime from the `activeTheme`
 * setting. Each theme supplies a chrome `Layout` plus one component per public
 * surface. Themes own their own visual tokens (scoped public CSS vars) and must
 * not reach into the admin token system.
 */

export interface ThemeMeta {
  /** Stable, slug-shaped id stored in the `activeTheme` setting. */
  id: string;
  /** Human label shown in the admin Appearance screen. */
  label: string;
  /** One-line description for the admin Appearance screen. */
  description: string;
}

export interface Theme {
  meta: ThemeMeta;
  /** Page chrome (header/footer + themed wrapper) wrapping every surface. */
  Layout: ThemeComponent<{ children: ReactNode }>;
  /** Home surface (`/`). */
  Home: ThemeComponent;
  /** Blog index surface (`/blog`). */
  BlogIndex: ThemeComponent<{ posts: PostSummary[] }>;
  /** Single post surface (`/blog/[slug]`). */
  BlogPost: ThemeComponent<{ post: PostDetail }>;
}
