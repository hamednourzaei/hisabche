// packages/ui/src/components/ui/dashboard/dashboard-view.tsx
'use client'

import { memo, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { invoiceListHref } from '../../../lib/invoices/invoice-filter-link'
import { cn } from '../../../lib/utils'
import {
  Sparkles,
  TrendingUp,
  Wallet,
  CreditCard,
  Boxes,
  Activity as ActivityIcon,
} from 'lucide-react'
import { SalesChart, type ChartDataPoint } from './sales-chart'
import { DateRangePicker, type DateRange, type PresetKey } from './date-range-picker'
import type { AIInsight } from '@hisabche/api'
import type { ActivityGroupDto } from '@hisabche/api'
import dynamic from 'next/dynamic'

// ─── Types ────────────────────────────────────────────────────────────────

type Translate = (key: string, fallback?: string) => string

interface DashboardViewProps {
  t: Translate
  fmt: (v: number) => string

  // KPI Data
  totalSales: number
  todaySales: number
  customerDebt: number
  warehouseValue: number
  monthlyGrowth?: number | null | undefined

  // Loading States
  kpiLoading: boolean
  insightsLoading: boolean
  chartLoading: boolean
  activitiesLoading: boolean

  // AI Insights
  insights: AIInsight[]

  // Chart Data
  salesChartData: ChartDataPoint[]
  dateRange: DateRange

  // Activities
  recentActivities: ActivityGroupDto[]

  // Actions
  onNavigate: (route: string) => void
  onInsightAction: (action: string) => void
  onDateRangeChange: (range: DateRange, preset: PresetKey) => void
}

// ─── Lazy Load Components ─────────────────────────────────────────────────

const LazySalesChart = dynamic(() => import('./sales-chart').then((mod) => mod.SalesChart), {
  ssr: false,
  loading: () => (
    <div className="h-[180px] sm:h-[200px] rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
  ),
})

// ─── Greeting ──────────────────────────────────────────────────────────────

const Greeting = memo(function Greeting({ t }: { t: Translate }) {
  const h = new Date().getHours()
  const k = h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'
  const label =
    k === 'morning'
      ? 'صبح بخیر'
      : k === 'afternoon'
        ? 'ظهر بخیر'
        : k === 'evening'
          ? 'عصر بخیر'
          : 'شب بخیر'

  return (
    <header className="space-y-1 sm:space-y-1.5">
      <h1 className="flex items-center gap-1.5 sm:gap-2 text-xl sm:text-2xl md:text-3xl font-bold text-[hsl(var(--fg-primary))]">
        {t(`dashboard.greeting.${k}`, label)}
        <Sparkles
          className="size-4 sm:size-5 text-[hsl(var(--color-primary))]"
          aria-hidden="true"
        />
      </h1>
      <p className="text-xs sm:text-sm text-[hsl(var(--fg-secondary))]">
        {t('dashboard.subtitle')}
      </p>
    </header>
  )
})
Greeting.displayName = 'Greeting'

// ─── KPI Card ──────────────────────────────────────────────────────────────

const KpiCard = memo(function KpiCard({
  icon: Icon,
  label,
  value,
  change,
  changeLabel,
  isLoading,
  onOpen,
  openLabel,
}: {
  icon: typeof TrendingUp
  label: string
  value: string
  // ✅ اسپارک‌لاین حذف شد: برای «بدهی مشتریان» و «ارزش انبار» هیچ سری
  // زمانی وجود نداشت و فقط یک خط‌چین خنثی رسم می‌شد. حالا به‌جایش درصد
  // تغییر واقعی نمایش داده می‌شود (null یعنی داده‌ی مقایسه‌ای نداریم).
  change: number | null
  changeLabel?: string | undefined
  isLoading: boolean
  /**
   * H1 — where this number lives.
   *
   * Optional, and a card without one stays a plain `<div>`. «ارزش کل انبار»
   * has a destination; a card whose figure has no list behind it must not
   * pretend to, because a control that looks pressable and does nothing reads
   * as a broken app rather than as a card with no drill-down.
   */
  onOpen?: (() => void) | undefined
  /** What the drill-down shows, for a screen reader and the tooltip. */
  openLabel?: string | undefined
}) {
  if (isLoading) {
    return <div className="h-[104px] rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
  }
  const positive = (change ?? 0) >= 0

  // A real <button> when it acts like one: keyboard focus, Enter and Space,
  // and an accessible name — none of which an onClick on a div provides.
  const Tag = onOpen ? 'button' : 'div'

  return (
    <Tag
      {...(onOpen
        ? {
            type: 'button' as const,
            onClick: onOpen,
            title: openLabel ?? label,
            'aria-label': openLabel ? `${label} — ${openLabel}` : label,
          }
        : {})}
      className={cn(
        'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 space-y-2',
        // RTL-safe: `text-start`, never `text-left`. A button element
        // centre-aligns its content by default, which would silently
        // re-align every figure the moment a card became clickable.
        onOpen &&
          'w-full text-start cursor-pointer transition-colors hover:border-[hsl(var(--color-primary)/0.5)] hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <span className="text-xs text-[hsl(var(--fg-secondary))]">{label}</span>
      </div>
      {/* ✅ عدد هرگز خلاصه یا گرد نمی‌شود؛ به‌جایش با بلندتر شدن رقم‌ها،
          اندازه‌ی فونت کم می‌شود تا نه از کارت بیرون بزند و نه به خط بعد برود. */}
      <p
        className={cn(
          'font-bold tabular-nums text-[hsl(var(--fg-primary))] whitespace-nowrap overflow-hidden',
          value.length <= 9
            ? 'text-xl'
            : value.length <= 12
              ? 'text-lg'
              : value.length <= 15
                ? 'text-base'
                : 'text-sm',
        )}
        title={value}
      >
        {value}
      </p>
      {change === null ? (
        <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">—</p>
      ) : (
        <p
          className={cn(
            'flex items-center gap-1 text-[11px] tabular-nums',
            positive ? 'text-[hsl(var(--color-success))]' : 'text-[hsl(var(--color-destructive))]',
          )}
        >
          {positive ? '▲' : '▼'} {Math.abs(change).toFixed(1)}٪
          {changeLabel ? (
            <span className="text-[hsl(var(--fg-tertiary))]">{changeLabel}</span>
          ) : null}
        </p>
      )}
    </Tag>
  )
})
KpiCard.displayName = 'KpiCard'

// ─── AI Insights (عمودی) ────────────────────────────────────────────────────

const AIInsightsPanel = memo(function AIInsightsPanel({
  insights,
  isLoading,
  onAction,
}: {
  insights: AIInsight[]
  isLoading: boolean
  onAction: (action: string) => void
}) {
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

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
      <div className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 pt-4 sm:pt-5 pb-2 sm:pb-3">
        <Sparkles
          className="size-4 sm:size-5 text-[hsl(var(--color-primary))]"
          aria-hidden="true"
        />
        <h2 className="text-sm sm:text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t('dashboard.aiInsights', 'پیشنهادهای هوشمند')}
        </h2>
      </div>
      {/* دو کارت در هر ردیف، در همه‌ی اندازه‌ها — `grid-cols-2` بدون breakpoint.
          کارت‌ها `h-full` می‌گیرند تا در هر ردیف هم‌ارتفاع بمانند، وگرنه یک
          پیشنهاد با توضیح بلندتر ردیف را ناهموار می‌کند. */}
      <div className="px-4 sm:px-6 pb-4 sm:pb-5">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="h-16 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />
            <div className="h-16 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />
          </div>
        ) : insights.length === 0 ? (
          <p className="text-xs text-[hsl(var(--fg-tertiary))] py-4 text-center">
            {t('dashboard.noInsights', 'فعلاً پیشنهادی وجود ندارد')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {insights.map((insight, i) => (
              <div
                key={i}
                className="flex h-full flex-col rounded-xl border border-[hsl(var(--color-primary)/0.2)] bg-[hsl(var(--color-primary)/0.05)] p-3"
              >
                <p className="text-xs sm:text-sm font-medium text-[hsl(var(--fg-primary))]">
                  {insight.title}
                </p>
                <p className="text-[11px] sm:text-xs text-[hsl(var(--fg-secondary))] mt-0.5">
                  {insight.description}
                </p>
                {insight.action && (
                  <button
                    onClick={() => onAction(insight.action!)}
                    className="mt-auto pt-1.5 text-start text-[11px] sm:text-xs font-medium text-[hsl(var(--color-primary))] hover:underline focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] rounded-md"
                  >
                    {insight.actionLabel || t('dashboard.aiInsight.action')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
AIInsightsPanel.displayName = 'AIInsightsPanel'

// ─── Recent Activities (پایین صفحه) ─────────────────────────────────────────

const RecentActivities = memo(function RecentActivities({
  groups,
  isLoading,
  onNavigate,
}: {
  groups: ActivityGroupDto[]
  isLoading: boolean
  onNavigate: (route: string) => void
}) {
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

  const items = useMemo(
    () =>
      (Array.isArray(groups) ? groups : [])
        .flatMap((g) =>
          (g.activities ?? []).map((a) => ({
            ...a,
            entitySummary: g.entitySummary ?? { route: '', label: '' },
          })),
        )
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 8),
    [groups],
  )

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
      {/* هدر با جداکننده‌ی بالا/پایین تا بخش فعالیت‌ها تفکیک بصری واضح‌تری داشته باشد */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-[hsl(var(--border-default)/0.6)] bg-[hsl(var(--surface-muted)/0.35)] px-4 sm:px-6 py-3 sm:py-3.5">
        <ActivityIcon
          className="size-4 sm:size-5 text-[hsl(var(--color-primary))]"
          aria-hidden="true"
        />
        <h2 className="text-sm sm:text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t('dashboard.recentActivities', 'فعالیت‌های اخیر')}
        </h2>
      </div>
      <div className="border-t border-[hsl(var(--border-default)/0.35)] px-4 sm:px-6 py-3 sm:py-4">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-10 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-[hsl(var(--fg-tertiary))] py-4 text-center">
            {t('dashboard.noActivities', 'فعالیتی ثبت نشده است')}
          </p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border-default)/0.6)]">
            {items.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => a.entitySummary.route && onNavigate(a.entitySummary.route)}
                  className="w-full flex items-center justify-between gap-3 py-2.5 text-start hover:bg-[hsl(var(--surface-muted)/0.5)] rounded-lg px-2 -mx-2 transition-colors duration-150"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[hsl(var(--fg-primary))] truncate">{a.title}</p>
                    <p className="text-[11px] text-[hsl(var(--fg-tertiary))] truncate">
                      {a.entitySummary.label}
                    </p>
                  </div>
                  <span className="text-[11px] text-[hsl(var(--fg-tertiary))] shrink-0">
                    {new Date(a.timestamp).toLocaleDateString('fa-AF')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
})
RecentActivities.displayName = 'RecentActivities'

// ─── Main Component ───────────────────────────────────────────────────────

export const DashboardView = memo(function DashboardView(props: DashboardViewProps) {
  const {
    t,
    fmt,
    totalSales,
    todaySales,
    customerDebt,
    warehouseValue,
    monthlyGrowth,
    kpiLoading,
    insights,
    insightsLoading,
    salesChartData,
    chartLoading,
    dateRange,
    activitiesLoading,
    recentActivities,
    onNavigate,
    onInsightAction,
    onDateRangeChange,
  } = props

  // ✅ درصد تغییر واقعی به‌جای اسپارک‌لاین.
  // کارت «فروش امروز» با دیروز مقایسه می‌شود (از داده‌ی روزانه‌ی نمودار).
  const todayChange = useMemo(() => {
    const series = Array.isArray(salesChartData) ? salesChartData : []
    if (series.length < 2) return null
    const sorted = [...series].sort((a, b) => String(a.date).localeCompare(String(b.date)))
    const prev = sorted[sorted.length - 2]
    const prevValue = Number(prev?.value) || 0
    if (prevValue <= 0) return todaySales > 0 ? 100 : null
    return ((todaySales - prevValue) / prevValue) * 100
  }, [salesChartData, todaySales])

  const previousDaySalesTotal = useMemo(() => {
    if (!salesChartData || salesChartData.length === 0) return 0
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    return salesChartData.find((d) => d.date === yesterdayStr)?.value ?? 0
  }, [salesChartData])

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Level 1: Context */}
      <Greeting t={t} />

      {/* Level 2: KPI cards — ۴ کارت افقی */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* ✅ این دو کارت روندشان را از داده‌ی نمودار می‌گیرند، پس تا وقتی آن
            کوئری کامل نشده باید skeleton نشان دهند؛ وگرنه یک لحظه با
            trend=null رندر می‌شوند و خط خنثی (نه اسپارک‌لاین) دیده می‌شود. */}
        {/* H1 — every figure opens the rows it was computed from.
            `invoiceListHref` and the list's own parser come from one table
            (invoice-filter-link.ts), so a card cannot link to a filter the
            list ignores. */}
        <KpiCard
          icon={TrendingUp}
          label={t('dashboard.totalSales', 'فروش کل')}
          value={fmt(totalSales)}
          change={monthlyGrowth ?? null}
          changeLabel={t('dashboard.vsLastMonth', 'نسبت به ماه گذشته')}
          isLoading={kpiLoading}
          onOpen={() => onNavigate(invoiceListHref('totalSales'))}
          openLabel={t('dashboard.openSalesInvoices', 'فاکتورهای فروش')}
        />
        <KpiCard
          icon={Wallet}
          label={t('dashboard.todaySales', 'فروش امروز')}
          value={fmt(todaySales)}
          change={todayChange}
          changeLabel={t('dashboard.vsYesterday', 'نسبت به دیروز')}
          isLoading={kpiLoading || chartLoading}
          onOpen={() => onNavigate(invoiceListHref('todaySales'))}
          openLabel={t('dashboard.openTodayInvoices', 'فاکتورهای امروز')}
        />
        <KpiCard
          icon={CreditCard}
          label={t('dashboard.customerDebt', 'بدهی مشتریان')}
          value={fmt(customerDebt)}
          change={null}
          isLoading={kpiLoading}
          onOpen={() => onNavigate(invoiceListHref('customerDebt'))}
          openLabel={t('dashboard.openUnpaidInvoices', 'فاکتورهای تسویه‌نشده')}
        />
        <KpiCard
          icon={Boxes}
          label={t('dashboard.warehouseValue', 'ارزش کل انبار')}
          value={fmt(warehouseValue)}
          change={null}
          isLoading={kpiLoading}
          onOpen={() => onNavigate('/warehouse')}
          openLabel={t('dashboard.openWarehouse', 'انبار')}
        />
      </div>

      {/* Level 3: Chart + AI Insights (عمودی، جای قبلی صورت‌حساب‌های اخیر) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <div
            className={cn(
              'rounded-2xl border border-[hsl(var(--border-default))]',
              'bg-[hsl(var(--surface-elevated))]',
              'p-4 sm:p-5',
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <TrendingUp
                  className="size-4 sm:size-5 text-[hsl(var(--color-primary))]"
                  aria-hidden="true"
                />
                <h2 className="text-sm sm:text-base font-semibold text-[hsl(var(--fg-primary))]">
                  {t('dashboard.salesChartTitle', 'نمودار فروش')}
                </h2>
              </div>
              <DateRangePicker
                value={dateRange}
                onChange={onDateRangeChange}
                t={t}
                disabled={chartLoading}
              />
            </div>
            <LazySalesChart
              data={salesChartData}
              isLoading={chartLoading}
              fmt={fmt}
              height={180}
              previousPeriodTotal={previousDaySalesTotal}
              currentPeriodTotal={todaySales}
              // `/reports` was never a route — the chart's "full report" link
              // 404'd on web and would have redirected to the dashboard on
              // desktop's catch-all. Accounting («پول و سود») is the destination
              // the navigation contract actually gives for revenue detail.
              onViewFullReport={() => onNavigate('/accounting')}
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <AIInsightsPanel
            insights={insights}
            isLoading={insightsLoading}
            onAction={onInsightAction}
          />
        </div>
      </div>

      {/* Level 4: Recent Activities — انتهای صفحه */}
      <RecentActivities
        groups={recentActivities}
        isLoading={activitiesLoading}
        onNavigate={onNavigate}
      />
    </div>
  )
})

DashboardView.displayName = 'DashboardView'
