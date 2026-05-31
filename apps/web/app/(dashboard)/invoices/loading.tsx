const CARD_ITEMS = [1, 2, 3, 4, 5, 6] as const

export default function Loading() {
  return (
    <main className="section">
      <div className="space-y-6 animate-fade-in-up">
        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="skeleton-shimmer h-8 w-32 rounded-lg" />
            <div className="skeleton-shimmer h-4 w-48 rounded-lg" />
          </div>
          <div className="skeleton-shimmer h-10 w-32 rounded-xl" />
        </div>

        {/* ── Search + Clear ── */}
        <div className="flex gap-2">
          <div className="skeleton-shimmer h-10 w-64 rounded-xl" />
          <div className="skeleton-shimmer h-10 w-24 rounded-xl" />
        </div>

        {/* ── Invoice cards ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CARD_ITEMS.map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4 backdrop-blur-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="skeleton-shimmer h-11 w-11 rounded-xl" />
                  <div className="space-y-2">
                    <div className="skeleton-shimmer h-4 w-20 rounded-md" />
                    <div className="skeleton-shimmer h-3 w-16 rounded-md" />
                  </div>
                </div>
                <div className="skeleton-shimmer h-5 w-16 rounded-lg" />
              </div>
              <div className="space-y-2">
                <div className="skeleton-shimmer h-3 w-12 rounded-md" />
                <div className="skeleton-shimmer h-8 w-28 rounded-lg" />
              </div>
              <div className="flex justify-end gap-2">
                <div className="skeleton-shimmer h-9 w-9 rounded-xl" />
                <div className="skeleton-shimmer h-9 w-9 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}