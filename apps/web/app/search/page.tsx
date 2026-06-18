import { getActiveTheme } from '@/themes/active-theme';
import { searchResponseSchema } from '@typress/config';
import type { Metadata } from 'next';
import Link from 'next/link';
import { apiBaseUrl } from '../lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search published articles.',
  alternates: { canonical: '/search' },
};

async function runSearch(q: string) {
  if (!q) return null;
  try {
    const res = await fetch(`${apiBaseUrl}/public/search?q=${encodeURIComponent(q)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const parsed = searchResponseSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const query = q.trim();
  const [{ Layout }, results] = await Promise.all([getActiveTheme(), runSearch(query)]);

  return (
    <Layout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', margin: '0 0 1.5rem' }}>Search</h1>

        <form action="/search" method="get" style={{ display: 'flex', gap: '0.6rem' }}>
          <input
            name="q"
            defaultValue={query}
            placeholder="Search articles…"
            aria-label="Search query"
            style={{
              flex: 1,
              padding: '0.7rem 0.9rem',
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 8,
              color: 'var(--fg)',
              fontSize: 15,
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.7rem 1.4rem',
              border: '1px solid var(--line)',
              borderRadius: 8,
              background: 'var(--fg)',
              color: 'var(--bg)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>

        {query && (
          <div style={{ marginTop: '2.5rem' }}>
            {!results || results.items.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>No results for “{query}”.</p>
            ) : (
              <>
                <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 1.5rem' }}>
                  {results.total} result{results.total !== 1 ? 's' : ''} for “{query}”
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {results.items.map((item) => (
                    <li
                      key={item.id}
                      style={{ padding: '1.25rem 0', borderBottom: '1px solid var(--line)' }}
                    >
                      <Link
                        href={`/blog/${item.slug}`}
                        style={{ color: 'var(--fg)', textDecoration: 'none' }}
                      >
                        <h2 style={{ fontSize: 20, margin: '0 0 0.3rem' }}>{item.title}</h2>
                      </Link>
                      {item.excerpt && (
                        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 15 }}>
                          {item.excerpt}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
