import dynamic from "next/dynamic"

const STAT_ITEMS = [1, 2, 3] as const
const ROW_ITEMS = [1, 2, 3] as const

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="space-y-1.5">
        <div className="skeleton-shimmer h-8 w-48" />
        <div className="skeleton-shimmer h-4 w-64" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STAT_ITEMS.map((i) => (
          <div key={i} className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="skeleton-shimmer h-10 w-10" />
              <div className="skeleton-shimmer h-4 w-4" />
            </div>
            <div className="skeleton-shimmer h-4 w-20" />
            <div className="skeleton-shimmer h-8 w-32" />
          </div>
        ))}
      </div>

      <div className="glass-card p-6 space-y-5">
        <div className="skeleton-shimmer h-5 w-32" />
        <div className="space-y-3">
          {ROW_ITEMS.map((i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-[var(--hisab-border)]">
              <div className="flex items-center gap-3">
                <div className="skeleton-shimmer h-9 w-9 rounded-full" />
                <div className="space-y-2">
                  <div className="skeleton-shimmer h-3.5 w-28" />
                  <div className="skeleton-shimmer h-3 w-20" />
                </div>
              </div>
              <div className="skeleton-shimmer h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const DashboardPage = dynamic(
  () => import("@hisabche/ui").then((m) => m.DashboardPage),
  { loading: () => <DashboardSkeleton />, ssr: true }
)

export const metadata = {
  title: "داشبورد | حسابچه",
  description: "نمای کلی کسب‌وکار",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <DashboardPage />
    </main>
  )
}