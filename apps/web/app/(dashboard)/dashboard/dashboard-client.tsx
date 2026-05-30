const STAT_ITEMS = [1, 2, 3] as const
const ROW_ITEMS = [1, 2, 3] as const

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="space-y-1.5">
        <div className="skeleton-shimmer h-8 w-48 rounded-lg" />
        <div className="skeleton-shimmer h-4 w-64 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STAT_ITEMS.map((i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="skeleton-shimmer h-10 w-10 rounded-xl" />
              <div className="skeleton-shimmer h-4 w-4 rounded-md" />
            </div>
            <div className="skeleton-shimmer h-4 w-20 rounded-md" />
            <div className="skeleton-shimmer h-8 w-32 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5 backdrop-blur-sm">
        <div className="skeleton-shimmer h-5 w-32 rounded-md" />
        <div className="space-y-3">
          {ROW_ITEMS.map((i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="skeleton-shimmer h-9 w-9 rounded-full" />
                <div className="space-y-2">
                  <div className="skeleton-shimmer h-3.5 w-28 rounded-md" />
                  <div className="skeleton-shimmer h-3 w-20 rounded-md" />
                </div>
              </div>
              <div className="skeleton-shimmer h-4 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}