/**
 * Pure helpers for building per-locale URLs and the `hreflang` alternates map
 * that Next.js `metadata.alternates.languages` expects. Kept free of next-intl
 * imports so they are trivially unit-testable.
 *
 * `path` is the locale-agnostic pathname (e.g. `/` or `/blog/hello`). The
 * default locale is unprefixed; others get a `/<locale>` prefix.
 */

export interface AlternatesOptions {
  locales: readonly string[];
  defaultLocale: string;
  /** Absolute site base, no trailing slash (e.g. https://example.com). */
  baseUrl: string;
}

/** Normalize to a leading-slash, no-trailing-slash path ('' becomes '/'). */
function normalizePath(path: string): string {
  if (!path || path === '/') return '/';
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  return withLeading.length > 1 ? withLeading.replace(/\/+$/, '') : withLeading;
}

/** The pathname for a locale: unprefixed for the default, `/<locale>...` otherwise. */
export function localizedPath(locale: string, path: string, defaultLocale: string): string {
  const p = normalizePath(path);
  if (locale === defaultLocale) return p;
  return p === '/' ? `/${locale}` : `/${locale}${p}`;
}

/** Absolute URL for a locale + path. */
export function localizedUrl(
  locale: string,
  path: string,
  options: Pick<AlternatesOptions, 'defaultLocale' | 'baseUrl'>,
): string {
  return `${options.baseUrl}${localizedPath(locale, path, options.defaultLocale)}`;
}

/**
 * The `languages` map for `metadata.alternates`: one absolute URL per locale,
 * plus `x-default` pointing at the default-locale URL.
 */
export function languageAlternates(
  path: string,
  options: AlternatesOptions,
): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of options.locales) {
    languages[locale] = localizedUrl(locale, path, options);
  }
  languages['x-default'] = localizedUrl(options.defaultLocale, path, options);
  return languages;
}
