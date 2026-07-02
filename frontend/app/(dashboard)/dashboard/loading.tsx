import { KPICardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/shared/LoadingSkeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="space-y-1">
        <div className="h-7 w-48 bg-bg-elevated rounded-xl shimmer" />
        <div className="h-4 w-64 bg-bg-elevated rounded-xl shimmer" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <KPICardSkeleton key={i} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton height="h-80" />
        <ChartSkeleton height="h-80" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartSkeleton height="h-72" />
        <ChartSkeleton height="h-72" />
        <ChartSkeleton height="h-72" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card rounded-2xl p-5">
          <div className="h-5 w-40 bg-bg-elevated rounded-xl shimmer mb-5" />
          <TableSkeleton rows={5} />
        </div>
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="h-5 w-32 bg-bg-elevated rounded-xl shimmer" />
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-bg-elevated rounded-xl shimmer" />)}
        </div>
      </div>
    </div>
  );
}
