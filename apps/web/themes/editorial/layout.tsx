import { LocaleSwitcher } from '@/components/i18n/locale-switcher';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

/** Editorial theme chrome: dark, restrained, hairline rules. */
export async function EditorialLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('nav');
  const tf = await getTranslations('footer');

  return (
    <div
      className="theme-editorial"
      data-public-theme="editorial"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--fg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 2rem',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <Link
          href="/"
          style={{
            color: 'var(--fg)',
            textDecoration: 'none',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            fontSize: 12,
          }}
        >
          Typress
        </Link>
        <nav style={{ display: 'flex', gap: '1.25rem', fontSize: 14, alignItems: 'center' }}>
          <Link href="/blog" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            {t('blog')}
          </Link>
          <Link href="/services" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            {t('services')}
          </Link>
          <Link href="/search" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            {t('search')}
          </Link>
          <Link href="/signin" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            {t('signIn')}
          </Link>
          <Link href="/account" style={{ color: 'var(--fg)', textDecoration: 'none' }}>
            {t('account')}
          </Link>
          <LocaleSwitcher />
        </nav>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      <footer
        style={{
          padding: '2rem',
          borderTop: '1px solid var(--line)',
          color: 'var(--muted)',
          fontSize: 12,
          letterSpacing: '0.04em',
          textAlign: 'center',
        }}
      >
        © {new Date().getFullYear()} Typress · {tf('editorial')}
      </footer>
    </div>
  );
}
