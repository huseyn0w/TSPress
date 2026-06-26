'use client';

import { Button } from '@/components/ui/button';
import type { PluginInfo } from '@cmstack-ts/config';
import { Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { togglePluginAction } from './actions';

export function PluginList({ plugins }: { plugins: PluginInfo[] }) {
  const [items, setItems] = useState(plugins);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string, enabled: boolean) {
    startTransition(async () => {
      const res = await togglePluginAction(id, enabled);
      if (res.ok) {
        setItems((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)));
        toast.success(`${enabled ? 'Enabled' : 'Disabled'} plugin`);
      } else {
        toast.error(res.error);
      }
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No plugins available.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-4 rounded-md border border-border bg-card p-4"
        >
          <div>
            <p className="font-medium text-foreground">{p.name}</p>
            <p className="text-sm text-muted-foreground">{p.description}</p>
          </div>
          <Button
            variant={p.enabled ? 'outline' : 'default'}
            size="sm"
            disabled={isPending}
            onClick={() => toggle(p.id, !p.enabled)}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {p.enabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      ))}
    </div>
  );
}
