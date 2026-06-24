'use client';

import {
  deletePageAction,
  permanentDeletePageAction,
  restorePageAction,
} from '@/app/admin/pages/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PageDetail } from '@cmstack-ts/config';
import { MoreHorizontal, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

interface PageRowActionsProps {
  page: PageDetail;
  isTrash: boolean;
}

export function PageRowActions({ page, isTrash }: PageRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmDialog, setConfirmDialog] = useState<'trash' | 'permanent' | null>(null);

  function handleTrash() {
    startTransition(async () => {
      const result = await deletePageAction(page.id);
      if (result.ok) {
        toast.success('Page moved to trash');
        setConfirmDialog(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRestore() {
    startTransition(async () => {
      const result = await restorePageAction(page.id);
      if (result.ok) {
        toast.success('Page restored');
      } else {
        toast.error(result.error);
      }
    });
  }

  function handlePermanentDelete() {
    startTransition(async () => {
      const result = await permanentDeletePageAction(page.id);
      if (result.ok) {
        toast.success('Page permanently deleted');
        setConfirmDialog(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            disabled={isPending}
            aria-label="Page actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isTrash && (
            <>
              <DropdownMenuItem asChild>
                <Link href={`/admin/pages/${page.id}/edit`} className="flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/5"
                onClick={() => setConfirmDialog('trash')}
              >
                <Trash2 className="h-4 w-4" />
                Move to trash
              </DropdownMenuItem>
            </>
          )}
          {isTrash && (
            <>
              <DropdownMenuItem onClick={handleRestore}>
                <RefreshCw className="h-4 w-4" />
                Restore
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/5"
                onClick={() => setConfirmDialog('permanent')}
              >
                <Trash2 className="h-4 w-4" />
                Delete permanently
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Trash confirm */}
      <Dialog open={confirmDialog === 'trash'} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to trash?</DialogTitle>
            <DialogDescription>
              &ldquo;{page.title}&rdquo; will be moved to trash and can be restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" size="sm" disabled={isPending} onClick={handleTrash}>
              Move to trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent delete confirm */}
      <Dialog open={confirmDialog === 'permanent'} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete permanently?</DialogTitle>
            <DialogDescription>
              &ldquo;{page.title}&rdquo; will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={handlePermanentDelete}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
