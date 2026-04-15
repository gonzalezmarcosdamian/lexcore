// Componentes de skeleton reutilizables para estados de carga
// Todos usan animate-pulse + bg-ink-100 coherente con el design system

export function SkeletonRow({ cols = 2 }: { cols?: 2 | 3 }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-ink-100 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-ink-100 rounded w-1/3" />
        {cols === 3 && <div className="h-3 bg-ink-100 rounded w-1/2" />}
        <div className="h-3 bg-ink-100 rounded w-1/4" />
      </div>
      <div className="w-4 h-4 bg-ink-100 rounded flex-shrink-0" />
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 animate-pulse">
      <div className="h-3 bg-ink-100 rounded w-1/2 mb-3" />
      <div className="h-8 bg-ink-100 rounded w-1/3 mb-2" />
      <div className="h-2.5 bg-ink-50 rounded w-2/5" />
    </div>
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden animate-pulse">
      <div className="px-5 py-4 border-b border-ink-100">
        <div className="h-4 bg-ink-100 rounded w-1/3" />
      </div>
      <div className="divide-y divide-ink-50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3">
            <div className="w-2 h-2 rounded-full bg-ink-100 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-ink-100 rounded w-3/4" />
              <div className="h-2.5 bg-ink-50 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonText({ lines = 2, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-ink-100 rounded"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cls = size === "sm" ? "w-7 h-7" : size === "lg" ? "w-12 h-12" : "w-10 h-10";
  return <div className={`${cls} rounded-full bg-ink-100 animate-pulse flex-shrink-0`} />;
}

export function SkeletonBadge() {
  return <div className="h-5 w-16 bg-ink-100 rounded-full animate-pulse" />;
}
