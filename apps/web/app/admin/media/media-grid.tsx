'use client';

import { deleteMedia, updateMedia } from '@/app/admin/media/actions';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Media } from '@typress/config';
import { Copy, FileText, Loader2, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function absoluteUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_ORIGIN}${url}`;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

interface MediaTileProps {
  item: Media;
  onSelect: (item: Media) => void;
}

function MediaTile({ item, onSelect }: MediaTileProps) {
  const absUrl = absoluteUrl(item.url);
  const image = isImage(item.mimeType);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group relative flex flex-col rounded-md border border-border bg-card overflow-hidden hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-150"
      aria-label={`Open ${item.originalName}`}
    >
      {/* Thumbnail area */}
      <div className="aspect-square w-full bg-muted flex items-center justify-center overflow-hidden">
        {image ? (
          <img
            src={absUrl}
            alt={item.alt ?? item.originalName}
            width={item.width ?? 200}
            height={item.height ?? 200}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
        )}
      </div>

      {/* Caption row */}
      <div className="px-2 py-1.5 min-w-0">
        <p className="text-xs font-medium text-foreground truncate leading-tight">
          {item.originalName}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
          {humanSize(item.size)}
          {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
        </p>
      </div>
    </button>
  );
}

interface MediaEditDialogProps {
  item: Media | null;
  onClose: () => void;
}

function MediaEditDialog({ item, onClose }: MediaEditDialogProps) {
  const [alt, setAlt] = useState(item?.alt ?? '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [caption, setCaption] = useState(item?.caption ?? '');
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Sync fields when item changes (dialog re-opens)
  const [lastId, setLastId] = useState<string | null>(null);
  if (item && item.id !== lastId) {
    setLastId(item.id);
    setAlt(item.alt ?? '');
    setTitle(item.title ?? '');
    setCaption(item.caption ?? '');
    setDeleteConfirm(false);
  }

  function handleSave() {
    if (!item) return;
    startTransition(async () => {
      const result = await updateMedia(item.id, {
        alt: alt.trim() || null,
        title: title.trim() || null,
        caption: caption.trim() || null,
      });
      if (result.ok) {
        toast.success('Media updated');
        onClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    if (!item) return;
    startTransition(async () => {
      const result = await deleteMedia(item.id);
      if (result.ok) {
        toast.success('Media deleted');
        onClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleCopyUrl() {
    if (!item) return;
    const url = absoluteUrl(item.url);
    navigator.clipboard.writeText(url).then(
      () => toast.success('URL copied'),
      () => toast.error('Failed to copy URL'),
    );
  }

  const image = item ? isImage(item.mimeType) : false;
  const absUrl = item ? absoluteUrl(item.url) : '';

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="truncate">{item?.originalName ?? 'Media'}</DialogTitle>
          <DialogDescription>Edit metadata or copy the URL for use in content.</DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-4">
            {/* Preview */}
            <div className="rounded-md border border-border bg-muted flex items-center justify-center overflow-hidden h-48">
              {image ? (
                <img
                  src={absUrl}
                  alt={item.alt ?? item.originalName}
                  width={item.width ?? 400}
                  height={item.height ?? 300}
                  loading="lazy"
                  className="max-h-48 max-w-full object-contain"
                />
              ) : (
                <FileText className="h-12 w-12 text-muted-foreground" aria-hidden />
              )}
            </div>

            {/* Meta line */}
            <p className="font-mono text-xs text-muted-foreground">
              {humanSize(item.size)}
              {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
              {' · '}
              {item.mimeType}
            </p>

            {/* Fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="media-alt">
                  Alt text <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="media-alt"
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                  placeholder="Describe the image for screen readers"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="media-title">
                  Title <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="media-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Display title"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="media-caption">
                  Caption <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="media-caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Caption shown below the image"
                  rows={2}
                />
              </div>
            </div>

            {/* Delete confirm */}
            {deleteConfirm && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3 space-y-2">
                <p className="text-sm text-destructive font-medium">
                  Delete this file permanently?
                </p>
                <p className="text-xs text-muted-foreground">This cannot be undone.</p>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirm(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                    onClick={handleDelete}
                  >
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive hover:border-destructive/40 sm:mr-auto"
            onClick={() => setDeleteConfirm(true)}
            disabled={isPending || deleteConfirm}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyUrl} disabled={isPending}>
            <Copy className="h-3.5 w-3.5" />
            Copy URL
          </Button>
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" disabled={isPending} onClick={handleSave}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MediaGridProps {
  items: Media[];
}

export function MediaGrid({ items }: MediaGridProps) {
  const [selected, setSelected] = useState<Media | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {items.map((item) => (
          <MediaTile key={item.id} item={item} onSelect={setSelected} />
        ))}
      </div>

      <MediaEditDialog item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
