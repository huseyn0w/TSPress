import { AdminShell } from '@/components/admin/admin-shell';
import { Providers } from '@/components/providers';
import {
  canManageMenus,
  canManageSeo,
  canManageSettings,
  canManageUsers,
  canModerateComments,
  requireAdminSession,
} from '@/lib/admin/guard';
import type { ReactNode } from 'react';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession();

  return (
    <Providers>
      <div className="min-h-screen bg-background text-foreground font-sans">
        <AdminShell
          user={session.user}
          canManageUsers={canManageUsers(session)}
          canManageSettings={canManageSettings(session)}
          canManageSeo={canManageSeo(session)}
          canManageMenus={canManageMenus(session)}
          canModerateComments={canModerateComments(session)}
        >
          {children}
        </AdminShell>
      </div>
    </Providers>
  );
}
