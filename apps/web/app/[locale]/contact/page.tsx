import { ContactForm } from '@/components/public/contact-form';
import { alternatesFor } from '@/lib/i18n/metadata';
import { getActiveTheme } from '@/themes/active-theme';
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
  const t = await getTranslations('contact');
  return { title: t('title'), alternates: alternatesFor(locale, '/contact') };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [{ Layout }, t] = await Promise.all([getActiveTheme(), getTranslations('contact')]);

  return (
    <Layout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', margin: '0 0 1rem' }}>{t('title')}</h1>
        <p style={{ color: 'var(--muted)', fontSize: 18, lineHeight: 1.6, margin: '0 0 2.5rem' }}>
          {t('intro')}
        </p>
        <ContactForm />
      </div>
    </Layout>
  );
}
