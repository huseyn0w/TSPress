import { apiGet } from '@/lib/admin/api';
import { canManageContacts, requireAdminSession } from '@/lib/admin/guard';
import { type AdminContactList, adminContactListSchema } from '@cmstack-ts/config';
import { redirect } from 'next/navigation';
import { ContactInbox } from './contact-inbox';

export const dynamic = 'force-dynamic';

async function fetchSubmissions(): Promise<AdminContactList> {
  try {
    return await apiGet('/contact', adminContactListSchema);
  } catch {
    return [];
  }
}

export default async function ContactInboxPage() {
  const session = await requireAdminSession();
  if (!canManageContacts(session)) redirect('/admin');

  const submissions = await fetchSubmissions();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Contact</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Messages sent through the public contact form, newest first.
        </p>
      </header>
      <ContactInbox items={submissions} />
    </div>
  );
}
