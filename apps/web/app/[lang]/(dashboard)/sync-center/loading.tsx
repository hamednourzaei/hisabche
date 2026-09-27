const STAT_ITEMS = [1, 2, 3, 4] as const
const ROW_ITEMS = [1, 2, 3] as const

export default function Loading() {
  return (
    <div className="hisab-root space-y-6 p-6 animate-fade-in-up">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="skeleton-shimmer h-8 w-8 rounded-lg" />
          <div className="skeleton-shimmer h-8 w-48 rounded-lg" />
        </div>
        <div className="skeleton-shimmer h-4 w-64 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_ITEMS.map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 flex items-center gap-4 backdrop-blur-sm"
          >
            <div className="skeleton-shimmer h-14 w-14 rounded-2xl" />
            <div className="space-y-2">
              <div className="skeleton-shimmer h-6 w-16 rounded-lg" />
              <div className="skeleton-shimmer h-3 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="skeleton-shimmer h-5 w-5 rounded-md" />
          <div className="skeleton-shimmer h-5 w-32 rounded-md" />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="skeleton-shimmer h-9 w-32 rounded-xl" />
          <div className="skeleton-shimmer h-9 w-28 rounded-xl" />
          <div className="skeleton-shimmer h-9 w-28 rounded-xl" />
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="skeleton-shimmer h-5 w-5 rounded-md" />
          <div className="skeleton-shimmer h-5 w-32 rounded-md" />
        </div>
        <div className="space-y-3">
          {ROW_ITEMS.map((i) => (
            <div key={i} className="skeleton-shimmer h-16 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
