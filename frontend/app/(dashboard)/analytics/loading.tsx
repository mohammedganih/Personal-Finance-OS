import { ChartSkeleton } from '@/components/shared/LoadingSkeleton';

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="space-y-1">
        <div className="h-7 w-48 bg-bg-elevated rounded-xl shimmer" />
        <div className="h-4 w-56 bg-bg-elevated rounded-xl shimmer" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton height="h-80" />
        <ChartSkeleton height="h-80" />
      </div>
      <ChartSkeleton height="h-72" />
      <ChartSkeleton height="h-72" />
    </div>
  );
}
