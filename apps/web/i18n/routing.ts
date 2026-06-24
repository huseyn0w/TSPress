import { DEFAULT_LOCALE, LOCALES } from '@cmstack-ts/config';
import { defineRouting } from 'next-intl/routing';

/**
 * i18n routing (Phase: i18n foundation). The public site is localized in three
 * languages; the default locale (English) is unprefixed (`/blog`) while the
 * others are prefixed (`/de/blog`, `/ru/blog`) via `localePrefix: 'as-needed'`,
 * which keeps existing URLs and canonicals stable for SEO.
 *
 * The locale catalogue is owned by `@cmstack-ts/config` (`LOCALES`/
 * `DEFAULT_LOCALE`) so the public routing and the API content-translation layer
 * can never drift. Per-locale content translation lives in the translation
 * tables; the admin panel stays English and outside locale routing.
 */
export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
