import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet } from '@/lib/admin/api';
import type { TagView } from '@/types/content';
import { TagsClient } from './tags-client';

export const dynamic = 'force-dynamic';

async function fetchTags(): Promise<TagView[] | null> {
  try {
    return await apiGet<TagView[]>('/tags');
  } catch {
    return null;
  }
}

export default async function TagsPage() {
  const tags = await fetchTags();

  return (
    <div className="px-6 py-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tags</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Label your content with tags for easy discovery.
          </p>
        </div>
        {tags !== null && (
          <TagsClient
            mode="create"
            trigger={
              <Button size="sm" asChild>
                <span>New tag</span>
              </Button>
            }
          />
        )}
      </div>

      {tags === null ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">Unable to load tags right now.</p>
        </div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">No tags yet.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">{tag.name}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">{tag.slug}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <TagsClient mode="edit" tag={tag} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
