import dynamic from "next/dynamic"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@hisabche/ui"

// ═══════════════════════════════════════════
// Static skeleton arrays
// ═══════════════════════════════════════════
const STAT_ITEMS = [1, 2, 3] as const
const ROW_ITEMS = [1, 2, 3, 4, 5] as const

// ═══════════════════════════════════════════
// Realistic Skeleton
// ═══════════════════════════════════════════
function BaqidariSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
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

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="skeleton-shimmer h-11 flex-1 rounded-2xl" />
        <div className="skeleton-shimmer h-11 w-32 rounded-2xl" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STAT_ITEMS.map((i) => (
          <Card
            key={i}
            className="glass-card overflow-hidden"
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="skeleton-shimmer h-12 w-12 rounded-2xl shrink-0" />

              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-3 w-24 rounded-md" />
                <div className="skeleton-shimmer h-7 w-32 rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table/List */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle>
            <div className="skeleton-shimmer h-5 w-40 rounded-md" />
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {ROW_ITEMS.map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-2xl border border-[hsl(var(--hisab-border))]
              bg-[hsl(var(--hisab-card)/.45)] p-4"
            >
              <div className="flex items-center gap-3">
                <div className="skeleton-shimmer h-11 w-11 rounded-full" />

                <div className="space-y-2">
                  <div className="skeleton-shimmer h-4 w-32 rounded-md" />
                  <div className="skeleton-shimmer h-3 w-20 rounded-md" />
                </div>
              </div>

              <div className="space-y-2 text-left">
                <div className="skeleton-shimmer h-4 w-24 rounded-md" />
                <div className="skeleton-shimmer h-3 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════
// Dynamic import
// ═══════════════════════════════════════════
const BaqidariPage = dynamic(
  () =>
    import("@hisabche/ui").then(
      (m) => m.BaqidariPage
    ),
  {
    loading: () => <BaqidariSkeleton />,
    ssr: true,
  }
)

// ═══════════════════════════════════════════
// ISR
// ═══════════════════════════════════════════
export const revalidate = 60

// ═══════════════════════════════════════════
// Metadata
// ═══════════════════════════════════════════
export const metadata = {
  title: "باقی‌داری | حسابچه",
  description:
    "مدیریت حساب مشتریان و بدهی‌ها — پیگیری پرداخت‌ها و مشاهده حساب‌ها",
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
  robots: {
    index: true,
    follow: true,
  },
}

// ═══════════════════════════════════════════
// Page
// ═══════════════════════════════════════════
export default function Page() {
  return (
    <main className="section">
      <BaqidariPage />
    </main>
  )
}