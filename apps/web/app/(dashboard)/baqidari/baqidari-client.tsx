"use client"

import dynamic from "next/dynamic"

const STAT_ITEMS = [1, 2, 3] as const
const ROW_ITEMS = [1, 2, 3, 4, 5] as const

export function BaqidariSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="skeleton-shimmer h-8 w-40 rounded-lg" />
          <div className="skeleton-shimmer h-4 w-64 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton-shimmer h-10 w-28 rounded-xl" />
          <div className="skeleton-shimmer h-10 w-28 rounded-xl" />
        </div>
      </div>
      <div className="skeleton-shimmer h-10 w-64 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STAT_ITEMS.map((i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="skeleton-shimmer h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-3 w-24 rounded-md" />
                <div className="skeleton-shimmer h-7 w-32 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {ROW_ITEMS.map((i) => (
          <div key={i} className="skeleton-shimmer h-[72px] rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

const BaqidariPage = dynamic(
  () => import("@hisabche/ui").then((m) => m.BaqidariPage),
  { loading: () => <BaqidariSkeleton />, ssr: true }
)

export function BaqidariClient() {
  return <BaqidariPage />
}