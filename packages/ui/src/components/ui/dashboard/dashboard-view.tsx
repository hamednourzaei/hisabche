// packages/ui/src/components/ui/dashboard/dashboard-view.tsx
'use client'

import { KpiCard } from '../kpi-card'
import { memo, useEffect, useMemo, useState } from 'react'
import type { ElementType } from 'react'
import { useTranslations } from 'next-intl'
import { invoiceListHref } from '../../../lib/invoices/invoice-filter-link'
import { cn } from '../../../lib/utils'
import { roleTone, roleLabelKey } from '../../../lib/role-tone'
import {
  Sparkles,
  TrendingUp,
  Wallet,
  CreditCard,
  Boxes,
  Activity as ActivityIcon,
  Filter,
} from 'lucide-react'
import { SalesChart, type ChartDataPoint } from './sales-chart'
import { DateRangePicker, type DateRange, type PresetKey } from './date-range-picker'
import { SalesFunnel } from './sales-funnel'
import type { AIInsight } from '@hisabche/api'
import type { ActivityGroupDto, ActivityItemDto } from '@hisabche/api'
import dynamic from 'next/dynamic'
import { asList } from '@hisabche/api'
import { useDateFormat } from '../../../hooks/use-date-format'

// ─── Types ────────────────────────────────────────────────────────────────

type Translate = (key: string, fallback?: string) => string

interface DashboardViewProps {
  t: Translate
  fmt: (v: number) => string

  // KPI Data
  totalSales: number
  todaySales: number
  /** Sales total over the chart's selected range; null while unknown. */
  rangeSalesTotal: number | null
  /** Same-length period immediately before the range; null when unavailable. */
  previousRangeSalesTotal: number | null
  rangeLoading: boolean
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
  // ⚠️ THE HOUR IS READ AFTER MOUNT, NOT DURING RENDER. React #418 (text).
  //
  // `new Date().getHours()` in render ran twice with different clocks: on the
  // server in UTC, then in the browser in the reader's own zone — Kabul is
  // +4:30. For hours of every day the server rendered «صبح بخیر» and the browser
  // «ظهر بخیر», React saw different text, and threw the whole tree away. The
  // first paint uses a fixed key both sides agree on; the effect corrects it.
  const [h, setH] = useState<number | null>(null)
  useEffect(() => {
    setH(new Date().getHours())
  }, [])
  const k =
    h === null ? 'day' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'
  const label =
    k === 'day'
      ? 'خوش آمدید'
      : k === 'morning'
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

/**
 * Emergency copy only — every one of these keys exists in fa, af and en.
 * `t()` here is the wrapper that falls back rather than throwing, and a role
 * cell with no text at all would read as «no role» instead of «unknown».
 */
const ROLE_LABEL_FALLBACK: Record<string, string> = {
  owner: 'مالک',
  admin: 'مدیر',
  member: 'کارمند',
  viewer: 'فقط مشاهده',
  unknown: 'نامشخص',
}

/**
 * One option of the chart/funnel switch.
 *
 * ⚠️ THE LABEL IS PART OF THE CONTROL, NOT A TOOLTIP. A funnel glyph at 14px
 * is a triangle; an icon-only pair makes the reader decode a picture and then
 * infer the current view from which square is lit. `aria-pressed` states the
 * selection to a screen reader — the word states it to everyone else.
 */
const ViewTab = memo(function ViewTab({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: ElementType
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium',
        'transition-colors duration-150 motion-reduce:transition-none',
        active
          ? 'bg-[hsl(var(--color-primary)/0.14)] text-[hsl(var(--color-primary))] shadow-sm'
          : 'text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]',
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
})
ViewTab.displayName = 'ViewTab'

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

  // ⚠️ The calendar follows the language; this was hardcoded to `'fa-AF'`.
  const { date: fmtIntlDate } = useDateFormat()
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
          asList<ActivityItemDto>(g.activities).map((a) => ({
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
          <>
            {/*
              ⚠️ A GRID, AND THE HEADER USES THE SAME TEMPLATE AS THE ROWS.

              This was `flex justify-between` with a TWO-cell header over
              THREE-cell rows. Two things were wrong and both were visible:

                * «نقش» sat above the DATE, because the header had no third
                  cell — the labels named the wrong columns.
                * `justify-between` gives no column to anything. The role chip
                  landed wherever the event text stopped, so the chips
                  staggered left and right down the list instead of forming a
                  column.

              One shared template fixes both: the header cannot drift from the
              rows because it is laid out by the same rule.

              ⚠️ NO COMMA IN THE ARBITRARY VALUE. `grid-cols-[minmax(0,1fr)_…]`
              would be the textbook way to write this, and Tailwind v3's JIT
              emits NO CSS AT ALL for an arbitrary value containing a comma —
              the class silently does nothing. `1fr` plus `min-w-0` on the
              first cell is the same behaviour, spelled in a way that compiles.
            */}
            <div className="grid grid-cols-[1fr_5rem_6rem] items-center gap-3 px-2 pb-1.5 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--fg-tertiary))]">
              <span className="min-w-0 text-start">
                {t('dashboard.activityColumnEvent', 'رویداد')}
              </span>
              <span className="text-start">{t('dashboard.activityColumnRole', 'نقش')}</span>
              <span className="text-start">{t('dashboard.activityColumnDate', 'تاریخ')}</span>
            </div>
            <ul className="divide-y divide-[hsl(var(--border-default)/0.6)]">
              {items.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => a.entitySummary.route && onNavigate(a.entitySummary.route)}
                    className="w-full grid grid-cols-[1fr_5rem_6rem] items-center gap-3 py-2.5 text-start hover:bg-[hsl(var(--surface-muted)/0.5)] rounded-lg px-2 -mx-2 transition-colors duration-150"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-[hsl(var(--fg-primary))] truncate">{a.title}</p>
                      <p className="text-[11px] text-[hsl(var(--fg-tertiary))] truncate">
                        {a.entitySummary.label}
                      </p>
                    </div>
                    {/* Who did it, as a role.
                      ⚠️ An activity whose actor has no CURRENT membership
                      arrives with `actorRole: null` and is rendered neutral
                      and «unknown». It is never coloured as `member` or
                      `viewer`: guessing the lowest role would put a false
                      statement about a real person on the dashboard.

                      `justify-self-start` so the chip sits at the column's
                      edge and every chip lines up, whatever its text width. */}
                    <span
                      className={cn(
                        'justify-self-start rounded-md px-2 py-0.5 text-[11px] font-medium',
                        roleTone(a.actorRole),
                      )}
                      title={a.actor}
                    >
                      {t(roleLabelKey(a.actorRole), ROLE_LABEL_FALLBACK[a.actorRole ?? 'unknown'])}
                    </span>
                    {/* `tabular-nums` so the digits share a width and the
                        dates form a straight edge rather than a ragged one. */}
                    <span className="justify-self-start text-[11px] tabular-nums text-[hsl(var(--fg-tertiary))]">
                      {fmtIntlDate(a.timestamp)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
})
RecentActivities.displayName = 'RecentActivities'

// ─── Main Component ───────────────────────────────────────────────────────

export const DashboardView = memo(function DashboardView(props: DashboardViewProps) {
  // ⚠️ The calendar follows the language; these were hardcoded to `'fa-AF'`.
  const { date: fmtIntlDate, lang: dateLang } = useDateFormat()

  /**
   * Which of the two the card is showing.
   *
   * ⚠️ THE FUNNEL NEEDS NO REQUEST OF ITS OWN. It reads `salesChartData` —
   * the same array the chart draws, whose points already carry `value`,
   * `invoiceCount` and `customerCount`. An earlier version fetched a CRM
   * pipeline instead and cost the dashboard a separate 1525ms request (seen
   * in the production log) for data already in memory.
   */
  const [view, setView] = useState<'chart' | 'funnel'>('chart')

  const {
    t,
    fmt,
    totalSales,
    todaySales,
    rangeSalesTotal,
    previousRangeSalesTotal,
    rangeLoading,
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

  // ─── The range card ───────────────────────────────────────────────────
  //
  // ⚠️ IT FOLLOWS THE CHART'S RANGE. This card used to be pinned to «today»
  // while the chart beside it showed whatever range was picked, so the two
  // disagreed the moment the range changed. Its value is now the total for the
  // selected range, and its label says which range that is.
  //
  // The percentage compares against the equally long period immediately before
  // the range — a period that was actually fetched. With no such figure, or a
  // previous period of zero (growth from nothing has no meaningful ratio), no
  // percentage is shown rather than an invented one.
  // ⚠️ «Today» is read after mount — same React #418 hazard as the greeting:
  // the server's date and the browser's can differ around midnight.
  const [today, setToday] = useState<string | null>(null)
  useEffect(() => {
    setToday(new Date().toDateString())
  }, [])
  const rangeIsToday = useMemo(() => {
    const from = dateRange?.from
    const to = dateRange?.to
    if (!from || !to || today === null) return false
    return from.toDateString() === today && to.toDateString() === today
  }, [dateRange, today])

  const rangeDays = useMemo(() => {
    const from = dateRange?.from
    const to = dateRange?.to
    if (!from || !to) return 0
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
    return Math.max(1, Math.round((end - start) / 86_400_000) + 1)
  }, [dateRange])

  const rangeChange = useMemo(() => {
    if (rangeSalesTotal === null || previousRangeSalesTotal === null) return null
    if (previousRangeSalesTotal <= 0) return null
    return ((rangeSalesTotal - previousRangeSalesTotal) / previousRangeSalesTotal) * 100
  }, [rangeSalesTotal, previousRangeSalesTotal])

  const rangeLabel = rangeIsToday
    ? t('dashboard.todaySales', 'فروش امروز')
    : `${t('dashboard.rangeSales', 'فروش')} ${fmtIntlDate(dateRange?.from ?? null)} – ${fmtIntlDate(dateRange?.to ?? null)}`

  const rangeChangeLabel = rangeIsToday
    ? t('dashboard.vsYesterday', 'نسبت به دیروز')
    : `${t('dashboard.vsPrevious', 'نسبت به')} ${rangeDays} ${t('dashboard.daysBefore', 'روز قبل')}`

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
          delta={monthlyGrowth ?? null}
          deltaLabel={t('dashboard.vsLastMonth', 'نسبت به ماه گذشته')}
          showEmptyDelta
          isLoading={kpiLoading}
          onOpen={() => onNavigate(invoiceListHref('totalSales'))}
          openLabel={t('dashboard.openSalesInvoices', 'فاکتورهای فروش')}
        />
        <KpiCard
          icon={Wallet}
          label={rangeLabel}
          value={fmt(rangeSalesTotal ?? 0)}
          delta={rangeChange}
          {...(rangeChangeLabel ? { deltaLabel: rangeChangeLabel } : {})}
          showEmptyDelta
          isLoading={rangeLoading || rangeSalesTotal === null}
          onOpen={() => onNavigate(invoiceListHref(rangeIsToday ? 'todaySales' : 'totalSales'))}
          openLabel={t('dashboard.openTodayInvoices', 'فاکتورهای امروز')}
        />
        <KpiCard
          icon={CreditCard}
          label={t('dashboard.customerDebt', 'بدهی مشتریان')}
          value={fmt(customerDebt)}
          delta={null}
          // ⚠️ Debt is the one card here where rising is BAD. It carries no
          // comparison today, so nothing is coloured — but the flag is set so
          // a future delta cannot inherit «up is green».
          invertDelta
          showEmptyDelta
          isLoading={kpiLoading}
          onOpen={() => onNavigate(invoiceListHref('customerDebt'))}
          openLabel={t('dashboard.openUnpaidInvoices', 'فاکتورهای تسویه‌نشده')}
        />
        <KpiCard
          icon={Boxes}
          label={t('dashboard.warehouseValue', 'ارزش کل انبار')}
          value={fmt(warehouseValue)}
          delta={null}
          showEmptyDelta
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[hsl(var(--border-default)/0.6)] pb-3 mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                {view === 'chart' ? (
                  <TrendingUp
                    className="size-4 sm:size-5 text-[hsl(var(--color-primary))]"
                    aria-hidden="true"
                  />
                ) : (
                  <Filter
                    className="size-4 sm:size-5 text-[hsl(var(--color-primary))]"
                    aria-hidden="true"
                  />
                )}
                <h2 className="text-sm sm:text-base font-semibold text-[hsl(var(--fg-primary))]">
                  {t('dashboard.salesChartTitle', 'نمودار فروش')}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/*
                  ⚠️ A SEGMENTED CONTROL WITH WORDS, NOT TWO BARE ICONS.

                  An icon-only pair forces the reader to decode a picture: a
                  funnel glyph at 14px is a triangle, and «which one am I
                  looking at» has to be inferred from which square is lit.
                  `aria-pressed` states the selection for a screen reader; the
                  LABEL states it for everyone else.
                */}
                <div
                  role="group"
                  aria-label={t('dashboard.viewSwitch', 'نمای نمودار')}
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-lg p-0.5',
                    'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]',
                  )}
                >
                  <ViewTab
                    icon={TrendingUp}
                    label={t('dashboard.viewTrend', 'روند فروش')}
                    active={view === 'chart'}
                    onClick={() => setView('chart')}
                  />
                  <ViewTab
                    icon={Filter}
                    label={t('dashboard.viewFunnel', 'قیف تبدیل')}
                    active={view === 'funnel'}
                    onClick={() => setView('funnel')}
                  />
                </div>

                {/*
                  ⚠️ THE RANGE PICKER STAYS ON BOTH VIEWS.

                  An earlier version hid it on the funnel, reasoning that a
                  funnel is a snapshot. That was wrong for THIS funnel: it is
                  built from `salesChartData`, so the window the picker selects
                  is exactly what it counts and compares. Hiding the control
                  that drives it would leave the reader unable to see — or
                  change — the period the numbers belong to.
                */}
                <DateRangePicker
                  value={dateRange}
                  onChange={onDateRangeChange}
                  t={t}
                  disabled={chartLoading}
                />
              </div>
            </div>

            {/*
              One body, two views. `min-h` so switching does not make the card
              jump, and a short fade so the swap reads as one surface changing
              rather than two cards replacing each other.
            */}
            <div
              key={view}
              className={cn(
                'relative min-h-[200px] w-full',
                'animate-in fade-in-0 duration-200 motion-reduce:animate-none',
              )}
            >
              {view === 'chart' ? (
                <LazySalesChart
                  data={salesChartData}
                  isLoading={chartLoading}
                  fmt={fmt}
                  height={180}
                  previousPeriodTotal={previousRangeSalesTotal ?? 0}
                  currentPeriodTotal={rangeSalesTotal ?? 0}
                  // `/reports` was never a route — the chart's "full report" link
                  // 404'd on web and would have redirected to the dashboard on
                  // desktop's catch-all. Accounting («پول و سود») is the destination
                  // the navigation contract actually gives for revenue detail.
                  onViewFullReport={() => onNavigate('/accounting')}
                />
              ) : (
                <SalesFunnel
                  data={salesChartData}
                  total={totalSales}
                  fmt={fmt}
                  isLoading={chartLoading}
                  height={180}
                  t={t}
                />
              )}
            </div>
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
