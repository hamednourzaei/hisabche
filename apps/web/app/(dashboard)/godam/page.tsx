import dynamic from "next/dynamic"
import { useRealtime } from "@hisabche/api"
const STAT_ITEMS = [1, 2, 3, 4] as const
const LIST_ITEMS = [1, 2, 3, 4, 5] as const
useRealtime({ table: 'products', queryKey: ['products'] })

export function GodamSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="skeleton-shimmer h-8 w-32" />
          <div className="skeleton-shimmer h-4 w-48" />
        </div>
        <div className="skeleton-shimmer h-10 w-32" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_ITEMS.map((i) => (
          <div key={i} className="glass-card p-4 flex items-center gap-3">
            <div className="skeleton-shimmer h-10 w-10" />
            <div className="space-y-2">
              <div className="skeleton-shimmer h-4 w-12" />
              <div className="skeleton-shimmer h-6 w-16" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="skeleton-shimmer h-6 w-20" />
        <div className="skeleton-shimmer h-6 w-20" />
        <div className="skeleton-shimmer h-6 w-20" />
      </div>

      <div className="skeleton-shimmer h-10 w-64" />

      <div className="space-y-3">
        {LIST_ITEMS.map((i) => (
          <div key={i} className="skeleton-shimmer h-[72px]" />
        ))}
      </div>
    </div>
  )
}

const GodamPage = dynamic(
  () => import("@hisabche/ui").then((m) => m.GodamPage),
  { loading: () => <GodamSkeleton />, ssr: true }
)

export const metadata = {
  title: "ګدام | حسابچه",
  description: "مدیریت محصولات و موجودی انبار",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <GodamPage />
    </main>
  )
}