export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-lg ${className}`} />;
}

export function PanelSkeleton({ label, lines = 3, chart = false }: { label: string; lines?: number; chart?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="rounded-2xl border border-line bg-card p-4">
      <span className="sr-only">Loading {label}…</span>
      <Skeleton className="h-5 w-1/3" />
      {chart && <Skeleton className="mt-4 h-56 w-full" />}
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`mt-3 h-4 ${i % 2 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}
