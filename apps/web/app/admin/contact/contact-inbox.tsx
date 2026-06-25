'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AdminContact } from '@cmstack-ts/config';
import { Check, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deleteSubmission, setHandled } from './actions';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function Row({ item }: { item: AdminContact }) {
  const [isPending, startTransition] = useTransition();
  const handled = item.handledAt !== null;

  function toggle() {
    startTransition(async () => {
      const res = await setHandled(item.id, !handled);
      res.ok
        ? toast.success(handled ? 'Marked unhandled' : 'Marked handled')
        : toast.error(res.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteSubmission(item.id);
      res.ok ? toast.success('Deleted') : toast.error(res.error);
    });
  }

  return (
    <li className="rounded-md border border-border p-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium">{item.name}</span>
        <a
          href={`mailto:${item.email}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {item.email}
        </a>
        {handled && <Badge variant="secondary">Handled</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
      </div>
      {item.subject && <p className="text-sm font-medium">{item.subject}</p>}
      <p className="text-sm text-foreground" style={{ whiteSpace: 'pre-wrap' }}>
        {item.message}
      </p>
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={toggle} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : handled ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {handled ? 'Mark unhandled' : 'Mark handled'}
        </Button>
        <Button size="sm" variant="ghost" onClick={remove} disabled={isPending}>
          <Trash2 className="h-4 w-4 text-destructive" />
          Delete
        </Button>
      </div>
    </li>
  );
}

export function ContactInbox({ items }: { items: AdminContact[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No messages yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <Row key={item.id} item={item} />
      ))}
    </ul>
  );
}
