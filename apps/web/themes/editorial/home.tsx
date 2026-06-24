import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

export async function EditorialHome() {
  const t = await getTranslations('home.editorial');

  return (
    <section style={{ display: 'grid', placeItems: 'center', padding: '6rem 2rem' }}>
      <div data-animate="rise" style={{ maxWidth: 640, textAlign: 'center' }}>
        <p
          style={{
            margin: 0,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            fontSize: 12,
            color: 'var(--accent)',
          }}
        >
          Cmstack-TS
        </p>
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', lineHeight: 1.05, margin: '1rem 0' }}>
          {t('title')}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 18, margin: '0 0 2rem' }}>{t('subtitle')}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <Link
            href="/blog"
            className="ts-cta"
            style={{
              display: 'inline-block',
              padding: '0.7rem 1.4rem',
              border: '1px solid var(--line)',
              borderRadius: 999,
              color: 'var(--fg)',
              textDecoration: 'none',
            }}
          >
            {t('readBlog')}
          </Link>
          <Link
            href="/health"
            style={{
              display: 'inline-block',
              padding: '0.7rem 1.4rem',
              color: 'var(--muted)',
              textDecoration: 'none',
            }}
          >
            {t('systemStatus')}
          </Link>
        </div>
      </div>
    </section>
  );
}
