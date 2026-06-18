import { getActiveTheme } from '@/themes/active-theme';
import { authorProfileSchema } from '@typress/config';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiBaseUrl } from '../../lib/api';

export const dynamic = 'force-dynamic';

async function getAuthor(id: string) {
  try {
    const res = await fetch(`${apiBaseUrl}/public/authors/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const parsed = authorProfileSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function initials(name: string | null): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'A';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const author = await getAuthor(id);
  if (!author) return {};
  const name = author.name ?? 'Author';
  return {
    title: name,
    description: author.bio ?? `Posts by ${name}.`,
    alternates: { canonical: `/authors/${author.id}` },
  };
}

export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [author, { Layout }] = await Promise.all([getAuthor(id), getActiveTheme()]);
  if (!author) notFound();

  return (
    <Layout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
        <header
          style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '2rem' }}
        >
          {author.image ? (
            <img
              src={author.image}
              alt=""
              width={72}
              height={72}
              style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'var(--line)',
                color: 'var(--fg)',
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              {initials(author.name)}
            </div>
          )}
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
              }}
            >
              Author
            </p>
            <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', margin: '0.3rem 0 0' }}>
              {author.name ?? 'Unknown author'}
            </h1>
          </div>
        </header>

        {author.bio && (
          <p
            style={{
              color: 'var(--muted)',
              fontSize: 18,
              lineHeight: 1.65,
              margin: '0 0 3rem',
              maxWidth: 600,
            }}
          >
            {author.bio}
          </p>
        )}

        <h2
          style={{
            fontSize: 14,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            margin: '0 0 1.25rem',
          }}
        >
          {author.posts.length > 0 ? 'Published posts' : 'No published posts yet'}
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {author.posts.map((post) => (
            <li key={post.id} style={{ padding: '1.25rem 0', borderTop: '1px solid var(--line)' }}>
              <Link
                href={`/blog/${post.slug}`}
                style={{ color: 'var(--fg)', textDecoration: 'none' }}
              >
                <h3 style={{ fontSize: 20, margin: '0 0 0.3rem' }}>{post.title}</h3>
              </Link>
              {post.excerpt && (
                <p style={{ color: 'var(--muted)', margin: 0, fontSize: 15 }}>{post.excerpt}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
