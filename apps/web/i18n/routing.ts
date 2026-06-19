import { defineRouting } from 'next-intl/routing';

/**
 * i18n routing (Phase: i18n foundation). The public site is localized in three
 * languages; the default locale (English) is unprefixed (`/blog`) while the
 * others are prefixed (`/de/blog`, `/ru/blog`) via `localePrefix: 'as-needed'`,
 * which keeps existing URLs and canonicals stable for SEO.
 *
 * Content (posts/pages) is NOT translated in this phase — only the UI chrome.
 * The admin panel stays English and lives outside locale routing.
 */
export const routing = defineRouting({
  locales: ['en', 'de', 'ru'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
