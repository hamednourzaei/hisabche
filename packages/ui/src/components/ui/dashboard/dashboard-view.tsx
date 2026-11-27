// packages/ui/src/components/ui/dashboard/dashboard-view.tsx
'use client'

import { KpiCard, KpiGrid } from '../kpi-card'
import { CustomKpiCards } from './custom-kpis'
import { memo, useEffect, useMemo, useState } from 'react'
import type { ElementType } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { invoiceListHref } from '../../../lib/invoices/invoice-filter-link'
import { cn } from '../../../lib/utils'
import { roleTone, roleLabelKey } from '../../../lib/role-tone'
import {
  Sparkles,
  TrendingUp,
  CreditCard,
  Boxes,
  Activity as ActivityIcon,
  Filter,
  Plus,
  Receipt,
  Users,
  Wallet,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import type { ChartDataPoint } from './sales-chart'
import { DateRangePicker, type DateRange, type PresetKey } from './date-range-picker'
import { SalesFunnel } from './sales-funnel'
import type { AIInsight } from '@hisabche/api'
import type { ActivityGroupDto, ActivityItemDto } from '@hisabche/api'
import dynamic from 'next/dynamic'
import { asList } from '@hisabche/api'
import { useDateFormat } from '../../../hooks/use-date-format'
import { formatAmount, formatNumber, type KnownCurrency } from '@hisabche/formatting'
import { useActionAvailability } from '../../../lib/capability'
import { CloudRequiredNotice } from '../cloud-required-notice'
import { nameOfCurrency } from '../../../lib/currency-name'

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
  /** Products below zero — named on the stock card, never subtracted (QA-DASH-NEG). */
  negativeStockProducts?: number | null | undefined
  monthlyGrowth?: number | null | undefined
  /** advances-02: «held for customers · paid to suppliers», already formatted; null = unreadable. */
  openAdvancesText?: string | null | undefined

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
  /**
   * «Includes N sales awaiting confirmation» — written by the container from
   * the device read, because only the device has an outbox to count (D10).
   * `null` = unknown, and nothing is drawn.
   */
  pendingInvoicesLabel?: string | null | undefined

  // Activities
  recentActivities: ActivityGroupDto[]

  // Actions
  onNavigate: (route: string) => void
  onInsightAction: (action: string) => void
  onDateRangeChange: (range: DateRange, preset: PresetKey) => void
  /**
   * Which parts the person shows (their own choice). Absent = all. A part
   * that is off is not rendered here and was not fetched by the container.
   */
  show?: { kpis: boolean; chart: boolean; insights: boolean; activities: boolean } | undefined
  /**
   * Figure groups the SERVER did not tell this person (their role does not
   * include them). Those cards are left out, never drawn as zero.
   */
  hiddenFigures?: readonly string[] | undefined
  /**
   * Section order. The industry profile supplies it when the person has no
   * saved look; a saved look keeps the person's own arrangement.
   */
  order?: readonly string[] | undefined
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
  const availability = useActionAvailability('dashboard.ai_insight')

  const t = (key: string, fallback?: string) => {
    try {
      const v = tOriginal(key as Parameters<typeof tOriginal>[0])
      return v && v !== key ? v : (fallback ?? key)
    } catch (err) {
      console.error('[DEBUG dashboard] t() threw for key:', key, err)
      return fallback ?? key
    }
  }

  // Every hook before the early return below (a hook after a return runs on some renders only).
  const locale = useLocale()

  if (availability.requiresOnline) {
    return (
      <CloudRequiredNotice variant="card" title={t('dashboard.aiInsights', 'پیشنهادهای هوشمند')} />
    )
  }

  // Live audit #74: the server sends WHAT (a code, numbers, the books
  // currency); the sentence is written here, in the reader's language, with
  // the reader's digits and the currency's name — never «افغانی» for everyone.
  const written = (insight: AIInsight) => {
    if (!insight.code)
      return { title: insight.title, text: insight.description, action: insight.actionLabel }
    const values = insight.values ?? {}
    const currency = insight.currency ?? ''
    const fill = (template: string) =>
      template
        .replace(
          '{amount}',
          typeof values.amount === 'number'
            ? `${formatAmount(values.amount, currency as KnownCurrency, locale)} ${nameOfCurrency(t, currency, currency)}`
            : '',
        )
        .replace(
          '{count}',
          typeof values.count === 'number' ? formatNumber(values.count, locale) : '',
        )
        .replace('{names}', typeof values.names === 'string' ? values.names : '')
    const key = `dashboard.insight.${insight.code}`
    return {
      title: t(`${key}.title`, insight.code),
      text: fill(t(`${key}.text`, '')),
      action: t(`${key}.action`, t('dashboard.aiInsight.action')),
    }
  }

  const urgencyOf = (
    insight: AIInsight,
  ): {
    level: 'critical' | 'attention' | 'info'
    badge: string
    border: string
    badgeClass: string
    Icon: ElementType
  } => {
    const sig =
      `${insight.code ?? ''} ${insight.type ?? ''} ${(insight as { severity?: string }).severity ?? ''}`.toLowerCase()
    if (/stock|low|negative|overdue|debt|critical|high|alert/.test(sig)) {
      return {
        level: 'critical',
        badge: t('dashboard.insightUrgency.critical', 'فوری'),
        border: 'border-s-2 border-s-[hsl(var(--color-destructive))]',
        badgeClass: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
        Icon: AlertTriangle,
      }
    }
    if (/pending|unpaid|warn|medium|due/.test(sig)) {
      return {
        level: 'attention',
        badge: t('dashboard.insightUrgency.attention', 'پیگیری'),
        border: 'border-s-2 border-s-[hsl(var(--color-warning))]',
        badgeClass: 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
        Icon: Clock,
      }
    }
    return {
      level: 'info',
      badge: t('dashboard.insightUrgency.info', 'پیشنهاد'),
      border: 'border-s-2 border-s-[hsl(var(--color-primary))]',
      badgeClass: 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]',
      Icon: Sparkles,
    }
  }

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border-default)/0.6)] bg-[hsl(var(--surface-muted)/0.35)] px-3.5 sm:px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('dashboard.aiInsights', 'پیشنهادهای هوشمند')}
          </h2>
        </div>
        {insights.length > 0 ? (
          <span className="rounded-full bg-[hsl(var(--color-primary)/0.12)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[hsl(var(--color-primary))]">
            {formatNumber(insights.length, locale)}
          </span>
        ) : null}
      </div>
      <div className="p-3 sm:p-3.5">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="h-14 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />
            <div className="h-14 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />
          </div>
        ) : insights.length === 0 ? (
          <p className="text-xs text-[hsl(var(--fg-tertiary))] py-4 text-center">
            {t('dashboard.noInsights', 'فعلاً پیشنهادی وجود ندارد')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {insights.map((insight, i) => {
              const words = written(insight)
              const urg = urgencyOf(insight)
              const UrgIcon = urg.Icon
              return (
                <div
                  key={i}
                  className={cn(
                    'flex h-full min-w-0 flex-col rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-2.5',
                    urg.border,
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                        urg.badgeClass,
                      )}
                    >
                      <UrgIcon className="size-2.5 shrink-0" aria-hidden="true" />
                      {urg.badge}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[hsl(var(--fg-primary))] line-clamp-1">
                    {words.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[hsl(var(--fg-secondary))] line-clamp-2">
                    {words.text}
                  </p>
                  {insight.action && (
                    <button
                      type="button"
                      onClick={() => onAction(insight.action!)}
                      className="mt-auto pt-1.5 min-h-[44px] sm:min-h-0 flex items-center self-start text-[11px] font-medium text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))] rounded-md"
                    >
                      {words.action || t('dashboard.aiInsight.action')}
                    </button>
                  )}
                </div>
              )
            })}
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
      <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border-default)/0.6)] bg-[hsl(var(--surface-muted)/0.35)] px-4 sm:px-6 py-3 sm:py-3.5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ActivityIcon
            className="size-4 sm:size-5 text-[hsl(var(--color-primary))]"
            aria-hidden="true"
          />
          <h2 className="text-sm sm:text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t('dashboard.recentActivities', 'فعالیت‌های اخیر')}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('/activities')}
          className="text-xs font-medium text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))] rounded-md"
        >
          {t('dashboard.viewAllActivities', 'مشاهده همه')}
        </button>
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
            <div className="hidden sm:grid sm:grid-cols-[1fr_5rem_6rem] items-center gap-3 px-2 pb-1.5 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--fg-tertiary))]">
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
                    className="w-full flex flex-col gap-1.5 sm:grid sm:grid-cols-[1fr_5rem_6rem] sm:items-center sm:gap-3 py-2.5 text-start hover:bg-[hsl(var(--surface-muted)/0.5)] rounded-lg px-2 -mx-2 transition-colors duration-150 min-h-[44px]"
                  >
                    <div className="min-w-0 w-full">
                      <p className="text-sm text-[hsl(var(--fg-primary))] truncate">{a.title}</p>
                      <p className="text-[11px] text-[hsl(var(--fg-tertiary))] truncate">
                        {a.entitySummary.label}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:contents">
                      <span
                        className={cn(
                          'justify-self-start rounded-md px-2 py-0.5 text-[11px] font-medium',
                          roleTone(a.actorRole),
                        )}
                        title={a.actor}
                      >
                        {t(
                          roleLabelKey(a.actorRole),
                          ROLE_LABEL_FALLBACK[a.actorRole ?? 'unknown'],
                        )}
                      </span>
                      <span className="justify-self-start text-[11px] tabular-nums text-[hsl(var(--fg-tertiary))]">
                        {fmtIntlDate(a.timestamp)}
                      </span>
                    </div>
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
  const locale = useLocale()

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
    negativeStockProducts,
    monthlyGrowth,
    openAdvancesText,
    kpiLoading,
    insights,
    insightsLoading,
    salesChartData,
    chartLoading,
    pendingInvoicesLabel,
    dateRange,
    activitiesLoading,
    recentActivities,
    onNavigate,
    onInsightAction,
    onDateRangeChange,
    show,
    hiddenFigures = [],
    order,
  } = props

  const rank = useMemo(() => {
    const map = new Map<string, number>()
    ;(order ?? []).forEach((id, index) => map.set(id, index))
    return map
  }, [order])
  const orderOf = (id: string) => rank.get(id) ?? 99

  const showHeroSales = show?.kpis !== false && !hiddenFigures.includes('sales')
  const showChart = show?.chart !== false
  const showDebt = show?.kpis !== false && !hiddenFigures.includes('customers')
  const showAdvances =
    show?.kpis !== false &&
    !hiddenFigures.includes('customers') &&
    !hiddenFigures.includes('sales') &&
    openAdvancesText !== undefined
  const showStock = show?.kpis !== false && !hiddenFigures.includes('stockValue')
  const hasFinancialPosition = showDebt || showAdvances || showStock

  const totalSalesText = fmt(totalSales)
  const todaySalesText = fmt(todaySales)
  const rangeSalesText = rangeSalesTotal !== null ? fmt(rangeSalesTotal) : '—'
  const customerDebtText = fmt(customerDebt)
  const advancesText = openAdvancesText ?? t('dashboard.openAdvancesUnread', 'خوانده نشد')
  const warehouseValueText = fmt(warehouseValue)
  const hasGrowth = monthlyGrowth !== undefined && monthlyGrowth !== null

  return (
    <div className="flex flex-col gap-3 sm:gap-3.5" data-guide="dashboard-page">
      {/* Level 1: Compact Command Header + Quick Operational Actions (~48px laptop budget) */}
      <div
        data-guide="dashboard-overview"
        className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between border-b border-[hsl(var(--border-default)/0.6)] pb-2.5"
      >
        <Greeting t={t} />
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          {hiddenFigures.includes('sales') ? null : (
            <button
              type="button"
              onClick={() => onNavigate('/invoices/new')}
              className="inline-flex min-h-[44px] sm:min-h-[36px] items-center justify-center gap-1.5 rounded-xl bg-[hsl(var(--color-primary))] px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-[hsl(var(--color-primary-fg))] shadow-sm hover:opacity-95 transition-opacity"
            >
              <Plus className="size-4 shrink-0" aria-hidden="true" />
              <span>{t('nav.recordSale', 'فاکتور جدید')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('/till')}
            className="inline-flex min-h-[44px] sm:min-h-[36px] items-center justify-center gap-1.5 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-1.5 text-xs sm:text-sm font-medium text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))] transition-colors"
          >
            <Receipt
              className="size-4 shrink-0 text-[hsl(var(--color-primary))]"
              aria-hidden="true"
            />
            <span>{t('nav.till', 'صندوق')}</span>
          </button>
          {hiddenFigures.includes('stockValue') ? null : (
            <button
              type="button"
              onClick={() => onNavigate('/warehouse')}
              className="inline-flex min-h-[44px] sm:min-h-[36px] items-center justify-center gap-1.5 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-1.5 text-xs sm:text-sm font-medium text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))] transition-colors"
            >
              <Boxes
                className="size-4 shrink-0 text-[hsl(var(--color-primary))]"
                aria-hidden="true"
              />
              <span>{t('nav.stock', 'انبار')}</span>
            </button>
          )}
          {hiddenFigures.includes('customers') ? null : (
            <button
              type="button"
              onClick={() => onNavigate('/customers')}
              className="inline-flex min-h-[44px] sm:min-h-[36px] items-center justify-center gap-1.5 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-1.5 text-xs sm:text-sm font-medium text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))] transition-colors"
            >
              <Users
                className="size-4 shrink-0 text-[hsl(var(--color-primary))]"
                aria-hidden="true"
              />
              <span>{t('nav.buyers', 'مشتریان')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Level 2: Shared KpiGrid + KpiCard(surface="none") inside a unified horizontal Financial Overview band */}
      {showHeroSales || hasFinancialPosition ? (
        <section
          style={{ order: orderOf('kpis') }}
          data-guide="dashboard-kpis"
          aria-label={t('dashboard.financialPosition', 'وضعیت مالی و دارایی')}
          className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-2.5 sm:p-3"
        >
          <KpiGrid>
            {showHeroSales ? (
              <KpiCard
                surface="none"
                tone="primary"
                className="rounded-xl p-2 sm:p-2.5"
                icon={TrendingUp}
                label={t('dashboard.totalSales', 'فروش کل')}
                value={totalSalesText}
                delta={hasGrowth ? monthlyGrowth : null}
                isLoading={kpiLoading}
                onOpen={() => onNavigate(invoiceListHref('totalSales'))}
                openLabel={t('dashboard.openSalesInvoices', 'فاکتورهای فروش')}
                hint={
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[hsl(var(--fg-secondary))]">
                    <span>
                      {t('dashboard.todaySales', 'امروز')}:{' '}
                      <strong className="font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                        {kpiLoading ? '…' : todaySalesText}
                      </strong>
                    </span>
                    <span>
                      {t('dashboard.rangeSalesTotal', 'بازه')}:{' '}
                      <strong className="font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                        {rangeLoading ? '…' : rangeSalesText}
                      </strong>
                    </span>
                  </div>
                }
              />
            ) : null}

            {showDebt ? (
              <KpiCard
                surface="none"
                tone="warning"
                className="rounded-xl p-2 sm:p-2.5"
                icon={CreditCard}
                label={t('dashboard.customerDebt', 'بدهی مشتریان')}
                invertDelta
                value={customerDebtText}
                isLoading={kpiLoading}
                onOpen={() => onNavigate(invoiceListHref('customerDebt'))}
                openLabel={t('dashboard.customerDebt', 'بدهی مشتریان')}
              />
            ) : null}

            {showAdvances ? (
              <KpiCard
                surface="none"
                tone="info"
                className="rounded-xl p-2 sm:p-2.5"
                icon={Wallet}
                label={t('dashboard.openAdvances', 'پیش‌دریافت / پیش‌پرداخت')}
                value={advancesText}
                isLoading={kpiLoading}
                onOpen={() => onNavigate('/invoices?type=pre_sale')}
                openLabel={t('dashboard.openAdvances', 'پیش‌دریافت / پیش‌پرداخت')}
              />
            ) : null}

            {showStock ? (
              <KpiCard
                surface="none"
                tone="default"
                className="rounded-xl p-2 sm:p-2.5"
                icon={Boxes}
                label={t('dashboard.warehouseValue', 'ارزش کل انبار')}
                value={warehouseValueText}
                isLoading={kpiLoading}
                onOpen={() => onNavigate('/warehouse')}
                openLabel={t('dashboard.warehouseValue', 'ارزش کل انبار')}
                hint={
                  negativeStockProducts ? (
                    <span className="truncate text-[10px] font-medium text-[hsl(var(--color-warning))]">
                      {`${formatNumber(negativeStockProducts, locale, 0)} ${t(
                        'dashboard.negativeStockHint',
                        'کالا زیر صفر — در ارزش شمرده نشد',
                      )}`}
                    </span>
                  ) : undefined
                }
              />
            ) : null}
          </KpiGrid>
        </section>
      ) : null}

      {/* Level 3: Main Trend Chart (7 cols, compact 175px) + Urgency-Differentiated Insights (5 cols) */}
      {showChart || show?.insights !== false ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-3.5 items-start">
          {showChart ? (
            <section
              style={{ order: orderOf('chart') }}
              data-guide="dashboard-chart"
              className={cn(
                'min-w-0 flex flex-col rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3.5 sm:p-4 overflow-hidden',
                show?.insights === false ? 'lg:col-span-12' : 'lg:col-span-7',
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[hsl(var(--border-default)/0.5)]">
                <div className="flex items-center gap-1.5">
                  {view === 'chart' ? (
                    <TrendingUp
                      className="size-4 text-[hsl(var(--color-primary))]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Filter
                      className="size-4 text-[hsl(var(--color-primary))]"
                      aria-hidden="true"
                    />
                  )}
                  <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                    {t('dashboard.salesChartTitle', 'نمودار فروش')}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
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

                  <DateRangePicker
                    value={dateRange}
                    onChange={onDateRangeChange}
                    t={t}
                    disabled={chartLoading}
                  />
                </div>
              </div>

              {pendingInvoicesLabel ? (
                <p className="mb-2 text-xs text-[hsl(var(--fg-secondary))]">
                  {pendingInvoicesLabel}
                </p>
              ) : null}

              <div
                key={view}
                className={cn(
                  'relative min-h-[175px] w-full flex-1',
                  'animate-in fade-in-0 duration-200 motion-reduce:animate-none',
                )}
              >
                {view === 'chart' ? (
                  <LazySalesChart
                    data={salesChartData}
                    isLoading={chartLoading}
                    fmt={fmt}
                    height={175}
                    previousPeriodTotal={previousRangeSalesTotal ?? 0}
                    currentPeriodTotal={rangeSalesTotal ?? 0}
                    onViewFullReport={() => onNavigate('/accounting')}
                  />
                ) : (
                  <SalesFunnel
                    data={salesChartData}
                    total={totalSales}
                    fmt={fmt}
                    isLoading={chartLoading}
                    height={175}
                    t={t}
                  />
                )}
              </div>
            </section>
          ) : null}

          {show?.insights === false ? null : (
            <div
              style={{ order: orderOf('insights') }}
              className={cn('min-w-0', !showChart ? 'lg:col-span-12' : 'lg:col-span-5')}
            >
              <AIInsightsPanel
                insights={insights}
                isLoading={insightsLoading}
                onAction={onInsightAction}
              />
            </div>
          )}
        </div>
      ) : null}

      {/* Custom Pinned KPIs (only renders when user pinned custom metrics) */}
      {show?.kpis === false ? null : (
        <KpiGrid className="empty:hidden">
          <CustomKpiCards locale={locale} onNavigate={onNavigate} />
        </KpiGrid>
      )}

      {/* Level 4: Recent Business Activity */}
      {show?.activities === false ? null : (
        <div style={{ order: orderOf('activities') }} className="min-w-0">
          <RecentActivities
            groups={recentActivities}
            isLoading={activitiesLoading}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </div>
  )
})

DashboardView.displayName = 'DashboardView'
