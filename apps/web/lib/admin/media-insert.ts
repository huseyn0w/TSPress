import type { Media } from '@cmstack-ts/config';

/**
 * Pure helpers for inserting a media-library image into the rich-text editor.
 * Kept framework-free so they can be unit-tested without a DOM/editor.
 */

/** Absolute URL for a media item, prefixing root-relative paths with the API origin. */
export function absoluteMediaUrl(url: string, apiOrigin: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${apiOrigin}${url}`;
}

/** Whether a media item is an image (only images can be inserted into content). */
export function isImageMedia(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Default alt text for an image: the curated alt, then the title, else empty.
 * Never the filename — a filename is not meaningful alt text for screen readers.
 */
export function defaultAltFor(item: Pick<Media, 'alt' | 'title'>): string {
  return item.alt?.trim() || item.title?.trim() || '';
}

/** Attributes for the `<img>` node Tiptap inserts: absolute src + trimmed alt. */
export function mediaToImageAttrs(
  item: Media,
  apiOrigin: string,
  alt?: string,
): { src: string; alt: string } {
  return {
    src: absoluteMediaUrl(item.url, apiOrigin),
    alt: alt !== undefined ? alt.trim() : defaultAltFor(item),
  };
}
