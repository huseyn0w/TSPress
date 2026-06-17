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
import type { CategoryView } from '@/types/content';
import { CategoriesClient } from './categories-client';

export const dynamic = 'force-dynamic';

async function fetchCategories(): Promise<CategoryView[] | null> {
  try {
    return await apiGet<CategoryView[]>('/categories');
  } catch {
    return null;
  }
}

export default async function CategoriesPage() {
  const categories = await fetchCategories();

  return (
    <div className="px-6 py-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize your content with categories.
          </p>
        </div>
        {categories !== null && (
          <CategoriesClient
            categories={categories}
            trigger={
              <Button size="sm" asChild>
                <span>New category</span>
              </Button>
            }
            mode="create"
          />
        )}
      </div>

      {categories === null ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">Unable to load categories right now.</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => {
                const parent = categories.find((c) => c.id === cat.parentId);
                return (
                  <TableRow key={cat.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{cat.name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{cat.slug}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {parent ? parent.name : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground truncate max-w-xs block">
                        {cat.description ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <CategoriesClient categories={categories} mode="edit" category={cat} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
