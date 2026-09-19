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
  /** Which stage the cursor is on — the headline follows it. */
  const [hovered, setHovered] = React.useState<string | null>(null)

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
   * ─── PRESENTATION: the «funnel chart card» layout (dashboardcn, MIT) ─────
   *
   * Adopted on the owner's instruction, with colours taken from this product's
   * tokens rather than the source palette. A tile per stage: its name, its
   * number, a bar whose width is its share of the first stage, and that share
   * as a percentage. Hovering a tile moves it into the headline.
   *
   * ⚠️ WHAT THE PERCENTAGE MEANS IS UNCHANGED, AND IT IS NOT A CONVERSION.
   *
   * The reasoning at the top of this file still governs: invoices and
   * customers share one scale and invoices-per-customer is a real ratio, so
   * they get a proportional bar. Revenue is afghanis — it has no width that
   * means anything beside a count — so it stays the OUTCOME tile beneath the
   * stages, with no bar and no percentage. A revenue bar sized against a
   * customer count would be a picture of nothing, whatever the layout.
   */
  const firstCount = bands[0]?.count ?? 0
  const share = (count: number) => (firstCount > 0 ? (count / firstCount) * 100 : 0)

  const stages = bands.map((band, index) => ({
    key: band.key,
    label: t(`dashboard.funnel.band.${band.key}`, band.key),
    count: band.count,
    percent: share(band.count),
    trend: band.trend,
    changePercent: band.changePercent,
    fade: index,
  }))

  const focused = stages.find((stage) => stage.key === hovered) ?? null

  return (
    <div className="flex flex-col gap-3" style={{ minHeight: height }}>
      {/*
        The headline. It shows the outcome by default and the stage under the
        cursor while one is hovered — so the big number always says what it is
        the number OF, rather than changing silently.
      */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-[hsl(var(--fg-tertiary))]">
            {focused ? focused.label : t('dashboard.totalSales', 'فروش کل')}
          </p>
          <p className="text-2xl font-bold tabular-nums text-[hsl(var(--fg-primary))]">
            {focused ? focused.count.toLocaleString('fa-AF') : fmt(shownTotal)}
          </p>
        </div>
        <TrendMark
          trend={focused ? focused.trend : revenue.trend}
          changePercent={focused ? focused.changePercent : revenue.changePercent}
        />
      </div>

      <ul className="flex flex-col gap-1.5" aria-label={t('dashboard.funnel.aria', 'قیف فروش')}>
        {stages.map((stage) => (
          <li key={stage.key}>
            <button
              type="button"
              onMouseEnter={() => setHovered(stage.key)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(stage.key)}
              onBlur={() => setHovered(null)}
              className={cn(
                'relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-start',
                'transition-colors duration-150 motion-reduce:transition-none',
                hovered === stage.key
                  ? 'border-[hsl(var(--color-primary)/0.45)] bg-[hsl(var(--surface-muted))]'
                  : 'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]',
              )}
            >
              {/*
                The bar is the tile's own background, not a separate element
                below the text: at 19% a bar on its own line is four pixels of
                colour nobody reads. Filling the tile makes the share legible
                at any width. It sits behind the text, so it never clips a
                number (§RTL: `inset-inline-start`, not `left`).
              */}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-y-0 start-0 transition-[width] duration-300 motion-reduce:transition-none',
                  stage.trend === 'unknown'
                    ? (FADE_TONE[stage.fade] ?? FADE_TONE[2])
                    : TREND_TONE[stage.trend],
                )}
                style={{ width: `${Math.max(2, Math.min(100, stage.percent))}%` }}
              />

              <span className="relative flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-medium text-[hsl(var(--fg-primary))]">
                  {stage.label}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-bold tabular-nums text-[hsl(var(--fg-primary))]">
                    {stage.count.toLocaleString('fa-AF')}
                  </span>
                  {/*
                    The first stage is always 100% of itself — true, and worth
                    showing, because it is what the others are measured
                    against.
                  */}
                  <span className="w-12 text-end text-[11px] tabular-nums text-[hsl(var(--fg-secondary))]">
                    {firstCount > 0 ? `${Math.round(stage.percent)}%` : '—'}
                  </span>
                  <TrendMark trend={stage.trend} changePercent={stage.changePercent} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/*
        ⚠️ THE OUTCOME, NOT A STAGE. Money has no width on a scale of counts,
        so it gets a row of its own with no bar and no percentage.
      */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-[hsl(var(--color-primary)/0.25)] bg-[hsl(var(--color-primary)/0.06)] px-3 py-2.5">
        <span className="text-xs font-medium text-[hsl(var(--fg-secondary))]">
          {t('dashboard.totalSales', 'فروش کل')}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-[hsl(var(--color-primary))]">
            {fmt(shownTotal)}
          </span>
          <TrendMark trend={revenue.trend} changePercent={revenue.changePercent} />
        </span>
      </div>

      {/*
        ⚠️ THE COMPARISON NAMES ITS OWN WINDOW.
        A coloured tile with no caption is a claim with no stated basis. The
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
function TrendMark({ trend, changePercent }: { trend: Trend; changePercent: number | null }) {
  if (trend === 'unknown') return null

  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium tabular-nums',
        TREND_TEXT[trend],
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
