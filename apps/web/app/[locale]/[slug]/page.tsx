import { apiBaseUrl } from '@/app/lib/api';
import { alternatesFor } from '@/lib/i18n/metadata';
import { siteUrl } from '@/lib/seo/site';
import { getActiveTheme } from '@/themes/active-theme';
import { type PageDetail, pageDetailSchema } from '@cmstack-ts/config';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function getPage(slug: string, locale: string): Promise<PageDetail | null> {
  try {
    const res = await fetch(
      `${apiBaseUrl}/public/pages/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const parsed = pageDetailSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await getPage(slug, locale);
  if (!page) return {};

  // Per-content SEO (mirrors the blog post): localized meta overrides the title,
  // a custom canonical overrides the per-locale default, noindex opts out.
  const title = page.metaTitle ?? page.title;
  const description = page.metaDescription ?? undefined;
  const alternates = alternatesFor(locale, `/${page.slug}`);
  if (page.canonicalUrl) alternates.canonical = page.canonicalUrl;

  return {
    title,
    description,
    alternates,
    robots: page.noindex ? { index: false } : undefined,
    openGraph: { type: 'article', title, description, url: `${siteUrl}/${page.slug}` },
  };
}

export default async function PublicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const [page, { Layout }] = await Promise.all([getPage(slug, locale), getActiveTheme()]);
  if (!page) notFound();

  return (
    <Layout>
      <article style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', margin: '0 0 1.5rem' }}>{page.title}</h1>
        {/* content is sanitized server-side by the API before storage. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: content is sanitized by the API. */}
        <div className="prose" dangerouslySetInnerHTML={{ __html: page.content }} />
      </article>
    </Layout>
  );
}
