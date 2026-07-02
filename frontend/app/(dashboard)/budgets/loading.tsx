export default function BudgetsLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-28 bg-bg-elevated rounded-xl shimmer" />
          <div className="h-4 w-48 bg-bg-elevated rounded-xl shimmer" />
        </div>
        <div className="h-9 w-32 bg-bg-elevated rounded-xl shimmer" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 h-40 shimmer" />
        ))}
      </div>
    </div>
  );
}
