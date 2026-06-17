import { PageForm } from '@/components/admin/page-form';
import { apiGet } from '@/lib/admin/api';
import { pageDetailSchema } from '@typress/config';
import type { PageDetail } from '@typress/config';
import { notFound } from 'next/navigation';
import { updatePageAction } from '../../actions';

export const dynamic = 'force-dynamic';

async function fetchPage(id: string): Promise<PageDetail | null> {
  try {
    return await apiGet(`/pages/${id}`, pageDetailSchema);
  } catch {
    return null;
  }
}

interface EditPagePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPagePage({ params }: EditPagePageProps) {
  const { id } = await params;
  const page = await fetchPage(id);

  if (!page) {
    notFound();
  }

  return <PageForm page={page} updateAction={updatePageAction} />;
}
