'use client';

import { Button } from '@/components/ui/button';
import type { AdminComment, CommentStatus } from '@typress/config';
import { Check, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deleteComment, moderateComment } from './actions';

export function CommentRowActions({ comment }: { comment: AdminComment }) {
  const [isPending, startTransition] = useTransition();

  function setStatus(status: CommentStatus) {
    startTransition(async () => {
      const res = await moderateComment(comment.id, status, comment.postSlug);
      res.ok ? toast.success(`Marked ${status.toLowerCase()}`) : toast.error(res.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteComment(comment.id, comment.postSlug);
      if (!res.ok) toast.error(res.error);
      else toast.success('Comment deleted');
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {comment.status !== 'APPROVED' && (
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => setStatus('APPROVED')}
          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/5"
        >
          <Check className="h-3.5 w-3.5" />
          Approve
        </Button>
      )}
      {comment.status !== 'SPAM' && (
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => setStatus('SPAM')}
          className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/5"
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Spam
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={remove}
        className="text-destructive hover:text-destructive hover:bg-destructive/5"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </Button>
    </div>
  );
}
