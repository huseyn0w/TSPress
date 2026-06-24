import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/admin/api';
import { postListSchema } from '@cmstack-ts/config';
import type { PostList } from '@cmstack-ts/config';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Overview shape — defined here until promoted to @cmstack-ts/config
const overviewSchema = z.object({
  users: z.number().int(),
  roles: z.number().int(),
});
type Overview = z.infer<typeof overviewSchema>;

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg bg-card px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
      </div>
      <p className="font-mono text-3xl font-semibold tabular-nums text-foreground leading-none">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function statusBadgeVariant(status: string): 'success' | 'muted' | 'secondary' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'DRAFT') return 'muted';
  return 'secondary';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

async function fetchOverview(): Promise<Overview | null> {
  try {
    return await apiGet('/admin/overview', overviewSchema);
  } catch {
    return null;
  }
}

async function fetchRecentPosts(): Promise<PostList | null> {
  try {
    return await apiGet('/posts?perPage=5', postListSchema);
  } catch {
    return null;
  }
}

export default async function AdminDashboardPage() {
  const [overview, recentPosts] = await Promise.all([fetchOverview(), fetchRecentPosts()]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Heading */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Overview</h2>
        <p className="text-sm text-muted-foreground mt-1">A snapshot of your site at a glance.</p>
      </div>

      {/* Stat tiles */}
      {overview ? (
        <div className="grid grid-cols-2 gap-4 mb-10 sm:grid-cols-3">
          <StatTile label="Users" value={overview.users} icon={<Users className="h-4 w-4" />} />
          <StatTile label="Roles" value={overview.roles} />
          {recentPosts && <StatTile label="Total posts" value={recentPosts.total} />}
        </div>
      ) : (
        <div className="mb-10 p-4 rounded-lg border border-border bg-muted/30">
          <p className="text-sm text-muted-foreground">Overview data is unavailable right now.</p>
        </div>
      )}

      {/* Recent posts */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Recent posts</h3>
          <Link
            href="/admin/posts"
            className="text-xs text-muted-foreground hover:text-primary transition-colors duration-150"
          >
            View all
          </Link>
        </div>

        {recentPosts && recentPosts.items.length > 0 ? (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-card">
            {recentPosts.items.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/admin/posts/${post.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors duration-150"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
                    {post.author?.name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{post.author.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={statusBadgeVariant(post.status)}>
                      {post.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                    </Badge>
                    <time
                      dateTime={post.createdAt}
                      className="font-mono text-xs text-muted-foreground tabular-nums"
                    >
                      {formatDate(post.createdAt)}
                    </time>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : recentPosts && recentPosts.items.length === 0 ? (
          <div className="border border-border rounded-lg bg-card px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">No posts yet.</p>
            <Link
              href="/admin/posts/new"
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              Create your first post
            </Link>
          </div>
        ) : (
          <div className="border border-border rounded-lg bg-muted/30 px-4 py-6">
            <p className="text-sm text-muted-foreground">Posts data is unavailable right now.</p>
          </div>
        )}
      </section>
    </div>
  );
}
