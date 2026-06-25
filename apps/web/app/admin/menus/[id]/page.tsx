import { apiGet } from '@/lib/admin/api';
import { canManageMenus, requireAdminSession } from '@/lib/admin/guard';
import { type AdminMenu, adminMenuSchema, postListSchema } from '@cmstack-ts/config';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { MenuBuilder, type TargetOption } from '../menu-builder';

export const dynamic = 'force-dynamic';

const pageListSchema = z.array(z.object({ id: z.string(), title: z.string() }));
const categoryListSchema = z.array(z.object({ id: z.string(), name: z.string() }));

async function fetchMenu(id: string): Promise<AdminMenu | null> {
  try {
    return await apiGet(`/menus/${id}`, adminMenuSchema);
  } catch {
    return null;
  }
}

async function fetchTargets(): Promise<Record<'POST' | 'PAGE' | 'CATEGORY', TargetOption[]>> {
  const [posts, pages, categories] = await Promise.all([
    apiGet('/posts?perPage=100', postListSchema)
      .then((r) => r.items.map((p) => ({ id: p.id, label: p.title })))
      .catch(() => [] as TargetOption[]),
    apiGet('/pages', pageListSchema)
      .then((r) => r.map((p) => ({ id: p.id, label: p.title })))
      .catch(() => [] as TargetOption[]),
    apiGet('/categories', categoryListSchema)
      .then((r) => r.map((c) => ({ id: c.id, label: c.name })))
      .catch(() => [] as TargetOption[]),
  ]);
  return { POST: posts, PAGE: pages, CATEGORY: categories };
}

export default async function MenuBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!canManageMenus(session)) redirect('/admin');

  const { id } = await params;
  const [menu, targets] = await Promise.all([fetchMenu(id), fetchTargets()]);
  if (!menu) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/menus" className="text-sm text-muted-foreground hover:text-foreground">
          ← Menus
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{menu.name}</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">{menu.location}</p>
      </header>
      <MenuBuilder menu={menu} targets={targets} />
    </div>
  );
}
