import type { Metadata } from "next"

// ✅ Server Component — zero client JS
// KPI از backend مستقیم fetch میشه
async function getDashboardSummary() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://hisabche.onrender.com/api'}/invoices?page=1&limit=5&sortDirection=desc`, {
      next: { revalidate: 30 },
      headers: { 'Accept-Encoding': 'gzip' },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

const STAT_ITEMS = [1, 2, 3] as const
const ROW_ITEMS = [1, 2, 3] as const

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="skeleton-shimmer h-8 w-48 rounded-lg" />
        <div className="skeleton-shimmer h-4 w-64 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STAT_ITEMS.map((i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="skeleton-shimmer h-10 w-10 rounded-xl" />
              <div className="skeleton-shimmer h-4 w-4 rounded-md" />
            </div>
            <div className="skeleton-shimmer h-4 w-20 rounded-md" />
            <div className="skeleton-shimmer h-8 w-32 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5 backdrop-blur-sm">
        <div className="skeleton-shimmer h-5 w-32 rounded-md" />
        <div className="space-y-3">
          {ROW_ITEMS.map((i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="skeleton-shimmer h-9 w-9 rounded-full" />
                <div className="space-y-2">
                  <div className="skeleton-shimmer h-3.5 w-28 rounded-md" />
                  <div className="skeleton-shimmer h-3 w-20 rounded-md" />
                </div>
              </div>
              <div className="skeleton-shimmer h-4 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  title: "داشبورد | حسابچه",
  description: "نمای کلی کسب‌وکار — فروش امروز، موجودی انبار، بدهی مشتریان و آخرین فاکتورها",
  robots: { index: false, follow: false },
}

// ✅ ISR — 30s cache, no client fetch on repeat visits
export const revalidate = 30

export default async function Page() {
  const data = await getDashboardSummary()
  const kpi = data?.summary ?? { todaySales: 0, totalDebt: 0, lowStockCount: 0 }
  const recentInvoices = data?.invoices?.slice(0, 5) ?? []

  return (
    <main className="section">
      <div className="space-y-6">
        {/* Greeting — pure server render */}
        <ServerGreeting />

        {/* KPI Cards — server-rendered, zero hydration */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ServerStatCard label="فروش امروز" value={`${kpi.todaySales.toLocaleString("fa-AF")} AFN`} tone="emerald" />
          <ServerStatCard label="موجودی کم" value={kpi.lowStockCount.toString()} hint="قلم نیاز به شارژ" tone="amber" />
          <ServerStatCard label="مجموع بدهی" value={`${kpi.totalDebt.toLocaleString("fa-AF")} AFN`} tone="rose" />
        </div>

        {/* Recent Invoices — server-rendered */}
        <div className="glass-card rounded-2xl border border-[var(--hisab-border)]">
          <div className="p-6 pb-0">
            <h3 className="text-base font-semibold">آخرین فاکتورها</h3>
          </div>
          <div className="p-6">
            {recentInvoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--hisab-muted-fg)]">هنوز فاکتوری ثبت نشده</p>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((inv: any, i: number) => (
                  <div key={inv.id || i} className="flex items-center justify-between rounded-xl border border-[var(--hisab-border)] p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{inv.customer_name || inv.customerName || "بدون نام"}</p>
                      <p className="text-xs text-[var(--hisab-muted-fg)]">{inv.date ? new Date(inv.date).toLocaleDateString("fa-AF") : ""}</p>
                    </div>
                    <p className="font-bold tabular-nums">{Number(inv.total || 0).toLocaleString("fa-AF")} AFN</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

// ✅ Pure Server Components — zero JS sent to client
function ServerGreeting() {
  const h = new Date().getHours()
  const k = h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night"
  const greetings: Record<string, string> = { morning: "صبح بخیر", afternoon: "ظهر بخیر", evening: "عصر بخیر", night: "شب بخیر" }
  return (
    <div className="space-y-1.5">
      <h1 className="text-2xl font-bold sm:text-3xl">{greetings[k]}</h1>
      <p className="text-sm text-[var(--hisab-muted-fg)]">امروز چه خبر از کسب‌وکارت؟</p>
    </div>
  )
}

function ServerStatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: "emerald" | "amber" | "rose" }) {
  const bg = { emerald: "from-emerald-500/10 to-emerald-500/[0.02]", amber: "from-amber-500/10 to-amber-500/[0.02]", rose: "from-rose-500/10 to-rose-500/[0.02]" }
  return (
    <div className={`glass-card relative overflow-hidden rounded-2xl border border-[var(--hisab-border)] p-5 bg-gradient-to-br ${bg[tone]}`}>
      <p className="mb-1 text-xs font-medium text-[var(--hisab-muted-fg)]">{label}</p>
      <p className="text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      {hint && <p className="mt-1.5 text-[10px] text-[var(--hisab-muted-fg)]">{hint}</p>}
    </div>
  )
}