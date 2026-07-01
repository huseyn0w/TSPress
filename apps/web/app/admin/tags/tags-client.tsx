'use client';

import {
  createTagAction,
  deleteTagAction,
  deleteTagTranslationAction,
  updateTagAction,
  upsertTagTranslationAction,
} from '@/app/admin/tags/actions';
import {
  OVERRIDE_LOCALES,
  TermTranslationFields,
} from '@/components/admin/term-translation-fields';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { diffTermTranslations, seedTermTranslations } from '@/lib/admin/term-translations';
import type { TagView } from '@/types/content';
import { Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { type ReactNode, useState, useTransition } from 'react';
import { toast } from 'sonner';

interface TagsClientProps {
  mode: 'create' | 'edit';
  tag?: TagView;
  trigger?: ReactNode;
}

export function TagsClient({ mode, tag, trigger }: TagsClientProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(tag?.name ?? '');
  const [slug, setSlug] = useState(tag?.slug ?? '');
  const seededTranslations = seedTermTranslations(tag?.translations ?? [], OVERRIDE_LOCALES);
  const [translations, setTranslations] = useState<Record<string, string>>(seededTranslations);

  function resetForm() {
    setName(tag?.name ?? '');
    setSlug(tag?.slug ?? '');
    setTranslations(seedTermTranslations(tag?.translations ?? [], OVERRIDE_LOCALES));
  }

  /** Persist any changed per-locale name overrides. Returns an error message or null. */
  async function saveTranslations(id: string): Promise<string | null> {
    const ops = diffTermTranslations(seededTranslations, translations, OVERRIDE_LOCALES);
    for (const op of ops) {
      const res =
        op.action === 'upsert'
          ? await upsertTagTranslationAction(id, op.locale, { name: op.name })
          : await deleteTagTranslationAction(id, op.locale);
      if (!res.ok) return res.error;
    }
    return null;
  }

  function handleSubmit() {
    const input = {
      name: name.trim(),
      slug: slug.trim() || undefined,
    };

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createTagAction(input);
        if (result.ok) {
          toast.success('Tag created');
          setFormOpen(false);
          setName('');
          setSlug('');
        } else {
          toast.error(result.error);
        }
      } else if (tag) {
        const result = await updateTagAction(tag.id, input);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const translationError = await saveTranslations(tag.id);
        if (translationError) {
          toast.error(translationError);
          return;
        }
        toast.success('Tag updated');
        setFormOpen(false);
      }
    });
  }

  function handleDelete() {
    if (!tag) return;
    startTransition(async () => {
      const result = await deleteTagAction(tag.id);
      if (result.ok) {
        toast.success('Tag deleted');
        setDeleteOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  const formDialog = (
    <Dialog
      open={formOpen}
      onOpenChange={(open) => {
        setFormOpen(open);
        if (!open) resetForm();
      }}
    >
      {trigger ? (
        <DialogTrigger asChild onClick={() => setFormOpen(true)}>
          {trigger}
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New tag' : 'Edit tag'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? 'Add a new tag to label your content.' : 'Update the tag details.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tag-name">Name</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tag name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) handleSubmit();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tag-slug">
              Slug <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="tag-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="tag-slug"
              className="font-mono text-xs"
            />
          </div>
          {mode === 'edit' && (
            <TermTranslationFields
              values={translations}
              onChange={(locale, value) =>
                setTranslations((prev) => ({ ...prev, [locale]: value }))
              }
              basePlaceholder={name}
            />
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" disabled={isPending || !name.trim()} onClick={handleSubmit}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (mode === 'create') {
    return formDialog;
  }

  return (
    <>
      {formDialog}

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tag?</DialogTitle>
            <DialogDescription>
              &ldquo;{tag?.name}&rdquo; will be permanently deleted. Posts using this tag will be
              unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" size="sm" disabled={isPending} onClick={handleDelete}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            aria-label="Tag actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setFormOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive focus:bg-destructive/5"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
