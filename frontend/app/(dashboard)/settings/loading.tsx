export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="space-y-1">
        <div className="h-7 w-28 bg-bg-elevated rounded-xl shimmer" />
        <div className="h-4 w-48 bg-bg-elevated rounded-xl shimmer" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass-card rounded-2xl p-5 h-36 shimmer" />
      ))}
    </div>
  );
}
