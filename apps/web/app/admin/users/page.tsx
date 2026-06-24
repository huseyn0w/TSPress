import { UserRowActions } from '@/app/admin/users/user-row-actions';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet } from '@/lib/admin/api';
import { canManageUsers, requireAdminSession } from '@/lib/admin/guard';
import { adminUserListSchema, roleSummarySchema } from '@cmstack-ts/config';
import type { AdminUserList, RoleSummary } from '@cmstack-ts/config';
import { Search } from 'lucide-react';
import { redirect } from 'next/navigation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const rolesSchema = z.array(roleSummarySchema);

async function fetchUsers(q: string, page: number, perPage: number): Promise<AdminUserList | null> {
  try {
    const query = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (q) query.set('q', q);
    return await apiGet(`/users?${query.toString()}`, adminUserListSchema);
  } catch {
    return null;
  }
}

async function fetchRoles(): Promise<RoleSummary[]> {
  try {
    return await apiGet('/users/roles', rolesSchema);
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts[1]?.[0] ?? '';
    return (first + last).toUpperCase() || (email[0]?.toUpperCase() ?? 'U');
  }
  return email[0]?.toUpperCase() ?? 'U';
}

interface UsersPageProps {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const session = await requireAdminSession();
  // User administration requires the manage-users capability (Editors don't have it).
  if (!canManageUsers(session)) {
    redirect('/admin');
  }
  const currentUserId = session.user.id;

  const params = await searchParams;
  const q = (params.q ?? '').trim();
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const perPage = Math.min(100, Math.max(1, Number(params.perPage ?? '20') || 20));

  const [data, roles] = await Promise.all([fetchUsers(q, page, perPage), fetchRoles()]);

  async function handleSearch(formData: FormData) {
    'use server';
    const search = (formData.get('q') as string | null)?.trim() ?? '';
    redirect(search ? `/admin/users?q=${encodeURIComponent(search)}` : '/admin/users');
  }

  return (
    <div className="px-6 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage team members, roles, and access.
          </p>
        </div>

        {/* Search */}
        <form action={handleSearch} className="relative">
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            id="user-search"
            name="q"
            defaultValue={q}
            placeholder="Search by name or email"
            className="pl-8 w-56 h-8 text-sm"
          />
        </form>
      </div>

      {/* Error state */}
      {data === null ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">Unable to load users right now.</p>
        </div>
      ) : data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {q ? `No users matching "${q}".` : 'No users yet.'}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((user) => {
                const isSelf = user.id === currentUserId;
                const initials = getInitials(user.name, user.email);

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Avatar */}
                        {user.image ? (
                          <img
                            src={user.image}
                            alt=""
                            width={28}
                            height={28}
                            className="h-7 w-7 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                            <span className="text-[11px] font-semibold text-primary leading-none">
                              {initials}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {user.name ?? <span className="text-muted-foreground italic">—</span>}
                          </p>
                          {isSelf && (
                            <p className="text-[10px] text-muted-foreground leading-tight">You</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{user.email}</span>
                    </TableCell>
                    <TableCell>
                      {user.role ? (
                        <Badge variant="secondary">{user.role.name}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <time
                        dateTime={user.createdAt}
                        className="font-mono text-xs text-muted-foreground tabular-nums"
                      >
                        {formatDate(user.createdAt)}
                      </time>
                    </TableCell>
                    <TableCell className="text-right">
                      <UserRowActions user={user} roles={roles} isSelf={isSelf} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {data && data.total > perPage && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <p className="font-mono text-xs text-muted-foreground">
            {data.total} user{data.total !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <a
                href={`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1), perPage: String(perPage) }).toString()}`}
                className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors duration-150"
              >
                Previous
              </a>
            ) : (
              <span className="inline-flex items-center justify-center rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed">
                Previous
              </span>
            )}
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {page} / {Math.ceil(data.total / perPage)}
            </span>
            {page < Math.ceil(data.total / perPage) ? (
              <a
                href={`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1), perPage: String(perPage) }).toString()}`}
                className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors duration-150"
              >
                Next
              </a>
            ) : (
              <span className="inline-flex items-center justify-center rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed">
                Next
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
