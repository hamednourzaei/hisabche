// packages/ui/src/components/ui/customers/customer-stats.tsx
"use client"

import { Users, DollarSign, Wallet, Trophy } from "lucide-react"

interface CustomerStatsProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  totalCustomers: number
  totalSales: number
  totalDebt: number
  topCustomerName: string | null
  topCustomerAmount: number
  currency?: string
}

/** ردیف کارت‌های KPI — همیشه یک ردیف افقی، حتی در موبایل (اسکرول افقی در صورت نیاز) */
export function customersStats({
  t,
  fmt,
  totalCustomers,
  totalSales,
  totalDebt,
  topCustomerName,
  topCustomerAmount,
  currency = "AFN",
}: CustomerStatsProps) {
  const cards = [
    {
      id: "total",
      icon: Users,
      label: t("customers.totalCustomers", "تعداد مشتریان"),
      value: String(totalCustomers),
    },
    {
      id: "sales",
      icon: DollarSign,
      label: t("customers.totalSales", "مجموع فروش"),
      value: `${fmt(totalSales)} ${currency}`,
    },
    {
      id: "debt",
      icon: Wallet,
      label: t("customers.totalDebt", "کل بدهی"),
      value: `${fmt(totalDebt)} ${currency}`,
    },
    {
      id: "top",
      icon: Trophy,
      label: t("customers.topCustomer", "پرخریدترین مشتری"),
      value: topCustomerName
        ? `${topCustomerName} (${fmt(topCustomerAmount)} ${currency})`
        : "-",
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3 w-full overflow-x-auto">
      {cards.map((card) => (
        <div
          key={card.id}
          className="min-w-0 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-2.5 sm:p-4 space-y-1 sm:space-y-2"
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <card.icon className="size-3.5 sm:size-4 shrink-0 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            <span className="truncate text-[10px] sm:text-xs text-[hsl(var(--fg-secondary))]">
              {card.label}
            </span>
          </div>
          <p className="truncate text-sm sm:text-xl font-bold tabular-nums text-[hsl(var(--fg-primary))]">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  )
}
