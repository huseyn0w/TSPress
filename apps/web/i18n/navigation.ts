import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware navigation. Use these in place of `next/link` / `next/navigation`
 * on the public site so internal links carry the active locale prefix
 * automatically (no prefix for the default locale).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
