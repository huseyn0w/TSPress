import { Skeleton } from '@/components/ui/skeleton';

const headerCols = [
  { key: 'title', width: 220 },
  { key: 'status', width: 80 },
  { key: 'updated', width: 100 },
  { key: 'actions', width: 40 },
];

const skeletonRows = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5'];

const tabItems = [
  { key: 'tab-all', width: 80 },
  { key: 'tab-published', width: 90 },
  { key: 'tab-draft', width: 70 },
  { key: 'tab-trash', width: 70 },
];

export default function PagesLoading() {
  return (
    <div className="px-6 py-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>

      <div className="flex gap-4 border-b border-border mb-6">
        {tabItems.map((t) => (
          <Skeleton key={t.key} className="h-5 mb-2" style={{ width: `${t.width}px` }} />
        ))}
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="border-b border-border px-4 py-3 flex gap-6">
          {headerCols.map((col) => (
            <Skeleton key={col.key} className="h-4" style={{ width: `${col.width}px` }} />
          ))}
        </div>
        {skeletonRows.map((key) => (
          <div
            key={key}
            className="px-4 py-3 border-b border-border last:border-0 flex gap-6 items-center"
          >
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
