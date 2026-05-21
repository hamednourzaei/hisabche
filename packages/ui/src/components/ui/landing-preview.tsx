// ═══════════════════════════════════════════════════════════
// packages/ui/src/components/ui/landing-preview.tsx (v5)
// ═══════════════════════════════════════════════════════════
"use client"

import { memo, useEffect, useMemo, useState } from "react"
import { useInView } from "../../lib/use-in-view"
import { Card, CardContent } from "./card"
import { Badge } from "./badge"
import { cn } from "../../lib/utils"

const KPI_DATA = [
  { label: "فروش امروز", value: "۱۲۵,۰۰۰", change: "+۱۲٪", changeColor: "text-[var(--hisab-success)]" },
  { label: "فاکتورها", value: "۲۴", change: "+۳", changeColor: "text-[var(--hisab-success)]" },
  { label: "بدهی", value: "۸۵,۰۰۰", change: "-۵٪", changeColor: "text-[var(--hisab-destructive)]" },
] as const

const CHART_HEIGHTS = [42, 68, 48, 82, 58, 92, 72, 86, 64, 78] as const

const INVOICES = [
  { name: "احمد رحمانی", amount: "۴۵,۰۰۰", status: "پرداخت", variant: "success" as const },
  { name: "فاطمه کریمی", amount: "۱۲۰,۰۰۰", status: "بدهی", variant: "destructive" as const },
] as const

// ─── Sub-components ──────────────────────────────────
function KpiCard({ label, value, change, changeColor }: {
  label: string; value: string; change: string; changeColor: string
}) {
  return (
    <Card className="border-[var(--hisab-border)]">
      <CardContent className="p-2.5" role="group" aria-label={`${label}: ${value}، تغییر ${change}`}>
        <div className="text-[9px] text-[var(--hisab-muted-fg)] mb-1">{label}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold text-[var(--hisab-foreground)]">{value}</span>
          <span className={cn("text-[10px]", changeColor)}>{change}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function ChartBars() {
  return (
    <Card className="border-[var(--hisab-border)]">
      <CardContent className="p-3 h-[60px]" role="img" aria-label="نمودار فروش">
        <div className="flex items-end gap-1 h-full">
          {CHART_HEIGHTS.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-[var(--hisab-primary)]/20 transition-all hover:bg-[var(--hisab-primary)]/40"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function InvoiceFeed() {
  return (
    <Card className="border-[var(--hisab-border)] overflow-hidden">
      <div className="bg-[var(--hisab-muted)]/20 px-3 py-1.5 text-[10px] text-[var(--hisab-muted-fg)] font-medium">
        آخرین تراکنش‌ها
      </div>
      {INVOICES.map((inv, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-3 py-2 border-b border-[var(--hisab-border)]/50 last:border-0"
          role="listitem"
        >
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-[var(--hisab-primary)]/10 flex items-center justify-center text-[10px]" aria-hidden="true">
              {inv.name[0]}
            </div>
            <span className="text-[11px] text-[var(--hisab-foreground)]/80">{inv.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-[var(--hisab-foreground)]">{inv.amount} ؋</span>
            <Badge variant={inv.variant} size="sm">{inv.status}</Badge>
          </div>
        </div>
      ))}
    </Card>
  )
}

// ─── Main ─────────────────────────────────────────────
export const LandingPreview = memo(function LandingPreview() {
  const { ref, inView } = useInView(0.05)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (inView) setHydrated(true)
  }, [inView])

  const kpis = useMemo(() => KPI_DATA, [])

  return (
    <div
      ref={ref}
      className={cn(
        "relative mx-auto max-w-2xl transition-all duration-700",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
      role="complementary"
      aria-label="پیش‌نمایش داشبورد حسابچه"
    >
      {/* Depth layers */}
      <div className="absolute -bottom-4 left-3 right-3 h-full rounded-2xl bg-[var(--hisab-card)]/30 border border-[var(--hisab-border)]/40" aria-hidden="true" />
      <div className="absolute -bottom-2 left-1 right-1 h-full rounded-2xl bg-[var(--hisab-card)]/50 border border-[var(--hisab-border)]/60" aria-hidden="true" />

      {/* Main frame */}
      <Card className="border-[var(--hisab-border)] shadow-2xl shadow-[var(--hisab-primary)]/5 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-[var(--hisab-border)] px-4 py-2.5 bg-[var(--hisab-muted)]/10">
          <div className="flex gap-1.5" aria-hidden="true">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
          </div>
          <span className="ml-2 text-[10px] text-[var(--hisab-muted-fg)]">داشبورد</span>
          <Badge variant="success" size="sm" className="ml-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--hisab-success)] mr-1" aria-hidden="true" />
            آنلاین
          </Badge>
        </div>

        {hydrated ? (
          <CardContent className="p-4 space-y-3">
            {/* KPI Row */}
            <div className="grid grid-cols-3 gap-2" role="list" aria-label="شاخص‌های کلیدی">
              {kpis.map((kpi, i) => <KpiCard key={i} {...kpi} />)}
            </div>

            {/* Chart */}
            <ChartBars />

            {/* Invoice Feed */}
            <InvoiceFeed />
          </CardContent>
        ) : (
          <div className="p-4 h-[200px]" />
        )}
      </Card>

      {/* Floating card */}
      <Card className="absolute -top-4 -right-4 p-3 shadow-xl hidden lg:block animate-float-slow border-[var(--hisab-border)]" aria-hidden="true">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--hisab-primary)]/10 text-sm">🧾</div>
          <div>
            <div className="text-[10px] text-[var(--hisab-muted-fg)]">فاکتور جدید</div>
            <div className="text-xs font-semibold text-[var(--hisab-primary)]">INV-042</div>
          </div>
        </div>
      </Card>
    </div>
  )
})