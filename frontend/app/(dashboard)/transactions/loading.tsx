import { TableSkeleton } from '@/components/shared/LoadingSkeleton';

export default function TransactionsLoading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-36 bg-bg-elevated rounded-xl shimmer" />
          <div className="h-4 w-28 bg-bg-elevated rounded-xl shimmer" />
        </div>
        <div className="h-9 w-36 bg-bg-elevated rounded-xl shimmer" />
      </div>
      <div className="glass-card rounded-2xl p-4 h-14 shimmer" />
      <div className="glass-card rounded-2xl p-5">
        <TableSkeleton rows={10} />
      </div>
    </div>
  );
}
