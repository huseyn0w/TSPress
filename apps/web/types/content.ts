/**
 * Local content view types not yet promoted to @cmstack-ts/config.
 * These mirror the API response shapes for categories and tags.
 */

/** A per-locale name override (name only; falls back to the base at read time). */
export interface TermTranslationView {
  locale: string;
  name: string | null;
}

export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  translations: TermTranslationView[];
  createdAt: string;
  updatedAt: string;
}

export interface TagView {
  id: string;
  name: string;
  slug: string;
  translations: TermTranslationView[];
  createdAt: string;
  updatedAt: string;
}
