'use client';

import { bulkDeleteCategoriesAction } from '@/app/admin/categories/actions';
import { CategoriesClient } from '@/app/admin/categories/categories-client';
import { type BulkAction, BulkBar } from '@/components/admin/bulk-bar';
import { RowCheckbox, SelectAllCheckbox, useRowSelection } from '@/components/admin/bulk-selection';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { bulkResultMessage } from '@/lib/admin/bulk';
import type { CategoryView } from '@/types/content';
import { Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

export function CategoriesBulkTable({ categories }: { categories: CategoryView[] }) {
  const ids = categories.map((c) => c.id);
  const selection = useRowSelection(ids);
  const [isPending, startTransition] = useTransition();

  function runDelete() {
    const targetIds = selection.selectedIds;
    startTransition(async () => {
      const result = await bulkDeleteCategoriesAction(targetIds);
      if (result.ok) {
        const msg = bulkResultMessage(result.data, 'deleted', 'category', 'categories');
        if (result.data.failed > 0) {
          toast.error(result.data.firstError ? `${msg}: ${result.data.firstError}` : msg);
        } else {
          toast.success(msg);
        }
        selection.clear();
      } else {
        toast.error(result.error);
      }
    });
  }

  const actions: BulkAction[] = [
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      destructive: true,
      confirm: {
        title: `Delete ${selection.count} categor${selection.count === 1 ? 'y' : 'ies'}?`,
        description:
          'The selected categories will be permanently deleted. Posts using them are unaffected.',
        confirmLabel: 'Delete',
      },
      onRun: runDelete,
    },
  ];

  return (
    <>
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <SelectAllCheckbox
                  state={selection.headerState}
                  onToggle={selection.toggleAll}
                  disabled={isPending}
                />
              </TableHead>
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
                <TableRow
                  key={cat.id}
                  data-selected={selection.isSelected(cat.id) || undefined}
                  className="data-[selected]:bg-primary/5"
                >
                  <TableCell className="w-10">
                    <RowCheckbox
                      checked={selection.isSelected(cat.id)}
                      onToggle={() => selection.toggle(cat.id)}
                      label={`Select category ${cat.name}`}
                      disabled={isPending}
                    />
                  </TableCell>
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

      {selection.count > 0 && (
        <BulkBar
          count={selection.count}
          noun="category"
          nounPlural="categories"
          actions={actions}
          onClear={selection.clear}
          isPending={isPending}
        />
      )}
    </>
  );
}
