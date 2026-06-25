import { routing } from '@/i18n/routing';
import { languageAlternates } from '@/lib/i18n/alternates';
import { getAllPublicPosts } from '@/lib/seo/fetch';
import { siteUrl } from '@/lib/seo/site';
import type { MetadataRoute } from 'next';

export const dynamic = 'force-dynamic';

const ALT_OPTS = {
  locales: routing.locales,
  defaultLocale: routing.defaultLocale,
  baseUrl: siteUrl,
};

/** A sitemap entry for a localized path, with hreflang alternates per locale. */
function localizedEntry(
  path: string,
  rest: Omit<MetadataRoute.Sitemap[number], 'url' | 'alternates'>,
): MetadataRoute.Sitemap[number] {
  return {
    url: `${siteUrl}${path}`,
    alternates: { languages: languageAlternates(path, ALT_OPTS) },
    ...rest,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPublicPosts();

  const staticRoutes: MetadataRoute.Sitemap = [
    localizedEntry('/', { changeFrequency: 'weekly', priority: 1 }),
    localizedEntry('/blog', { changeFrequency: 'daily', priority: 0.8 }),
    localizedEntry('/services', { changeFrequency: 'monthly', priority: 0.7 }),
  ];

  const postRoutes: MetadataRoute.Sitemap = posts
    // Per-content noindex opts a post out of the sitemap (and search indices).
    .filter((post) => !post.noindex)
    .map((post) =>
      localizedEntry(`/blog/${post.slug}`, {
        lastModified: post.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.6,
      }),
    );

  return [...staticRoutes, ...postRoutes];
}
