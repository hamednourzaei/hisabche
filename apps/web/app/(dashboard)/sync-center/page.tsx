import dynamic from "next/dynamic"

const STAT_ITEMS = [1, 2, 3, 4] as const
const ROW_ITEMS = [1, 2, 3] as const

export function SyncCenterSkeleton() {
  return (
    <div className="hisab-root space-y-6 p-6 animate-fade-in-up">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="skeleton-shimmer h-8 w-8" />
          <div className="skeleton-shimmer h-8 w-48" />
        </div>
        <div className="skeleton-shimmer h-4 w-64" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_ITEMS.map((i) => (
          <div key={i} className="interactive-card p-5 flex items-center gap-4">
            <div className="skeleton-shimmer h-14 w-14" />
            <div className="space-y-2">
              <div className="skeleton-shimmer h-6 w-16" />
              <div className="skeleton-shimmer h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <div className="skeleton-shimmer h-5 w-5" />
          <div className="skeleton-shimmer h-5 w-32" />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="skeleton-shimmer h-9 w-32" />
          <div className="skeleton-shimmer h-9 w-28" />
          <div className="skeleton-shimmer h-9 w-28" />
        </div>
      </div>

      <div className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <div className="skeleton-shimmer h-5 w-5" />
          <div className="skeleton-shimmer h-5 w-32" />
        </div>
        <div className="space-y-3">
          {ROW_ITEMS.map((i) => (
            <div key={i} className="skeleton-shimmer h-16" />
          ))}
        </div>
      </div>
    </div>
  )
}

const SyncCenterPage = dynamic(
  () => import("@hisabche/ui").then((m) => m.SyncCenterPage),
  { loading: () => <SyncCenterSkeleton />, ssr: true }
)

export const metadata = {
  title: "مرکز همگام‌سازی | حسابچه",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <SyncCenterPage />
    </main>
  )
}