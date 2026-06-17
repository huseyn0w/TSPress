import { Skeleton } from '@/components/ui/skeleton';

const SKELETON_ROWS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'row-6', 'row-7', 'row-8'];

export default function UsersLoading() {
  return (
    <div className="px-6 py-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-8 w-52" />
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="border-b border-border px-4 py-3 flex gap-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-8 ml-auto" />
        </div>
        {SKELETON_ROWS.map((key) => (
          <div
            key={key}
            className="px-4 py-3.5 border-b border-border last:border-0 flex items-center gap-4"
          >
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-6 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
