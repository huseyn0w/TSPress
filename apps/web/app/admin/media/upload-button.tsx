'use client';

import { uploadMedia } from '@/app/admin/media/actions';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { useRef, useTransition } from 'react';
import { toast } from 'sonner';

const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,application/pdf';

export function UploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    inputRef.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    // Reset so the same file can be re-selected
    e.target.value = '';

    startTransition(async () => {
      for (const file of fileList) {
        const fd = new FormData();
        fd.append('file', file);
        const result = await uploadMedia(fd);
        if (result.ok) {
          toast.success(`Uploaded ${file.name}`);
        } else {
          toast.error(`${file.name}: ${result.error}`);
        }
      }
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        aria-label="Upload media files"
        onChange={handleChange}
      />
      <Button size="sm" disabled={isPending} onClick={handleClick}>
        {isPending ? (
          <span
            className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
            aria-hidden
          />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        Upload
      </Button>
    </>
  );
}
