export default function BillsLoading() {
  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-52 bg-bg-elevated rounded-xl shimmer" />
          <div className="h-4 w-72 bg-bg-elevated rounded-xl shimmer" />
        </div>
        <div className="h-9 w-28 bg-bg-elevated rounded-xl shimmer" />
      </div>
      <div className="h-10 w-96 bg-bg-elevated rounded-xl shimmer" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-24 shimmer" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-64 shimmer" />)}
      </div>
    </div>
  );
}
