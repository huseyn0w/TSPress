import { apiBaseUrl } from '@/app/lib/api';
import { alternatesFor } from '@/lib/i18n/metadata';
import { getActiveTheme } from '@/themes/active-theme';
import { postListSchema } from '@cmstack-ts/config';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('blog');
  return { title: t('title'), alternates: alternatesFor(locale, '/blog') };
}

const EMPTY = { items: [], total: 0, page: 1, perPage: 20 };

async function getPosts(locale: string, categorySlug?: string) {
  try {
    const params = new URLSearchParams({ perPage: '20', locale });
    if (categorySlug) params.set('categorySlug', categorySlug);
    const res = await fetch(`${apiBaseUrl}/public/posts?${params.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return EMPTY;
    const parsed = postListSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : EMPTY;
  } catch {
    // API unreachable — degrade to an empty list rather than erroring the page.
    return EMPTY;
  }
}

export default async function BlogIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await params;
  const { category } = await searchParams;
  const [{ items }, { Layout, BlogIndex }] = await Promise.all([
    getPosts(locale, category),
    getActiveTheme(),
  ]);

  return (
    <Layout>
      <BlogIndex posts={items} />
    </Layout>
  );
}
