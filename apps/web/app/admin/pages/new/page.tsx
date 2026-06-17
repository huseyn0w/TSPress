import { PageForm } from '@/components/admin/page-form';
import { createPageAction } from '../actions';

export const dynamic = 'force-dynamic';

export default function NewPagePage() {
  return <PageForm createAction={createPageAction} />;
}
