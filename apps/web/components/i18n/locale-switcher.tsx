'use client';

import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

/**
 * Public locale switcher. Replaces the current route under the chosen locale
 * (keeping the same pathname) via next-intl's locale-aware router.
 */
export function LocaleSwitcher() {
  const t = useTranslations('localeSwitcher');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      aria-label={t('label')}
      value={locale}
      disabled={isPending}
      onChange={(event) => {
        const next = event.target.value;
        startTransition(() => router.replace(pathname, { locale: next }));
      }}
      style={{
        background: 'transparent',
        color: 'inherit',
        border: '1px solid var(--line)',
        borderRadius: 6,
        padding: '0.2rem 0.4rem',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {routing.locales.map((l) => (
        <option key={l} value={l} style={{ color: 'initial' }}>
          {t(l)}
        </option>
      ))}
    </select>
  );
}
