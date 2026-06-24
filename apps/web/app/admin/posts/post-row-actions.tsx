'use client';

import {
  deletePostAction,
  permanentDeletePostAction,
  restorePostAction,
  togglePostStatusAction,
} from '@/app/admin/posts/actions';
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
import type { PostSummary } from '@cmstack-ts/config';
import { MoreHorizontal, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

interface PostRowActionsProps {
  post: PostSummary;
  isTrash: boolean;
}

export function PostRowActions({ post, isTrash }: PostRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmDialog, setConfirmDialog] = useState<'trash' | 'permanent' | null>(null);

  function handleToggleStatus() {
    startTransition(async () => {
      const result = await togglePostStatusAction(post.id, post.status);
      if (result.ok) {
        toast.success(post.status === 'PUBLISHED' ? 'Post unpublished' : 'Post published');
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleTrash() {
    startTransition(async () => {
      const result = await deletePostAction(post.id);
      if (result.ok) {
        toast.success('Post moved to trash');
        setConfirmDialog(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRestore() {
    startTransition(async () => {
      const result = await restorePostAction(post.id);
      if (result.ok) {
        toast.success('Post restored');
      } else {
        toast.error(result.error);
      }
    });
  }

  function handlePermanentDelete() {
    startTransition(async () => {
      const result = await permanentDeletePostAction(post.id);
      if (result.ok) {
        toast.success('Post permanently deleted');
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
            aria-label="Post actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isTrash && (
            <>
              <DropdownMenuItem asChild>
                <Link href={`/admin/posts/${post.id}/edit`} className="flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleStatus}>
                <RefreshCw className="h-4 w-4" />
                {post.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
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
              &ldquo;{post.title}&rdquo; will be moved to trash and can be restored later.
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
              &ldquo;{post.title}&rdquo; will be permanently deleted. This cannot be undone.
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
