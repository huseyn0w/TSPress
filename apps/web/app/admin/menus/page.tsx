import { apiGet } from '@/lib/admin/api';
import { canManageMenus, requireAdminSession } from '@/lib/admin/guard';
import { type MenuSummary, menuSummarySchema } from '@cmstack-ts/config';
import { Navigation } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { CreateMenuForm } from './create-menu-form';

export const dynamic = 'force-dynamic';

async function fetchMenus(): Promise<MenuSummary[]> {
  try {
    return await apiGet('/menus', z.array(menuSummarySchema));
  } catch {
    return [];
  }
}

export default async function MenusPage() {
  const session = await requireAdminSession();
  if (!canManageMenus(session)) redirect('/admin');

  const menus = await fetchMenus();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Menus</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Build navigation menus and bind them to a theme location (e.g. <code>primary</code> for
          the header, <code>footer</code> for the footer).
        </p>
      </header>

      <section className="space-y-2">
        {menus.length === 0 ? (
          <p className="text-sm text-muted-foreground">No menus yet. Create one below.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {menus.map((menu) => (
              <li key={menu.id}>
                <Link
                  href={`/admin/menus/${menu.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                >
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{menu.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground font-mono">
                    {menu.location}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateMenuForm />
    </div>
  );
}
