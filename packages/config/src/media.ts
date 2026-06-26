import { z } from 'zod';

/**
 * Shared media contracts. Files are uploaded as multipart/form-data (not modeled
 * here); these schemas cover the JSON metadata update and the response shape.
 */

/** Image/document MIME types the API accepts for upload. SVG is excluded by
 * design (it can carry script and is risky to serve inline). */
export const ALLOWED_MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
] as const;

/** A generated, downscaled WebP derivative of an uploaded image. */
export const thumbnailSchema = z.object({
  label: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  url: z.string(),
  size: z.number().int().nonnegative(),
});
export type Thumbnail = z.infer<typeof thumbnailSchema>;

/** Derivative sizes generated on image upload (max edge, resize-to-fit, no upscale). */
export const THUMBNAIL_SIZES = [
  { label: 'thumb', max: 400 },
  { label: 'medium', max: 1024 },
] as const;

/** Storage key for a derivative: `<base-without-ext>-<label>.webp`. */
export function thumbnailKey(baseKey: string, label: string): string {
  const dot = baseKey.lastIndexOf('.');
  const stem = dot > 0 ? baseKey.slice(0, dot) : baseKey;
  return `${stem}-${label}.webp`;
}

export const updateMediaSchema = z.object({
  alt: z.string().trim().max(300).nullable().optional(),
  title: z.string().trim().max(300).nullable().optional(),
  caption: z.string().trim().max(1000).nullable().optional(),
});
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;

export const mediaListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(24),
});
export type MediaListQuery = z.infer<typeof mediaListQuerySchema>;

export const mediaSchema = z.object({
  id: z.string(),
  filename: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  alt: z.string().nullable(),
  title: z.string().nullable(),
  caption: z.string().nullable(),
  url: z.string(),
  thumbnails: z.array(thumbnailSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Media = z.infer<typeof mediaSchema>;

export const mediaListSchema = z.object({
  items: z.array(mediaSchema),
  total: z.number().int(),
  page: z.number().int(),
  perPage: z.number().int(),
});
export type MediaList = z.infer<typeof mediaListSchema>;
