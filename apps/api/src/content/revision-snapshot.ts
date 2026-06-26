import type { ContentStatus, UpdatePageInput, UpdatePostInput } from '@cmstack-ts/config';

function asRecord(snapshot: unknown): Record<string, unknown> {
  return snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>) : {};
}

function status(value: unknown): ContentStatus | undefined {
  return value === 'DRAFT' || value === 'PUBLISHED' ? value : undefined;
}

/**
 * Build a post update from a revision snapshot. Only recognized scalar fields are
 * carried; a null/missing field is omitted (left unchanged on restore — taxonomy
 * and translations are not part of the snapshot).
 */
export function revisionToPostUpdate(snapshot: unknown): UpdatePostInput {
  const s = asRecord(snapshot);
  const out: UpdatePostInput = {};
  if (typeof s.title === 'string') out.title = s.title;
  if (typeof s.slug === 'string') out.slug = s.slug;
  if (typeof s.excerpt === 'string') out.excerpt = s.excerpt;
  if (typeof s.content === 'string') out.content = s.content;
  const st = status(s.status);
  if (st) out.status = st;
  return out;
}

/** Build a page update from a revision snapshot (pages have no excerpt). */
export function revisionToPageUpdate(snapshot: unknown): UpdatePageInput {
  const s = asRecord(snapshot);
  const out: UpdatePageInput = {};
  if (typeof s.title === 'string') out.title = s.title;
  if (typeof s.slug === 'string') out.slug = s.slug;
  if (typeof s.content === 'string') out.content = s.content;
  const st = status(s.status);
  if (st) out.status = st;
  return out;
}
