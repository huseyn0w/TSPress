import { z } from 'zod';

/** Search contracts (Phase 8). Postgres full-text search over published posts. */

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(50).default(10),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string().nullable(),
  publishedAt: z.string().datetime().nullable(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.object({
  query: z.string(),
  items: z.array(searchResultSchema),
  total: z.number().int(),
  page: z.number().int(),
  perPage: z.number().int(),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
