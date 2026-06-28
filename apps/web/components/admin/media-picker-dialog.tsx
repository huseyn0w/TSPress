'use client';

import { listMediaForPicker } from '@/app/admin/media/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { absoluteMediaUrl, defaultAltFor, isImageMedia } from '@/lib/admin/media-insert';
import type { Media } from '@cmstack-ts/config';
import { ImageOff, Loader2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen image's absolute src + alt when the user confirms. */
  onInsert: (attrs: { src: string; alt: string }) => void;
}

export function MediaPickerDialog({ open, onOpenChange, onInsert }: MediaPickerDialogProps) {
  const [items, setItems] = useState<Media[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Media | null>(null);
  const [alt, setAlt] = useState('');
  const [isLoading, startLoading] = useTransition();

  // Load the (image-only) media list each time the picker opens.
  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setError(null);
    startLoading(async () => {
      const result = await listMediaForPicker(1, 48);
      if (result.ok) {
        setItems(result.data.items.filter((m) => isImageMedia(m.mimeType)));
      } else {
        setError(result.error);
      }
    });
  }, [open]);

  function handleSelect(item: Media) {
    setSelected(item);
    setAlt(defaultAltFor(item));
  }

  function handleInsert() {
    if (!selected) return;
    onInsert({ src: absoluteMediaUrl(selected.url, API_ORIGIN), alt: alt.trim() });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Insert image</DialogTitle>
          <DialogDescription>Choose an image from the media library.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : error ? (
          <div className="rounded-md border border-border bg-muted/30 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ImageOff className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground mt-2">No images in the library yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload images on the Media page, then insert them here.
            </p>
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {items.map((item) => {
                const thumb = item.thumbnails.find((t) => t.label === 'thumb');
                const src = absoluteMediaUrl(thumb?.url ?? item.url, API_ORIGIN);
                const active = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    aria-pressed={active}
                    aria-label={`Select ${item.originalName}`}
                    className={`group relative aspect-square rounded-md border bg-muted overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors ${
                      active
                        ? 'border-primary ring-2 ring-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <img
                      src={src}
                      alt=""
                      width={item.width ?? 160}
                      height={item.height ?? 160}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selected && (
          <div className="space-y-1.5 border-t border-border pt-4">
            <Label htmlFor="picker-alt">
              Alt text <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="picker-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Describe the image for screen readers"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!selected} onClick={handleInsert}>
            Insert image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
