import { z } from 'zod';

/**
 * Single source of truth for the locales the public site is translated into.
 * The default locale (`en`) is stored on the base content rows; non-default
 * locales live in the per-content translation tables. The web app's next-intl
 * routing imports these so the catalogue can never drift between the two.
 */
export const LOCALES = ['en', 'de', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const localeSchema = z.enum(LOCALES);
