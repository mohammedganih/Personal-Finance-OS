export default function LoansLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-36 bg-bg-elevated rounded-xl shimmer" />
          <div className="h-4 w-28 bg-bg-elevated rounded-xl shimmer" />
        </div>
        <div className="h-9 w-28 bg-bg-elevated rounded-xl shimmer" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card rounded-2xl p-4 h-20 shimmer" />)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-40 shimmer" />)}
      </div>
    </div>
  );
}
