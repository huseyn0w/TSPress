'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createMenu } from './actions';

export function CreateMenuForm() {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await createMenu({ name, location });
      if (res.ok) {
        toast.success('Menu created');
        setName('');
        setLocation('');
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="rounded-md border border-border p-4 space-y-4">
      <h2 className="text-sm font-semibold">New menu</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="menu-name">Name</Label>
          <Input
            id="menu-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Main navigation"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="menu-location">Location</Label>
          <Input
            id="menu-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="primary"
          />
        </div>
      </div>
      <Button onClick={submit} disabled={isPending || !name || !location}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Create menu
      </Button>
    </section>
  );
}
