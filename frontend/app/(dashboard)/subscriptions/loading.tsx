export default function SubscriptionsLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-40 bg-bg-elevated rounded-xl shimmer" />
          <div className="h-4 w-24 bg-bg-elevated rounded-xl shimmer" />
        </div>
        <div className="h-9 w-40 bg-bg-elevated rounded-xl shimmer" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card rounded-2xl p-4 h-20 shimmer" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-24 shimmer" />)}
      </div>
    </div>
  );
}
