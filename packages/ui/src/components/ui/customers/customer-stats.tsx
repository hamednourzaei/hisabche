// packages/ui/src/components/ui/customers/customer-stats.tsx
"use client"

import { Users, DollarSign, Wallet, Trophy } from "lucide-react"
import { BentoStats, compactAmount, type BentoStat } from "../bento-stats"

interface CustomerStatsProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  totalCustomers: number
  totalSales: number
  totalDebt: number
  topCustomerName: string | null
  topCustomerAmount: number
  currency?: string
  /** درصد تغییر ماهانه */
  customersDelta?: number | null
  salesDelta?: number | null
  debtDelta?: number | null
  topCustomerDelta?: number | null
}

/** باکس KPI — موبایل: بنتو گرید نامتقارن ۲×۲ · دسکتاپ: چهار کارت */
export function customersStats({
  t,
  totalCustomers,
  totalSales,
  totalDebt,
  topCustomerName,
  topCustomerAmount,
  currency = "AFN",
  customersDelta = null,
  salesDelta = null,
  debtDelta = null,
  topCustomerDelta = null,
}: CustomerStatsProps) {
  const monthly = t("common.vsLastMonth", "نسبت به ماه قبل")

  const stats: BentoStat[] = [
    // مجموع فروش اول می‌آید: عدد اصلی کسب‌وکار است، نه شمارش مشتری‌ها.
    {
      id: "sales",
      icon: DollarSign,
      label: t("customers.totalSales", "مجموع فروش"),
      amount: totalSales,
      suffix: currency,
      delta: salesDelta,
      deltaLabel: monthly,
    },
    {
      id: "total",
      icon: Users,
      label: t("customers.totalCustomers", "تعداد مشتریان"),
      amount: totalCustomers,
      delta: customersDelta,
      deltaLabel: monthly,
    },
    {
      id: "debt",
      icon: Wallet,
      label: t("customers.totalDebt", "کل بدهی"),
      amount: totalDebt,
      suffix: currency,
      delta: debtDelta,
      deltaLabel: monthly,
      invertDelta: true,
    },
    {
      id: "top",
      icon: Trophy,
      label: t("customers.topCustomer", "پرخریدترین مشتری"),
      text: topCustomerName
        ? `${topCustomerName} · ${compactAmount(topCustomerAmount, t)} ${currency}`
        : "—",
      delta: topCustomerName ? topCustomerDelta : null,
      deltaLabel: monthly,
    },
  ]

  return <BentoStats t={t} stats={stats} />
}
