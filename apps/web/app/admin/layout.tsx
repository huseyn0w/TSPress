import { AdminShell } from '@/components/admin/admin-shell';
import { Providers } from '@/components/providers';
import { canManageUsers, requireAdminSession } from '@/lib/admin/guard';
import type { ReactNode } from 'react';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession();

  return (
    <Providers>
      <div className="min-h-screen bg-background text-foreground font-sans">
        <AdminShell user={session.user} canManageUsers={canManageUsers(session)}>
          {children}
        </AdminShell>
      </div>
    </Providers>
  );
}
