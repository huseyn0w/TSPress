import { Link } from '@/i18n/navigation';
import type { PostDetail } from '@cmstack-ts/config';
import { getFormatter, getTranslations } from 'next-intl/server';

export async function EditorialBlogPost({ post }: { post: PostDetail }) {
  const t = await getTranslations('post');
  const tb = await getTranslations('blog');
  const format = await getFormatter();
  const published = post.publishedAt ? new Date(post.publishedAt) : null;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <article>
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
          {post.categories.map((c) => (
            <span
              key={c.id}
              style={{ fontSize: 12, color: 'var(--accent)', textTransform: 'uppercase' }}
            >
              {c.name}
            </span>
          ))}
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.1, margin: '0 0 1rem' }}>
          {post.title}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 2.5rem' }}>
          {post.author ? (
            <Link
              href={`/authors/${post.author.id}`}
              style={{ color: 'var(--fg)', textDecoration: 'none' }}
            >
              {post.author.name ?? t('unknownAuthor')}
            </Link>
          ) : (
            t('unknownAuthor')
          )}
          {published && ` · ${format.dateTime(published, { dateStyle: 'long' })}`}
        </p>
        {/* content is sanitized server-side by the API before storage. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: content is sanitized by the API. */}
        <div className="prose" dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>

      <p style={{ marginTop: '3rem' }}>
        <Link href="/blog" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>
          {tb('allPosts')}
        </Link>
      </p>
    </div>
  );
}
