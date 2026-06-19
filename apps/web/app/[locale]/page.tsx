import { alternatesFor } from '@/lib/i18n/metadata';
import { getSeoContent } from '@/lib/seo/fetch';
import { JsonLd } from '@/lib/seo/json-ld';
import { organizationJsonLd, webSiteJsonLd } from '@/lib/seo/jsonld';
import { siteUrl } from '@/lib/seo/site';
import { getActiveTheme } from '@/themes/active-theme';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, '/') };
}

export default async function HomePage() {
  const [{ Layout, Home }, { profile }] = await Promise.all([getActiveTheme(), getSeoContent()]);

  return (
    <>
      <JsonLd data={organizationJsonLd(profile, siteUrl)} />
      <JsonLd data={webSiteJsonLd(profile, siteUrl)} />
      <Layout>
        <Home />
      </Layout>
    </>
  );
}
