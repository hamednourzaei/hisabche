import dynamic from "next/dynamic"
import { Card, CardContent } from "@hisabche/ui"

// ═══ 1. Static skeleton items — no Array.from per render ═══
const STAT_SKELETONS = [1, 2, 3] as const
const LIST_SKELETONS = [1, 2, 3, 4] as const

// ═══ 2. Skeleton هماهنگ با layout واقعی ═══
function BaqidariSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton-shimmer h-8 w-32" />
          <div className="skeleton-shimmer h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton-shimmer h-10 w-28 rounded-lg" />
          <div className="skeleton-shimmer h-10 w-28 rounded-lg" />
        </div>
      </div>

      <div className="skeleton-shimmer h-10 w-64 rounded-lg" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STAT_SKELETONS.map((i) => (
          <Card key={i} className="interactive-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="skeleton-shimmer h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <div className="skeleton-shimmer h-6 w-16" />
                <div className="skeleton-shimmer h-3 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        {LIST_SKELETONS.map((i) => (
          <div key={i} className="skeleton-shimmer h-[72px] rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

// ═══ 3. Dynamic import — Next.js native ═══
const BaqidariPage = dynamic(
() => import("@hisabche/ui").then((m) => m.BaqidariPage),
  {
    loading: () => <BaqidariSkeleton />,
    ssr: true,
  }
)

// ═══ 4. ISR ═══
export const revalidate = 60

// ═══ 5. Full metadata ═══
export const metadata = {
  title: "باقی‌داری | حسابچه",
  description: "مدیریت حساب مشتریان و بدهی‌ها — پیگیری پرداخت‌ها، مشاهده بدهی مشتریان و ثبت تراکنش‌های مالی",
  openGraph: {
    title: "باقی‌داری | حسابچه",
    description: "مدیریت حساب مشتریان و بدهی‌ها",
    type: "website",
    locale: "fa_AF",
  },
  twitter: {
    card: "summary_large_image",
    title: "باقی‌داری | حسابچه",
    description: "مدیریت حساب مشتریان و بدهی‌ها",
  },
  robots: { index: true, follow: true },
}

// ═══ 6. Page — content-visibility + dynamic ═══
export default function Page() {
  return (
    <main className="section">
      <BaqidariPage />
    </main>
  )
}