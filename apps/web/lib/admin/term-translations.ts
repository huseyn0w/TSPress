import type { TermTranslationView } from '@/types/content';

/** Seed a per-locale name map from existing translation rows (null/absent → ''). */
export function seedTermTranslations(
  translations: TermTranslationView[],
  overrideLocales: readonly string[],
): Record<string, string> {
  const seed: Record<string, string> = {};
  for (const locale of overrideLocales) {
    seed[locale] = translations.find((t) => t.locale === locale)?.name ?? '';
  }
  return seed;
}

export interface TermTranslationOp {
  locale: string;
  action: 'upsert' | 'delete';
  name?: string;
}

/**
 * Diff edited per-locale names against the originals into upsert/delete ops.
 * Only changed locales produce an op: a newly non-empty value upserts, a cleared
 * value deletes, an unchanged value is skipped (empty→empty is a no-op).
 */
export function diffTermTranslations(
  original: Record<string, string>,
  edited: Record<string, string>,
  overrideLocales: readonly string[],
): TermTranslationOp[] {
  const ops: TermTranslationOp[] = [];
  for (const locale of overrideLocales) {
    const next = (edited[locale] ?? '').trim();
    const prev = (original[locale] ?? '').trim();
    if (next === prev) continue;
    ops.push(next ? { locale, action: 'upsert', name: next } : { locale, action: 'delete' });
  }
  return ops;
}
