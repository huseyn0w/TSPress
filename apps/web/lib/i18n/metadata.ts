import { routing } from '@/i18n/routing';
import { siteUrl } from '@/lib/seo/site';
import type { Metadata } from 'next';
import { languageAlternates, localizedUrl } from './alternates';

/**
 * Build `metadata.alternates` for a locale-agnostic path: a per-locale canonical
 * plus the full `hreflang` languages map (incl. `x-default`). Absolute URLs are
 * used so they are correct regardless of the request's locale prefix.
 */
export function alternatesFor(locale: string, path: string): NonNullable<Metadata['alternates']> {
  const opts = {
    locales: routing.locales,
    defaultLocale: routing.defaultLocale,
    baseUrl: siteUrl,
  };
  return {
    canonical: localizedUrl(locale, path, opts),
    languages: languageAlternates(path, opts),
  };
}
