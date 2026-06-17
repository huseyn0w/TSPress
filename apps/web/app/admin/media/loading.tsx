import { Skeleton } from '@/components/ui/skeleton';

const SKELETON_KEYS = [
  'sk-1',
  'sk-2',
  'sk-3',
  'sk-4',
  'sk-5',
  'sk-6',
  'sk-7',
  'sk-8',
  'sk-9',
  'sk-10',
  'sk-11',
  'sk-12',
  'sk-13',
  'sk-14',
  'sk-15',
  'sk-16',
  'sk-17',
  'sk-18',
  'sk-19',
  'sk-20',
  'sk-21',
  'sk-22',
  'sk-23',
  'sk-24',
];

export default function MediaLoading() {
  return (
    <div className="px-6 py-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {SKELETON_KEYS.map((k) => (
          <div key={k} className="rounded-md border border-border bg-card overflow-hidden">
            <Skeleton className="aspect-square w-full" />
            <div className="px-2 py-1.5 space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2.5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
