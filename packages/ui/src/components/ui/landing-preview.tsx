"use client"

import { memo, useEffect, useState } from "react"
import { Card, CardContent } from "./card"
import { Badge } from "./badge"
import { cn } from "../../lib/utils"

const KPI_DATA = [
  {
    label: "فروش امروز",
    value: "۱۲۵,۰۰۰",
    change: "+۱۲٪",
    changeColor: "text-[var(--hisab-success)]",
  },
  {
    label: "فاکتورها",
    value: "۲۴",
    change: "+۳",
    changeColor: "text-[var(--hisab-success)]",
  },
  {
    label: "بدهی",
    value: "۸۵,۰۰۰",
    change: "-۵٪",
    changeColor: "text-[var(--hisab-destructive)]",
  },
] as const

const CHART_HEIGHTS = [
  42, 68, 48, 82, 58, 92, 72, 86, 64, 78,
] as const

const INVOICES = [
  {
    name: "احمد رحمانی",
    amount: "۴۵,۰۰۰",
    status: "پرداخت",
    variant: "success" as const,
  },
  {
    name: "فاطمه کریمی",
    amount: "۱۲۰,۰۰۰",
    status: "بدهی",
    variant: "destructive" as const,
  },
] as const

function KpiCard({
  label,
  value,
  change,
  changeColor,
}: {
  label: string
  value: string
  change: string
  changeColor: string
}) {
  return (
    <Card className="interactive-card">
      <CardContent
        className="p-2.5"
        role="group"
        aria-label={`${label}: ${value}، تغییر ${change}`}
      >
        <div className="mb-1 text-[9px] text-[var(--hisab-muted-fg)]">
          {label}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold">{value}</span>
          <span className={cn("text-[10px]", changeColor)}>
            {change}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function ChartBars() {
  return (
    <Card className="interactive-card">
      <CardContent
        className="h-[60px] p-3"
        role="img"
        aria-label="نمودار فروش"
      >
        <div className="flex h-full items-end gap-1">
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
    <Card className="interactive-card overflow-hidden">
      <div className="bg-[var(--hisab-muted)]/20 px-3 py-1.5 text-[10px] font-medium text-[var(--hisab-muted-fg)]">
        آخرین تراکنش‌ها
      </div>
      {INVOICES.map((inv, i) => (
        <div
          key={i}
          className="flex items-center justify-between border-b border-[var(--hisab-border)]/50 px-3 py-2 last:border-0"
          role="listitem"
        >
          <div className="flex items-center gap-2 text-start">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--hisab-primary)]/10 text-[10px]"
              aria-hidden="true"
            >
              {inv.name[0]}
            </div>
            <span className="text-[11px] text-[var(--hisab-foreground)]/80">
              {inv.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium">
              {inv.amount} ؋
            </span>
            <Badge variant={inv.variant} size="sm">
              {inv.status}
            </Badge>
          </div>
        </div>
      ))}
    </Card>
  )
}

function useInView(threshold = 0.05) {
  const [inView, setInView] = useState(false)
  const ref = (el: HTMLDivElement | null) => {
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold }
    )
    obs.observe(el)
  }
  return { ref, inView }
}

export const LandingPreview = memo(
  function LandingPreview() {
    const { ref, inView } = useInView(0.05)
    const [hydrated, setHydrated] = useState(false)

    useEffect(() => {
      if (inView) setHydrated(true)
    }, [inView])

    return (
      <div
        ref={ref}
        className={cn(
          "relative mx-auto max-w-2xl transition-all duration-700",
          inView
            ? "translate-y-0 opacity-100"
            : "translate-y-8 opacity-0"
        )}
        role="complementary"
        aria-label="پیش‌نمایش داشبورد حسابچه"
      >
        {/* Stacked card shadows */}
        <div
          className="absolute -bottom-4 left-3 right-3 h-full rounded-2xl border border-[var(--hisab-border)]/40 bg-[var(--hisab-card)]/30"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-2 left-1 right-1 h-full rounded-2xl border border-[var(--hisab-border)]/60 bg-[var(--hisab-card)]/50"
          aria-hidden="true"
        />

        <Card className="glass-card overflow-hidden">
          {/* Window chrome */}
          <div className="flex items-center gap-2 border-b border-[var(--hisab-border)] bg-[var(--hisab-muted)]/10 px-4 py-2.5">
            <div className="flex gap-1.5" aria-hidden="true">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
            </div>
            <span className="ms-2 text-[10px] text-[var(--hisab-muted-fg)]">
              داشبورد
            </span>
            <Badge
              variant="success"
              size="sm"
              className="ms-auto"
            >
              <span
                className="me-1 h-1.5 w-1.5 rounded-full bg-[var(--hisab-success)]"
                aria-hidden="true"
              />
              آنلاین
            </Badge>
          </div>

          {hydrated ? (
            <CardContent className="space-y-3 p-4">
              <div
                className="grid grid-cols-3 gap-2"
                role="list"
                aria-label="شاخص‌های کلیدی"
              >
                {KPI_DATA.map((kpi, i) => (
                  <KpiCard key={i} {...kpi} />
                ))}
              </div>
              <ChartBars />
              <InvoiceFeed />
            </CardContent>
          ) : (
            <div className="h-[200px] p-4" />
          )}
        </Card>

        {/* Floating invoice badge (desktop only) */}
        <Card
          className="glass-card animate-float-slow absolute -right-4 -top-4 hidden p-3 shadow-xl lg:block"
          aria-hidden="true"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--hisab-primary)]/10 text-sm">
              🧾
            </div>
            <div>
              <div className="text-[10px] text-[var(--hisab-muted-fg)]">
                فاکتور جدید
              </div>
              <div className="text-xs font-semibold text-[var(--hisab-primary)]">
                INV-042
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }
)