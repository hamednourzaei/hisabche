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

/**
 * Brand colour, fading stage by stage — used only when a stage has no trend
 * to report. Neutral shape, not a verdict.
 */
const FADE_TONE: Record<number, string> = {
  0: 'bg-[hsl(var(--color-primary)/0.9)]',
  1: 'bg-[hsl(var(--color-primary)/0.7)]',
  2: 'bg-[hsl(var(--color-primary)/0.5)]',
}

const MIN_WIDTH_PERCENT = 30

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
  const { bands, revenue, revenueTotal, windowDays } = React.useMemo(() => {
    // ⚠️ A type annotation is not a runtime check. This exact shape has taken
    // down two production screens in this codebase.
    const points = Array.isArray(data) ? data : []

    // ⚠️ TWO WINDOWS OF THE SAME LENGTH, BOTH TAKEN FROM THE END.
    //
    // An earlier version split the range down the middle, which on an odd
    // number of days compared 4 days against 3 and still captioned it «vs the
    // previous days» — a 33% head start handed to the recent half, reported as
    // growth. The last N days are now compared against the N before them, and
    // any leftover oldest point is excluded from the COMPARISON while still
    // counting toward the totals shown.
    const split = Math.floor(points.length / 2)
    const recent = split > 0 ? points.slice(-split) : []
    const earlier = split > 0 ? points.slice(-2 * split, -split) : []

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

    // ⚠️ TOTALS COVER EVERY POINT; ONLY THE TREND USES THE TWO WINDOWS.
    // The counts were `now + before`, i.e. only the 2×⌊n/2⌋ newest points: on
    // an odd-length range the oldest day vanished from the total, and with a
    // single point (all sales on one day) BOTH windows were empty — the funnel
    // said «فاکتورها 0 · مشتریان 0» beside a chart showing those very sales.
    const invoicesAll = sum(points, (p) => p.invoiceCount ?? 0)
    const customersAll = sum(points, (p) => p.customerCount ?? 0)
    const revenueAll = sum(points, (p) => p.value)

    const nextBands: Band[] = [
      {
        key: 'invoices',
        count: invoicesAll,
        ...(comparable ? compare(invoicesBefore, invoicesNow) : noTrend),
      },
      {
        key: 'customers',
        count: customersAll,
        ...(comparable ? compare(customersBefore, customersNow) : noTrend),
      },
    ]

    return {
      bands: nextBands,
      revenue: comparable ? compare(revenueBefore, revenueNow) : noTrend,
      revenueTotal: revenueAll,
      windowDays: split,
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

  // The chart's own revenue: the funnel describes what the chart draws. The
  // KPI `total` is only a fallback for a window the chart has no points for.
  const shownTotal = revenueTotal > 0 ? revenueTotal : total

  if (widest === 0 && shownTotal === 0) {
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

  /*
   * ⚠️ ONE CONTINUOUS SHAPE, STACKED WITH NO GAPS.
   *
   * The previous version drew separate rows with a gap between them and a
   * label pill beside each, which ate half the width — so it read as a list of
   * bars, not a funnel. This follows the «flow / sharp» funnel pattern turned
   * vertical: every segment's TOP edge is its own share of the first stage and
   * its BOTTOM edge is the next segment's top, so the outline is one unbroken
   * taper from the widest stage to the tip.
   *
   * ⚠️ THE TIP CARRIES MONEY BUT ITS WIDTH IS NOT MONEY. Invoices and customers
   * are counts and share one scale; total sales is afghanis and has no width
   * that means anything beside them. The tip is therefore a fixed closing
   * segment — it shows the outcome, and its size claims nothing.
   */
  const firstCount = bands[0]?.count ?? 0
  const share = (count: number) =>
    firstCount > 0
      ? Math.max(MIN_WIDTH_PERCENT, Math.round((count / firstCount) * 100))
      : MIN_WIDTH_PERCENT

  const tops = [...bands.map((band) => share(band.count))]
  const tipTop = Math.max(MIN_WIDTH_PERCENT - 4, Math.round((tops[tops.length - 1] ?? 100) * 0.6))
  const tipBottom = Math.max(10, Math.round(tipTop * 0.55))

  const segments: Array<{
    key: string
    label: string
    value: string
    trend: Trend
    changePercent: number | null
    top: number
    bottom: number
    fade: number
  }> = [
    ...bands.map((band, index) => ({
      key: band.key,
      label: t(`dashboard.funnel.band.${band.key}`, band.key),
      value: String(band.count),
      trend: band.trend,
      changePercent: band.changePercent,
      top: tops[index] ?? 100,
      bottom: index + 1 < tops.length ? (tops[index + 1] ?? tipTop) : tipTop,
      fade: index,
    })),
    {
      key: 'sales',
      label: t('dashboard.totalSales', 'فروش کل'),
      value: fmt(shownTotal),
      trend: revenue.trend,
      changePercent: revenue.changePercent,
      top: tipTop,
      bottom: tipBottom,
      fade: bands.length,
    },
  ]

  /** polygon() insets for a centred trapezoid, independent of pixel width. */
  const clipFor = (top: number, bottom: number) => {
    const topInset = (100 - top) / 2
    const bottomInset = (100 - bottom) / 2
    return `polygon(${topInset}% 0, ${100 - topInset}% 0, ${100 - bottomInset}% 100%, ${bottomInset}% 100%)`
  }

  return (
    <div className="flex flex-col gap-2" style={{ minHeight: height }}>
      <ul className="flex flex-col" aria-label={t('dashboard.funnel.aria', 'قیف فروش')}>
        {segments.map((segment) => (
          <li key={segment.key} className="group relative h-16">
            {/* The segment. Unknown trend falls back to the brand colour,
                fading stage by stage — a neutral shape, not a verdict. */}
            <div
              aria-hidden="true"
              className={cn(
                'absolute inset-0 transition-[filter] duration-150 motion-reduce:transition-none',
                'group-hover:brightness-110',
                segment.trend === 'unknown'
                  ? (FADE_TONE[segment.fade] ?? FADE_TONE[2])
                  : TREND_TONE[segment.trend],
              )}
              style={{ clipPath: clipFor(segment.top, segment.bottom) }}
            />

            {/* Text sits on a full-width row over the shape, so a narrow
                segment near the tip never truncates its own number. */}
            <div className="relative flex h-full items-center justify-between gap-2 px-1">
              <span className="min-w-0 truncate text-xs font-medium text-[hsl(var(--fg-secondary))]">
                {segment.label}
              </span>
              <span className="absolute inset-x-0 text-center text-base font-bold tabular-nums text-white drop-shadow">
                {segment.value}
              </span>
              <span className="relative shrink-0">
                <TrendMark trend={segment.trend} changePercent={segment.changePercent} />
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/*
        ⚠️ THE COMPARISON NAMES ITS OWN WINDOW.
        A coloured segment with no caption is a claim with no stated basis. The
        window follows the range picker above, so this changes with it.
      */}
      {windowDays > 0 ? (
        <p className="text-center text-[11px] text-[hsl(var(--fg-tertiary))]">
          {t('dashboard.funnel.comparedTo', 'نسبت به')}{' '}
          <span className="tabular-nums">{windowDays}</span>{' '}
          {t('dashboard.funnel.daysBefore', 'روز پیش از آن')}
        </p>
      ) : null}
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
