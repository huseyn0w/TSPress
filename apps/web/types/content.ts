/**
 * Local content view types not yet promoted to @typress/config.
 * These mirror the API response shapes for categories and tags.
 */

export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TagView {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}
