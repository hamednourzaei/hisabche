import dynamic from "next/dynamic"
import { Card, CardContent } from "@hisabche/ui"

const STAT_ITEMS = [1, 2, 3] as const
const ROW_ITEMS = [1, 2, 3, 4, 5] as const

export function BaqidariSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="skeleton-shimmer h-8 w-40" />
          <div className="skeleton-shimmer h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton-shimmer h-10 w-28" />
          <div className="skeleton-shimmer h-10 w-28" />
        </div>
      </div>
      <div className="skeleton-shimmer h-10 w-64" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STAT_ITEMS.map((i) => (
          <Card key={i} className="glass-card overflow-hidden">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="skeleton-shimmer h-12 w-12" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-3 w-24" />
                <div className="skeleton-shimmer h-7 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-3">
        {ROW_ITEMS.map((i) => (
          <div key={i} className="skeleton-shimmer h-[72px]" />
        ))}
      </div>
    </div>
  )
}

const BaqidariPage = dynamic(
  () => import("@hisabche/ui").then((m) => m.BaqidariPage),
  { loading: () => <BaqidariSkeleton />, ssr: true }
)

// ❌ حذف: export const dynamic = "force-dynamic"
// ❌ چون dynamic قبلاً به عنوان import اومده

export const metadata = {
  title: "باقی‌داری | حسابچه",
  description: "مدیریت حساب مشتریان و بدهی‌ها",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <BaqidariPage />
    </main>
  )
}