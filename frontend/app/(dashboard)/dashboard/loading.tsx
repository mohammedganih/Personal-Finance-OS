export default function DashboardLoading() {
  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card-light rounded-2xl h-32 animate-pulse bg-paper-subtle" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card-light rounded-2xl h-64 animate-pulse bg-paper-subtle" />
        <div className="card-light rounded-2xl h-64 animate-pulse bg-paper-subtle" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card-light rounded-2xl h-72 animate-pulse bg-paper-subtle" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-light rounded-2xl h-64 animate-pulse bg-paper-subtle" />
        <div className="card-light rounded-2xl h-40 animate-pulse bg-paper-subtle" />
      </div>
    </div>
  );
}
