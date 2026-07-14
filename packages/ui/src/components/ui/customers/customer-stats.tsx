// packages/ui/src/components/ui/customers/customer-stats.tsx
"use client"

import { Users, DollarSign, AlertTriangle, Star, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface CustomerStatsProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  totalCustomers: number
  totalDebt: number
  overdueCount: number
  vipCount: number
  todaySales: number
  currency?: string
  isMobile?: boolean
}

export function customersStats({
  t, fmt, totalCustomers, totalDebt, overdueCount, vipCount, todaySales, currency = "AFN", isMobile,
}: CustomerStatsProps) {
  // ═══ Mobile: Single Summary Card ═══
  if (isMobile) {
    return (
      <div className="w-full rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[hsl(var(--border-default))]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-[hsl(var(--fg-secondary))]" />
              <span className="text-sm font-medium text-[hsl(var(--fg-secondary))]">
                {t("customers.summary", "خلاصه")}
              </span>
            </div>
            <span className="text-xs text-[hsl(var(--fg-tertiary))]">
              {totalCustomers} {t("customers.totalCustomers", "مشتری")}
            </span>
          </div>
        </div>

        {/* Main KPI — Debt */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-destructive)/0.1)]">
                <DollarSign className="size-5 text-[hsl(var(--color-destructive))]" />
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {t("customers.totalDebt", "کل بدهی")}
                </p>
                <p className="text-xl font-bold tabular-nums text-[hsl(var(--color-destructive))]">
                  {fmt(totalDebt)} {currency}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary KPIs — Compact Row */}
        <div className="flex border-t border-[hsl(var(--border-default))]">
          <div className="flex-1 px-4 py-3 text-center border-r border-[hsl(var(--border-default))]">
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t("customers.overdue", "عقب")}</p>
            <p className={cn("text-sm font-bold tabular-nums mt-0.5", overdueCount > 0 ? "text-[hsl(var(--color-warning))]" : "text-[hsl(var(--fg-primary))]")}>
              {overdueCount}
            </p>
          </div>
          <div className="flex-1 px-4 py-3 text-center border-r border-[hsl(var(--border-default))]">
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t("customers.vip", "VIP")}</p>
            <p className="text-sm font-bold tabular-nums text-yellow-500 mt-0.5">{vipCount}</p>
          </div>
          <div className="flex-1 px-4 py-3 text-center">
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t("customers.todaySales", "امروز")}</p>
            <p className="text-sm font-bold tabular-nums text-[hsl(var(--color-success))] mt-0.5">{fmt(todaySales)} {currency}</p>
          </div>
        </div>
      </div>
    )
  }

  // ═══ Tablet: Vertical Stack ═══
  return (
    <>
      <div className="flex flex-col gap-2 w-full lg:hidden">
        {[
          { id: 'debt', icon: DollarSign, color: "text-[hsl(var(--color-destructive))]", bg: "bg-[hsl(var(--color-destructive)/0.1)]", label: t("customers.totalDebt", "کل بدهی"), value: `${fmt(totalDebt)} ${currency}` },
          { id: 'total', icon: Users, color: "text-[hsl(var(--fg-primary))]", bg: "bg-[hsl(var(--surface-muted))]", label: t("customers.totalCustomers", "مشتری"), value: String(totalCustomers) },
          { id: 'overdue', icon: AlertTriangle, color: "text-[hsl(var(--color-warning))]", bg: "bg-[hsl(var(--color-warning)/0.1)]", label: t("customers.overdue", "عقب"), value: String(overdueCount) },
          { id: 'vip', icon: Star, color: "text-yellow-500", bg: "bg-yellow-500/10", label: t("customers.vip", "VIP"), value: String(vipCount) },
          { id: 'today', icon: TrendingUp, color: "text-[hsl(var(--color-success))]", bg: "bg-[hsl(var(--color-success)/0.1)]", label: t("customers.todaySales", "امروز"), value: `${fmt(todaySales)} ${currency}` },
        ].map(stat => (
          <div key={stat.id} className="flex items-center justify-between rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-4 py-3 w-full">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon className={`size-4 ${stat.color}`} />
              </div>
              <p className="text-sm font-medium text-[hsl(var(--fg-secondary))]">{stat.label}</p>
            </div>
            <p className="text-sm font-bold tabular-nums text-[hsl(var(--fg-primary))]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Desktop: Horizontal */}
      <div className="hidden lg:flex gap-3 w-full">
        {[
          { id: 'debt', icon: DollarSign, color: "text-[hsl(var(--color-destructive))]", bg: "bg-[hsl(var(--color-destructive)/0.1)]", label: t("customers.totalDebt", "کل بدهی"), value: `${fmt(totalDebt)} ${currency}` },
          { id: 'total', icon: Users, color: "text-[hsl(var(--fg-primary))]", bg: "bg-[hsl(var(--surface-muted))]", label: t("customers.totalCustomers", "مشتری"), value: String(totalCustomers) },
          { id: 'overdue', icon: AlertTriangle, color: "text-[hsl(var(--color-warning))]", bg: "bg-[hsl(var(--color-warning)/0.1)]", label: t("customers.overdue", "عقب"), value: String(overdueCount) },
          { id: 'vip', icon: Star, color: "text-yellow-500", bg: "bg-yellow-500/10", label: t("customers.vip", "VIP"), value: String(vipCount) },
          { id: 'today', icon: TrendingUp, color: "text-[hsl(var(--color-success))]", bg: "bg-[hsl(var(--color-success)/0.1)]", label: t("customers.todaySales", "امروز"), value: `${fmt(todaySales)} ${currency}` },
        ].map(stat => (
          <div key={stat.id} className="flex flex-1 items-center gap-4 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-6 py-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.bg}`}>
              <stat.icon className={`size-5 ${stat.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[hsl(var(--fg-tertiary))]">{stat.label}</p>
              <p className="text-lg font-bold tabular-nums text-[hsl(var(--fg-primary))]">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}