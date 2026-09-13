// packages/ui/src/components/ui/customers/customer-stats.tsx
'use client'

import { Users, DollarSign, Wallet, Trophy } from 'lucide-react'
import { BentoStats, compactAmount, type BentoStat } from '../bento-stats'
import type { CustomersStatsCoverage } from '../../../hooks/customers/use-customers-data'

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
  /** What the figures were reduced from. When partial, the cards say so. */
  coverage?: CustomersStatsCoverage | undefined
}

/** باکس KPI — موبایل: بنتو گرید نامتقارن ۲×۲ · دسکتاپ: چهار کارت */
export function customersStats({
  t,
  totalCustomers,
  totalSales,
  totalDebt,
  topCustomerName,
  topCustomerAmount,
  currency = 'AFN',
  customersDelta = null,
  salesDelta = null,
  debtDelta = null,
  topCustomerDelta = null,
  coverage,
  fmt,
}: CustomerStatsProps) {
  const monthly = t('common.vsLastMonth', 'نسبت به ماه قبل')

  const stats: BentoStat[] = [
    // مجموع فروش اول می‌آید: عدد اصلی کسب‌وکار است، نه شمارش مشتری‌ها.
    {
      id: 'sales',
      icon: DollarSign,
      label: t('customers.totalSales', 'مجموع فروش'),
      amount: totalSales,
      suffix: currency,
      delta: salesDelta,
      deltaLabel: monthly,
    },
    {
      id: 'total',
      icon: Users,
      label: t('customers.totalCustomers', 'تعداد مشتریان'),
      amount: totalCustomers,
      delta: customersDelta,
      deltaLabel: monthly,
    },
    {
      id: 'debt',
      icon: Wallet,
      label: t('customers.totalDebt', 'کل بدهی'),
      amount: totalDebt,
      suffix: currency,
      delta: debtDelta,
      deltaLabel: monthly,
      invertDelta: true,
    },
    {
      id: 'top',
      icon: Trophy,
      label: t('customers.topCustomer', 'پرخریدترین مشتری'),
      text: topCustomerName
        ? `${topCustomerName} · ${compactAmount(topCustomerAmount, t)} ${currency}`
        : '—',
      delta: topCustomerName ? topCustomerDelta : null,
      deltaLabel: monthly,
    },
  ]

  if (!coverage?.isPartial) return <BentoStats t={t} stats={stats} />

  // ⚠️ These figures come from the latest page of invoices and customers, not
  // the whole book. Said where the numbers are read, not left as an absence.
  return (
    <div className="space-y-2">
      <BentoStats t={t} stats={stats} />
      <p role="note" className="text-xs text-[hsl(var(--fg-tertiary))] text-start">
        {/* No ICU placeholders: this `t` wrapper passes no values, and a
            message with `{…}` would fail to format and fall back. */}
        {t(
          'customers.statsCoverage',
          'این ارقام از آخرین فاکتورها و مشتریان دریافت‌شده است، نه کل دفتر',
        )}
        {' ('}
        {t('customers.statsCoverageInvoices', 'فاکتور')} {fmt(coverage.invoiceRows)}
        {' · '}
        {t('customers.statsCoverageCustomers', 'مشتری')} {fmt(coverage.customerRows)}
        {')'}
      </p>
    </div>
  )
}
