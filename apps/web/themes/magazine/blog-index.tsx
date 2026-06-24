import { Link } from '@/i18n/navigation';
import type { PostSummary } from '@cmstack-ts/config';
import { getTranslations } from 'next-intl/server';

export async function MagazineBlogIndex({ posts }: { posts: PostSummary[] }) {
  const t = await getTranslations('blog');

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '3.5rem 1.5rem' }}>
      <h1
        style={{
          fontSize: 'clamp(2rem, 5vw, 2.75rem)',
          textAlign: 'center',
          margin: '0 0 0.5rem',
          fontWeight: 700,
        }}
      >
        {t('magazineTitle')}
      </h1>
      <p
        style={{
          textAlign: 'center',
          color: 'var(--muted)',
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          margin: '0 0 2.5rem',
          paddingBottom: '1.5rem',
          borderBottom: '3px double var(--line)',
        }}
      >
        {t('magazineSubtitle')}
      </p>

      {posts.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center' }}>{t('magazineEmpty')}</p>
      ) : (
        <div style={{ display: 'grid', gap: '2.25rem' }}>
          {posts.map((post) => (
            <article
              key={post.id}
              style={{ paddingBottom: '2.25rem', borderBottom: '1px solid var(--line)' }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                  marginBottom: '0.6rem',
                }}
              >
                {post.categories.map((c) => (
                  <span key={c.id}>{c.name}</span>
                ))}
              </div>
              <Link
                href={`/blog/${post.slug}`}
                style={{ textDecoration: 'none', color: 'var(--fg)' }}
              >
                <h2
                  style={{ fontSize: 28, lineHeight: 1.15, margin: '0 0 0.5rem', fontWeight: 700 }}
                >
                  {post.title}
                </h2>
              </Link>
              {post.excerpt && (
                <p style={{ color: 'var(--muted)', margin: 0, fontSize: 18, lineHeight: 1.6 }}>
                  {post.excerpt}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
