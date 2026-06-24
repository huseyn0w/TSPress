import { MediaGrid } from '@/app/admin/media/media-grid';
import { UploadButton } from '@/app/admin/media/upload-button';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/admin/api';
import { mediaListSchema } from '@cmstack-ts/config';
import type { MediaList } from '@cmstack-ts/config';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function fetchMedia(page: number, perPage: number): Promise<MediaList | null> {
  try {
    const query = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
    });
    return await apiGet(`/media?${query.toString()}`, mediaListSchema);
  } catch {
    return null;
  }
}

interface MediaPageProps {
  searchParams: Promise<{ page?: string; perPage?: string }>;
}

export default async function MediaPage({ searchParams }: MediaPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const perPage = Math.min(100, Math.max(1, Number(params.perPage ?? '24') || 24));

  const data = await fetchMedia(page, perPage);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <div className="px-6 py-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Media</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload and manage images, documents, and other files.
          </p>
        </div>
        <UploadButton />
      </div>

      {/* Error state */}
      {data === null ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">Unable to load media right now.</p>
        </div>
      ) : data.items.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-sm text-muted-foreground">No media files yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Upload images, PDFs, or other files to get started.
          </p>
        </div>
      ) : (
        <>
          <MediaGrid items={data.items} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
              <p className="font-mono text-xs text-muted-foreground">
                {data.total} file{data.total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/media?page=${page - 1}&perPage=${perPage}`}>Previous</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Previous
                  </Button>
                )}
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {page} / {totalPages}
                </span>
                {page < totalPages ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/media?page=${page + 1}&perPage=${perPage}`}>Next</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Next
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
