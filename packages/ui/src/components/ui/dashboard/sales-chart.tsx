// packages/ui/src/components/ui/dashboard/sales-chart.tsx
'use client'

import { headlineFontClass, statFontClass } from '../kpi-card'
import { memo, useMemo, useId } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '../../../lib/utils'
import dynamic from 'next/dynamic'
import { ArrowUp, ArrowDown, FileText } from 'lucide-react'
import {
  useMediaQuery,
  useIsMobile,
  useIsReducedMotion,
} from '../../../hooks/dashboard/use-media-query'

// Types
export interface ChartDataPoint {
  label: string
  value: number
  date: string
  invoiceCount?: number
  customerCount?: number
}

interface SalesChartProps {
  data: ChartDataPoint[]
  isLoading: boolean
  fmt: (v: number) => string
  height?: number
  previousPeriodTotal?: number
  currentPeriodTotal?: number
  onViewFullReport?: () => void
}

// Lazy-load Recharts (بدون suspense)
const DynamicAreaChart = dynamic(() => import('./sales-chart-internal'), {
  ssr: false,
  loading: () => <ChartSkeleton height={200} />,
})

// ============= Skeleton =============
const ChartSkeleton = memo(function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="w-full rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse"
      style={{ height }}
      aria-hidden="true"
    />
  )
})
ChartSkeleton.displayName = 'ChartSkeleton'

// ============= Main Component =============
export const SalesChart = memo(function SalesChart({
  data,
  isLoading,
  fmt,
  height = 200,
  previousPeriodTotal = 0,
  currentPeriodTotal = 0,
  onViewFullReport,
}: SalesChartProps) {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string) => {
    try {
      const v = tOriginal(key as Parameters<typeof tOriginal>[0])
      return v && v !== key ? v : (fallback ?? key)
    } catch (err) {
      console.error('[DEBUG dashboard] t() threw for key:', key, err)
      return fallback ?? key
    }
  }
  const tCount = (key: string, values: Record<string, unknown>, fallback?: string) => {
    try {
      return tOriginal(key as Parameters<typeof tOriginal>[0], values as never)
    } catch (err) {
      console.error('[DEBUG dashboard] tOriginal() threw for key:', key, err)
      return fallback ?? key
    }
  }
  const descriptionId = useId()
  const isMobile = useIsMobile()
  const isReducedMotion = useIsReducedMotion()
  // ⚠️ ONE SERIES. The «فاکتورها» and «مشتریان» lines and their checkboxes were
  // removed on the owner's instruction — three lines on one pair of axes, two
  // of them counts and one money, made the card unreadable. The counts are
  // still shown, as stages, in the conversion funnel beside it; nothing was
  // removed from there.

  /**
   * The «balance chart card» supporting stats (dashboardcn, MIT), adopted on
   * the owner's instruction with this product's own tokens.
   *
   * ⚠️ HIGH / LOW / AVERAGE ARE OF THE DRAWN WINDOW, and each says so in its
   * label. A bare «بیشترین» beside a headline invites the reader to take it
   * for an all-time record.
   *
   * ⚠️ `null` WHEN THERE IS NOTHING TO MEASURE. Zeroes here would read as
   * «your best day was zero» — a statement about the business made out of an
   * empty array.
   */
  const stats = useMemo(() => {
    const points = (data ?? []).map((d) => Number(d.value) || 0)
    if (points.length === 0) return null

    const total = points.reduce((sum, value) => sum + value, 0)
    return {
      high: Math.max(...points),
      low: Math.min(...points),
      average: Math.round(total / points.length),
    }
  }, [data])

  // Calculate insights with safe percentage
  const { percentageChange, isPositive, allZero, hasData } = useMemo(() => {
    const hasData = data && data.length > 0
    const allZero =
      hasData && data.every((d) => d.value === 0 || d.value === null || d.value === undefined)

    let percentageChange = 0
    let isPositive = false

    if (previousPeriodTotal > 0) {
      percentageChange = ((currentPeriodTotal - previousPeriodTotal) / previousPeriodTotal) * 100
      isPositive = percentageChange >= 0
    }

    percentageChange = Number.isFinite(percentageChange) ? percentageChange : 0

    return { percentageChange, isPositive, allZero, hasData }
  }, [data, currentPeriodTotal, previousPeriodTotal])

  // Loading state
  if (isLoading) {
    return <ChartSkeleton height={height} />
  }

  // Determine animation duration based on device and preference
  const animationDuration = isMobile ? 0 : isReducedMotion ? 0 : 200

  // ✅ اصلاح: استفاده از کلیدهای ترجمه‌ی صحیح
  const ariaLabel = t('dashboard.salesChart.ariaLabel')
  // ✅ FIX: این wrapper فقط رشته برمی‌گرداند و مقادیر ICU را جای‌گذاری نمی‌کند،
  // برای همین «{total}» و «{change}» عیناً نمایش داده می‌شدند.
  const description = t('dashboard.salesChart.description')
    .replace('{total}', fmt(currentPeriodTotal))
    .replace(
      '{change}',
      previousPeriodTotal > 0
        ? `${percentageChange >= 0 ? '+' : ''}${percentageChange.toFixed(1)}٪`
        : '—',
    )

  return (
    <section
      className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
      aria-label={ariaLabel}
    >
      {/* Hidden description for screen readers */}
      <div id={descriptionId} className="sr-only">
        {description}
      </div>

      <div className="flex flex-col gap-3">
        {/* Header: Context + Hero Metric */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-[hsl(var(--fg-secondary))]">
            {t('dashboard.todaySales')}
          </h3>
          <button
            type="button"
            onClick={onViewFullReport}
            className="text-xs text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] rounded-md px-2 py-1"
          >
            {t('dashboard.viewReport')} →
          </button>
        </div>

        {/* Hero Metric + Comparison */}
        <div className="flex items-baseline gap-3">
          {/* ⚠️ The same automatic sizing the KPI cards use. A fixed
              `text-3xl` overflowed the card the moment the shop's numbers grew
              a digit — and a nine-figure sum is not an edge case here. */}
          <span
            className={cn(
              'font-bold tabular-nums tracking-tight text-[hsl(var(--fg-primary))]',
              headlineFontClass(fmt(currentPeriodTotal)),
            )}
          >
            {fmt(currentPeriodTotal)}
          </span>
          {previousPeriodTotal > 0 && (
            <span
              className={cn(
                'flex items-center gap-1 text-sm font-medium',
                isPositive
                  ? 'text-[hsl(var(--color-success))]'
                  : 'text-[hsl(var(--color-destructive))]',
              )}
            >
              {isPositive ? (
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              )}
              {Math.abs(percentageChange).toFixed(1)}%
              <span className="text-xs text-[hsl(var(--fg-tertiary))] font-normal">
                {t('dashboard.vsYesterday')}
              </span>
            </span>
          )}
        </div>

        {/*
          Supporting stats — the row the card design puts under the headline.
          Rendered only when the window has points to describe.
        */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2">
            {(
              [
                [
                  'dashboard.chartHigh',
                  'بیشترین در این بازه',
                  stats.high,
                  'text-[hsl(var(--color-success))]',
                ],
                [
                  'dashboard.chartLow',
                  'کمترین در این بازه',
                  stats.low,
                  'text-[hsl(var(--fg-secondary))]',
                ],
                [
                  'dashboard.chartAverage',
                  'میانگین این بازه',
                  stats.average,
                  'text-[hsl(var(--fg-primary))]',
                ],
              ] as [string, string, number, string][]
            ).map(([key, fallback, value, tone]) => (
              <div key={key} className="min-w-0">
                <p className="truncate text-[11px] text-[hsl(var(--fg-tertiary))]">
                  {t(key, fallback)}
                </p>
                <p
                  className={cn(
                    'truncate font-semibold tabular-nums',
                    statFontClass(fmt(value)),
                    tone,
                  )}
                >
                  {fmt(value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Chart with motion */}
        <div className="relative">
          <DynamicAreaChart
            data={data}
            fmt={fmt}
            height={height}
            animationDuration={animationDuration}
          />
        </div>

        {/* The window the numbers cover, and what the one line is. */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[hsl(var(--fg-tertiary))] pt-1 border-t border-[hsl(var(--border-default)/0.5)]">
          <span>
            {tCount(
              'dashboard.dataRange',
              { count: data?.length ?? 0 },
              `Last ${data?.length ?? 0} periods`,
            )}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[hsl(var(--color-primary))]" />
            {t('dashboard.salesTrend')}
          </span>
        </div>
      </div>
    </section>
  )
})

SalesChart.displayName = 'SalesChart'
