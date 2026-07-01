'use client';

import {
  createCategoryAction,
  deleteCategoryAction,
  deleteCategoryTranslationAction,
  updateCategoryAction,
  upsertCategoryTranslationAction,
} from '@/app/admin/categories/actions';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { diffTermTranslations, seedTermTranslations } from '@/lib/admin/term-translations';
import type { CategoryView } from '@/types/content';
import { Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { type ReactNode, useState, useTransition } from 'react';
import { toast } from 'sonner';

interface CategoriesClientProps {
  categories: CategoryView[];
  mode: 'create' | 'edit';
  category?: CategoryView;
  trigger?: ReactNode;
}

export function CategoriesClient({ categories, mode, category, trigger }: CategoriesClientProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [parentId, setParentId] = useState<string>(category?.parentId ?? '');
  const seededTranslations = seedTermTranslations(category?.translations ?? [], OVERRIDE_LOCALES);
  const [translations, setTranslations] = useState<Record<string, string>>(seededTranslations);

  const parentOptions = categories.filter((c) => c.id !== category?.id);

  function resetForm() {
    setName(category?.name ?? '');
    setSlug(category?.slug ?? '');
    setDescription(category?.description ?? '');
    setParentId(category?.parentId ?? '');
    setTranslations(seedTermTranslations(category?.translations ?? [], OVERRIDE_LOCALES));
  }

  /** Persist any changed per-locale name overrides. Returns an error message or null. */
  async function saveTranslations(id: string): Promise<string | null> {
    const ops = diffTermTranslations(seededTranslations, translations, OVERRIDE_LOCALES);
    for (const op of ops) {
      const res =
        op.action === 'upsert'
          ? await upsertCategoryTranslationAction(id, op.locale, { name: op.name })
          : await deleteCategoryTranslationAction(id, op.locale);
      if (!res.ok) return res.error;
    }
    return null;
  }

  function handleSubmit() {
    const input = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      description: description.trim() || undefined,
      parentId: parentId || undefined,
    };

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createCategoryAction(input);
        if (result.ok) {
          toast.success('Category created');
          setFormOpen(false);
          resetForm();
        } else {
          toast.error(result.error);
        }
      } else if (category) {
        const result = await updateCategoryAction(category.id, input);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const translationError = await saveTranslations(category.id);
        if (translationError) {
          toast.error(translationError);
          return;
        }
        toast.success('Category updated');
        setFormOpen(false);
      }
    });
  }

  function handleDelete() {
    if (!category) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(category.id);
      if (result.ok) {
        toast.success('Category deleted');
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
          <DialogTitle>{mode === 'create' ? 'New category' : 'Edit category'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a new category to organize your content.'
              : 'Update the category details.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-slug">
              Slug <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="cat-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="category-slug"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-description">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="cat-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description…"
              rows={2}
            />
          </div>
          {parentOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="cat-parent">
                Parent <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select
                value={parentId || 'none'}
                onValueChange={(v) => setParentId(v === 'none' ? '' : v)}
              >
                <SelectTrigger id="cat-parent">
                  <SelectValue placeholder="No parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent</SelectItem>
                  {parentOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              &ldquo;{category?.name}&rdquo; will be permanently deleted. Posts using this category
              will be unaffected.
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
            aria-label="Category actions"
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
