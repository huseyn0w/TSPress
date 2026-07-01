'use client';

import { bulkDeleteTagsAction } from '@/app/admin/tags/actions';
import { TagsClient } from '@/app/admin/tags/tags-client';
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
import type { TagView } from '@/types/content';
import { Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

export function TagsBulkTable({ tags }: { tags: TagView[] }) {
  const ids = tags.map((t) => t.id);
  const selection = useRowSelection(ids);
  const [isPending, startTransition] = useTransition();

  function runDelete() {
    const targetIds = selection.selectedIds;
    startTransition(async () => {
      const result = await bulkDeleteTagsAction(targetIds);
      if (result.ok) {
        const msg = bulkResultMessage(result.data, 'deleted', 'tag');
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
        title: `Delete ${selection.count} tag${selection.count === 1 ? '' : 's'}?`,
        description:
          'The selected tags will be permanently deleted. Posts using them are unaffected.',
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
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.map((tag) => (
              <TableRow
                key={tag.id}
                data-selected={selection.isSelected(tag.id) || undefined}
                className="data-[selected]:bg-primary/5"
              >
                <TableCell className="w-10">
                  <RowCheckbox
                    checked={selection.isSelected(tag.id)}
                    onToggle={() => selection.toggle(tag.id)}
                    label={`Select tag ${tag.name}`}
                    disabled={isPending}
                  />
                </TableCell>
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

      {selection.count > 0 && (
        <BulkBar
          count={selection.count}
          noun="tag"
          actions={actions}
          onClear={selection.clear}
          isPending={isPending}
        />
      )}
    </>
  );
}
