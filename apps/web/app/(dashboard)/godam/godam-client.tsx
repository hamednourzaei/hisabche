"use client"


const STAT_ITEMS = [1, 2, 3, 4] as const
const LIST_ITEMS = [1, 2, 3, 4, 5] as const

export function GodamSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="skeleton-shimmer h-8 w-32 rounded-lg" />
          <div className="skeleton-shimmer h-4 w-48 rounded-lg" />
        </div>
        <div className="skeleton-shimmer h-10 w-32 rounded-xl" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_ITEMS.map((i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3 backdrop-blur-sm">
            <div className="skeleton-shimmer h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <div className="skeleton-shimmer h-4 w-12 rounded-md" />
              <div className="skeleton-shimmer h-6 w-16 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="skeleton-shimmer h-6 w-20 rounded-lg" />
        <div className="skeleton-shimmer h-6 w-20 rounded-lg" />
        <div className="skeleton-shimmer h-6 w-20 rounded-lg" />
      </div>

      <div className="skeleton-shimmer h-10 w-64 rounded-lg" />

      <div className="space-y-3">
        {LIST_ITEMS.map((i) => (
          <div key={i} className="skeleton-shimmer h-[72px] rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
