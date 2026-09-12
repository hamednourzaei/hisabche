'use client'

// ============================================
// packages/ui/src/components/ui/dashboard/sales-funnel.tsx
//
// The chart's own numbers, shown as a funnel.
//
// ---------------------------------------------------------------------------
// ⚠️ IT READS `salesChartData` — THE SAME ARRAY THE CHART DRAWS
//
// The first attempt fetched a CRM pipeline from `/api/crm/funnel`. That was a
// misreading of the request: it answered «what stage are my opportunities in»,
// which is a different question, and it cost the dashboard a separate request
// measured at 1525ms in the production log — for data the page already had in
// memory. Every point of `salesChartData` already carries `value`,
// `invoiceCount` and `customerCount`.
//
// ---------------------------------------------------------------------------
// ⚠️ THESE ARE NOT STAGES OF A FUNNEL, AND THE SHAPE MUST NOT CLAIM THEY ARE
//
// Invoices and customers are counts; total sales is money. «38 invoices» is
// not a subset of «24 customers» the way `qualified` is a subset of `lead`.
// So only the two COUNTS get proportional bands — they are genuinely
// comparable, and invoices-per-customer is a real ratio. The revenue sits
// beneath the cone as the outcome, not as a third band: a band whose width
// came from afghanis, next to bands whose width came from counts, would be a
// picture of nothing.
//
// ---------------------------------------------------------------------------
// ⚠️ GREEN AND RED ONLY WHEN THERE IS SOMETHING TO COMPARE
//
// Each band is tinted by its own trend — the recent half of the window against
// the half before it. With no earlier half (a window too short, or a shop in
// its first week) there IS no comparison, and the band stays neutral. A green
// band by default would tell someone their business is growing on the
// strength of no evidence.
//
// «More is better» holds for these three. It is NOT a general rule: more
// customer debt and more expenses are worse, and a band for either must
// invert. That is why the direction is decided per metric here rather than
// from the sign of the delta.
// ============================================

import * as React from 'react'

import { AlertCircle, Minus, TrendingDown, TrendingUp } from 'lucide-react'

import { cn } from '../../../lib/utils'

export interface FunnelPoint {
  value: number
  invoiceCount?: number | undefined
  customerCount?: number | undefined
}

type Trend = 'up' | 'down' | 'flat' | 'unknown'

interface Band {
  key: 'invoices' | 'customers'
  count: number
  trend: Trend
  changePercent: number | null
}

/**
 * Compare the two halves of the window.
 *
 * ⚠️ `changePercent: null` IS NOT ZERO. Zero reads as «measured, no change»;
 * null means the question cannot be answered — which is the honest result of
 * growth from a base of nothing, where the direction is real but «∞%» is not
 * a number anyone can act on.
 */
function compare(
  previous: number,
  current: number,
): {
  trend: Trend
  changePercent: number | null
} {
  if (previous === 0) {
    if (current === 0) return { trend: 'unknown', changePercent: null }
    return { trend: 'up', changePercent: null }
  }

  const rounded = Math.round(((current - previous) / previous) * 1000) / 10

  if (Math.abs(rounded) < 0.05) return { trend: 'flat', changePercent: 0 }
  return { trend: rounded > 0 ? 'up' : 'down', changePercent: rounded }
}

/**
 * More invoices, more customers, more revenue — better, for all three.
 *
 * ⚠️ NOT A GENERAL RULE. Customer debt and expenses invert: rising is worse.
 * Any band added for those must map its own direction rather than reuse this.
 */
const TREND_TONE: Record<Trend, string> = {
  up: 'bg-[hsl(var(--color-success)/0.85)]',
  down: 'bg-[hsl(var(--color-destructive)/0.75)]',
  flat: 'bg-[hsl(var(--color-info)/0.7)]',
  unknown: 'bg-[hsl(var(--surface-muted))]',
}

const TREND_TEXT: Record<Trend, string> = {
  up: 'text-[hsl(var(--color-success))]',
  down: 'text-[hsl(var(--color-destructive))]',
  flat: 'text-[hsl(var(--fg-tertiary))]',
  unknown: 'text-[hsl(var(--fg-tertiary))]',
}

const MIN_WIDTH_PERCENT = 22

export function SalesFunnel({
  data,
  total,
  fmt,
  isLoading,
  isError,
  height = 180,
  t,
}: {
  /** The chart's own points. No second request. */
  data: FunnelPoint[]
  /** Revenue for the window, in the same units the KPI cards use. */
  total: number
  fmt: (value: number) => string
  isLoading?: boolean | undefined
  isError?: boolean | undefined
  height?: number | undefined
  t: (key: string, fallback?: string) => string
}) {
  const { bands, revenue } = React.useMemo(() => {
    // ⚠️ A type annotation is not a runtime check. This exact shape has taken
    // down two production screens in this codebase.
    const points = Array.isArray(data) ? data : []

    // With an odd number of points the extra one belongs to the RECENT half —
    // newer information is the side the question is about.
    const split = Math.floor(points.length / 2)
    const earlier = points.slice(0, split)
    const recent = points.slice(split)

    const sum = (rows: FunnelPoint[], pick: (p: FunnelPoint) => number) =>
      rows.reduce((acc, p) => acc + (Number(pick(p)) || 0), 0)

    const invoicesNow = sum(recent, (p) => p.invoiceCount ?? 0)
    const invoicesBefore = sum(earlier, (p) => p.invoiceCount ?? 0)
    const customersNow = sum(recent, (p) => p.customerCount ?? 0)
    const customersBefore = sum(earlier, (p) => p.customerCount ?? 0)
    const revenueNow = sum(recent, (p) => p.value)
    const revenueBefore = sum(earlier, (p) => p.value)

    // No earlier half at all — nothing to compare, for any of them.
    const comparable = earlier.length > 0
    const noTrend = { trend: 'unknown' as Trend, changePercent: null }

    const nextBands: Band[] = [
      {
        key: 'invoices',
        count: invoicesNow + invoicesBefore,
        ...(comparable ? compare(invoicesBefore, invoicesNow) : noTrend),
      },
      {
        key: 'customers',
        count: customersNow + customersBefore,
        ...(comparable ? compare(customersBefore, customersNow) : noTrend),
      },
    ]

    return {
      bands: nextBands,
      revenue: comparable ? compare(revenueBefore, revenueNow) : noTrend,
    }
  }, [data])

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl bg-[hsl(var(--surface-muted)/0.4)]"
        style={{ height }}
      >
        <span className="text-sm text-[hsl(var(--fg-tertiary))]">
          {t('common.loading', 'در حال بارگذاری…')}
        </span>
      </div>
    )
  }

  // ⚠️ An error is not an empty period. A flat funnel here would tell the shop
  // it sold nothing — a claim about their business made out of a failed
  // request.
  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[hsl(var(--color-destructive)/0.06)] p-6 text-center"
        style={{ height }}
      >
        <AlertCircle className="size-5 text-[hsl(var(--color-destructive))]" aria-hidden="true" />
        <p className="text-sm text-[hsl(var(--color-destructive))]">
          {t('dashboard.funnel.error', 'اطلاعات قیف فروش گرفته نشد.')}
        </p>
      </div>
    )
  }

  const widest = Math.max(...bands.map((b) => b.count), 0)

  if (widest === 0 && total === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[hsl(var(--surface-muted)/0.4)] p-6 text-center"
        style={{ height }}
      >
        {/* «In this period» — the same correction the chart's own empty state
            carries. The data behind it is one window, so it cannot say
            anything about the shop's whole history. */}
        <p className="text-sm font-medium text-[hsl(var(--fg-secondary))]">
          {t('dashboard.noSalesInPeriod', 'در این بازه فروشی ثبت نشده است')}
        </p>
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t('dashboard.tryWiderRange', 'بازه‌ی دیگری را امتحان کنید، یا فروشی ثبت کنید')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3" style={{ minHeight: height }}>
      <ul className="flex flex-col gap-2" aria-label={t('dashboard.funnel.aria', 'قیف فروش')}>
        {bands.map((band) => {
          const width = Math.max(
            MIN_WIDTH_PERCENT,
            widest > 0 ? Math.round((band.count / widest) * 100) : MIN_WIDTH_PERCENT,
          )

          return (
            <li key={band.key} className="flex items-center gap-3">
              <span className="w-20 shrink-0 truncate text-xs text-[hsl(var(--fg-secondary))]">
                {t(`dashboard.funnel.band.${band.key}`, band.key)}
              </span>

              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'flex h-9 items-center justify-between gap-2 rounded-lg px-3',
                    'transition-[width] duration-300 motion-reduce:transition-none',
                    TREND_TONE[band.trend],
                  )}
                  style={{ width: `${width}%` }}
                >
                  <span className="text-sm font-semibold tabular-nums text-white">
                    {band.count}
                  </span>
                  <TrendMark trend={band.trend} changePercent={band.changePercent} onBand />
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {/* ⚠️ THE OUTCOME, NOT A BAND. Money has no width that means anything
          beside two counts — see the note at the top of this file. */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[hsl(var(--border-default))] pt-2.5">
        <span className="text-xs text-[hsl(var(--fg-secondary))]">
          {t('dashboard.totalSales', 'فروش کل')}
        </span>
        <span className="flex items-center gap-2">
          <span className={cn('text-base font-bold tabular-nums', TREND_TEXT[revenue.trend])}>
            {fmt(total)}
          </span>
          <TrendMark trend={revenue.trend} changePercent={revenue.changePercent} />
        </span>
      </div>
    </div>
  )
}

/**
 * The arrow and the percentage.
 *
 * ⚠️ RENDERS NOTHING FOR `unknown`. A grey dash where a trend belongs invites
 * the reader to treat it as «no change»; absent is the honest rendering of a
 * question that has no answer yet.
 */
function TrendMark({
  trend,
  changePercent,
  onBand = false,
}: {
  trend: Trend
  changePercent: number | null
  onBand?: boolean
}) {
  if (trend === 'unknown') return null

  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium tabular-nums',
        onBand ? 'text-white/90' : TREND_TEXT[trend],
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {/* A percentage only when one could be computed. Growth from zero has a
          direction but no meaningful ratio. */}
      {changePercent !== null ? <span>{Math.abs(changePercent)}%</span> : null}
    </span>
  )
}

export default SalesFunnel
