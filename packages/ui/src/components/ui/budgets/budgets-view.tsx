'use client'

// ============================================
// packages/ui/src/components/ui/budgets/budgets-view.tsx
//
// Budgets — planning, control, variance, forecast.
//
// ---------------------------------------------------------------------------
// EVERY NUMBER HERE IS THE SERVER'S
//
// Remaining, variance, theoretical, forecast and state come from
// `GET /operations/budgets/report` (BudgetService.performanceReport). This
// file formats and arranges them. It never subtracts one budget figure from
// another: a second calculation in the browser is a second truth, and the day
// the two disagree nobody knows which one the purchase check used.
//
// Variance is already normalised by the server so POSITIVE IS FAVOURABLE for
// both expense and revenue budgets. No sign is flipped in this file.
//
// ---------------------------------------------------------------------------
// LAYOUT
//
//   header → filters → KPI row → plan-vs-actual chart + allocation by account
//   → budgets (table from md, cards below) → spend check
//   Detail and create open in a Sheet: bottom on phones, side from md.
// ============================================

import { memo, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { AlertTriangle, CheckCircle2, CircleDashed, Plus, TrendingUp, Wallet } from 'lucide-react'
import type {
  Account,
  BudgetAction,
  BudgetCheck,
  BudgetReport,
  BudgetReportRow,
  BudgetRevisionRow,
  BudgetStatusCode,
  BudgetType,
  SaveBudgetInput,
} from '@hisabche/api'

import { useDateFormat } from '../../../hooks/use-date-format'
import { formatSelectedMoney } from '../../../lib/money-display'
import { formatMoney } from '@hisabche/formatting'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { DataTable, matchesSearch, type TableColumn } from '../data-table'
import { SegmentedFilter } from '../segmented-filter'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../sheet'
import { Skeleton } from '../skeleton'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  ErrorNote,
  Field,
  ListSection,
  MinorInput,
  Money,
  NumberField,
  Panel,
  SelectField,
  Stat,
} from '../capability/capability-kit'

const BudgetChart = dynamic(() => import('./budget-chart-internal'), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
})

type Translate = (key: string, fallback?: string) => string
type PerfState = BudgetReportRow['performance']['state']

/** Semantic tone AND a word — colour is never the only signal. */
const STATE_TONE: Record<PerfState, string> = {
  ok: 'good',
  near_limit: 'info',
  warning: 'warn',
  over: 'bad',
  forecast_overrun: 'warn',
}

const STATUS_TONE: Record<BudgetStatusCode, string> = {
  draft: 'neutral',
  pending_approval: 'info',
  approved: 'good',
  archived: 'neutral',
}

export interface BudgetFilters {
  type: BudgetType | 'all'
  status: BudgetStatusCode | 'all'
  branchId: string
  onDate: string
}

export interface BudgetsViewProps {
  t: Translate
  report: BudgetReport | undefined
  isLoading: boolean
  error: string | null
  filters: BudgetFilters
  onFiltersChange: (next: BudgetFilters) => void
  accounts: Account[]
  branches: Array<{ id: string; name: string }>
  /** What the signed-in role may do — for display only; the server enforces. */
  canManage: boolean
  canApprove: boolean
  actionError: string | null
  isBusy: boolean
  onRefresh: () => void
  onSave: (input: SaveBudgetInput) => void
  onSubmit: (id: string) => void
  onApprove: (id: string) => void
  onArchive: (id: string) => void
  onRevise: (input: {
    id: string
    expectedVersion: number
    amountMinor: number
    reason: string
  }) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  revisions: BudgetRevisionRow[]
  isRevisionsLoading: boolean
  checkResult: BudgetCheck | null
  onCheckSpend: (input: { accountId: string; amountMinor: number; onDate: string }) => void
  newId: () => string
}

export const BudgetsView = memo(function BudgetsView(props: BudgetsViewProps) {
  const { t, report, isLoading, error, filters, onFiltersChange, accounts } = props
  const { date } = useDateFormat()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const accountName = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, `${a.code} · ${a.name}`]))
    return (id: string) => map.get(id) ?? id.slice(0, 8)
  }, [accounts])

  const rows = useMemo(
    () =>
      (report?.rows ?? []).filter((row) =>
        matchesSearch(search, [
          row.budget.name ?? '',
          accountName(row.budget.accountId),
          t(`budgets.type_${row.budget.type}`, row.budget.type),
        ]),
      ),
    [accountName, report, search, t],
  )

  const selected = useMemo(
    () => report?.rows.find((r) => r.budget.id === props.selectedId) ?? null,
    [props.selectedId, report],
  )

  const columns = useMemo<TableColumn<BudgetReportRow>[]>(
    () => [
      {
        id: 'account',
        labelKey: 'budgets.account',
        labelFallback: 'حساب',
        locked: true,
        sortValue: (row) => accountName(row.budget.accountId),
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.budget.name || accountName(row.budget.accountId)}
            </p>
            {row.budget.name ? (
              <p className="truncate text-xs text-[hsl(var(--fg-tertiary))]">
                {accountName(row.budget.accountId)}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'type',
        labelKey: 'budgets.type',
        labelFallback: 'نوع',
        showFrom: 'lg',
        sortValue: (row) => row.budget.type,
        render: (row) => t(`budgets.type_${row.budget.type}`, row.budget.type),
      },
      {
        id: 'period',
        labelKey: 'budgets.period',
        labelFallback: 'دوره',
        showFrom: 'lg',
        sortValue: (row) => row.periodStart,
        render: (row) => (
          <span className="text-xs text-[hsl(var(--fg-secondary))]">
            {date(row.periodStart)} – {date(row.periodEnd)}
          </span>
        ),
      },
      {
        id: 'budget',
        labelKey: 'budgets.budget',
        labelFallback: 'بودجه',
        align: 'end',
        sortValue: (row) => row.performance.budgetMinor,
        render: (row) => <Money minor={row.performance.budgetMinor} />,
      },
      {
        id: 'actual',
        labelKey: 'budgets.actual',
        labelFallback: 'مصرف‌شده',
        align: 'end',
        sortValue: (row) => row.performance.actualMinor,
        render: (row) => <Money minor={row.performance.actualMinor} />,
      },
      {
        id: 'committed',
        labelKey: 'budgets.committed',
        labelFallback: 'تعهدشده',
        align: 'end',
        showFrom: 'lg',
        sortValue: (row) => row.performance.openCommitmentMinor,
        render: (row) => <Money minor={row.performance.openCommitmentMinor} tone="muted" />,
      },
      {
        id: 'remaining',
        labelKey: 'budgets.remaining',
        labelFallback: 'باقی‌مانده',
        align: 'end',
        sortValue: (row) => row.performance.remainingMinor,
        render: (row) => <Money minor={row.performance.remainingMinor} />,
      },
      {
        id: 'forecast',
        labelKey: 'budgets.forecast',
        labelFallback: 'پیش‌بینی',
        align: 'end',
        showFrom: 'lg',
        sortValue: (row) => row.performance.forecastMinor ?? -1,
        render: (row) =>
          row.performance.forecastMinor === null ? (
            <span className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t('budgets.forecast_none', 'داده کافی نیست')}
            </span>
          ) : (
            <Money minor={row.performance.forecastMinor} tone="muted" />
          ),
      },
      {
        id: 'variance',
        labelKey: 'budgets.variance_amount',
        labelFallback: 'انحراف',
        align: 'end',
        showFrom: 'md',
        sortValue: (row) => row.performance.varianceMinor,
        // Already favourable-positive from the server, for both types.
        render: (row) => <Money minor={row.performance.varianceMinor} signed tone="auto" />,
      },
      {
        id: 'state',
        labelKey: 'common.status',
        labelFallback: 'وضعیت',
        sortValue: (row) => row.performance.state,
        render: (row) => <RowBadges t={t} row={row} />,
      },
    ],
    [accountName, date, t],
  )

  const expense = report?.totals.expense
  const revenue = report?.totals.revenue
  const hasExpense =
    (expense?.budgetMinor ?? 0) > 0 || (report?.rows ?? []).some((r) => r.budget.type === 'expense')
  const atRisk = (report?.rows ?? []).filter(
    (r) =>
      r.budget.status === 'approved' &&
      (r.performance.state === 'over' ||
        r.performance.state === 'warning' ||
        r.performance.state === 'forecast_overrun'),
  )

  // Plan vs actual, summed over approved EXPENSE budgets that share sub-period
  // starts. Summing is presentation of server figures, not a new calculation.
  const chartData = useMemo(() => {
    const byStart = new Map<string, { plan: number; actual: number }>()
    for (const row of report?.rows ?? []) {
      if (row.budget.status !== 'approved' || row.budget.type !== 'expense') continue
      for (const point of row.series) {
        const entry = byStart.get(point.start) ?? { plan: 0, actual: 0 }
        entry.plan += point.planMinor
        entry.actual += point.actualMinor
        byStart.set(point.start, entry)
      }
    }
    return [...byStart.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([start, v]) => ({
        label: date(start, { month: 'short' }),
        plan: v.plan / 100,
        actual: v.actual / 100,
      }))
  }, [date, report])

  const allocation = useMemo(() => {
    const byAccount = new Map<string, { budget: number; actual: number; over: boolean }>()
    for (const row of report?.rows ?? []) {
      if (row.budget.status !== 'approved' || row.budget.type !== 'expense') continue
      const entry = byAccount.get(row.budget.accountId) ?? { budget: 0, actual: 0, over: false }
      entry.budget += row.performance.budgetMinor
      entry.actual += row.performance.actualMinor
      entry.over = entry.over || row.performance.state === 'over'
      byAccount.set(row.budget.accountId, entry)
    }
    const total = [...byAccount.values()].reduce((s, v) => s + v.budget, 0)
    return [...byAccount.entries()]
      .map(([accountId, v]) => ({ accountId, ...v, share: total > 0 ? v.budget / total : 0 }))
      .sort((a, b) => b.budget - a.budget)
  }, [report])

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('budgets.title', 'بودجه‌ها')}
        description={t(
          'budgets.subtitle_plan',
          'برنامه‌ریزی، کنترل و پیش‌بینی هزینه‌ها و درآمدهای کسب‌وکار',
        )}
        action={
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="quiet" onClick={props.onRefresh} disabled={isLoading}>
              {t('common.refresh', 'تازه‌سازی')}
            </ActionButton>
            {props.canManage ? (
              <ActionButton onClick={() => setCreating(true)} className="min-h-11">
                <Plus className="size-4" aria-hidden="true" />
                {t('budgets.new', 'بودجه جدید')}
              </ActionButton>
            ) : null}
          </div>
        }
      />

      {props.actionError ? <ErrorNote message={props.actionError} /> : null}

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <SegmentedFilter
          label={t('budgets.type', 'نوع')}
          value={filters.type}
          onChange={(type) => onFiltersChange({ ...filters, type })}
          options={[
            { value: 'all', label: t('common.all', 'همه') },
            { value: 'expense', label: t('budgets.type_expense', 'هزینه') },
            { value: 'revenue', label: t('budgets.type_revenue', 'درآمد') },
          ]}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:flex-1">
          <SelectField
            label={t('common.status', 'وضعیت')}
            value={filters.status}
            onChange={(status) =>
              onFiltersChange({ ...filters, status: status as BudgetFilters['status'] })
            }
            options={[
              { value: 'all', label: t('common.all', 'همه') },
              ...(['draft', 'pending_approval', 'approved', 'archived'] as const).map((s) => ({
                value: s,
                label: t(`budgets.status_${s}`, s),
              })),
            ]}
          />
          {props.branches.length > 0 ? (
            <SelectField
              label={t('budgets.branch', 'شعبه')}
              value={filters.branchId || 'all'}
              onChange={(branchId) =>
                onFiltersChange({ ...filters, branchId: branchId === 'all' ? '' : branchId })
              }
              options={[
                { value: 'all', label: t('common.all', 'همه') },
                ...props.branches.map((b) => ({ value: b.id, label: b.name })),
              ]}
            />
          ) : null}
          <Field
            label={t('budgets.on_date', 'تا تاریخ')}
            type="date"
            dir="ltr"
            value={filters.onDate}
            onChange={(onDate) => onDate && onFiltersChange({ ...filters, onDate })}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorNote
          message={error}
          onRetry={props.onRefresh}
          retryLabel={t('common.retry', 'تلاش دوباره')}
        />
      ) : report ? (
        <>
          {hasExpense && expense ? (
            <section
              aria-label={t('budgets.kpi_expense', 'بودجه‌ی هزینه')}
              className="grid grid-cols-2 gap-3 lg:grid-cols-5"
            >
              <Stat
                icon={Wallet}
                label={t('budgets.kpi_total', 'کل بودجه')}
                value={<Money minor={expense.budgetMinor} />}
              />
              <Stat
                icon={TrendingUp}
                label={t('budgets.actual', 'مصرف‌شده')}
                value={<Money minor={expense.actualMinor} />}
              />
              <Stat
                icon={CircleDashed}
                label={t('budgets.committed', 'تعهدشده')}
                value={<Money minor={expense.openCommitmentMinor} />}
              />
              <Stat
                icon={expense.remainingMinor < 0 ? AlertTriangle : CheckCircle2}
                label={t('budgets.remaining', 'باقی‌مانده')}
                value={
                  <Money
                    minor={expense.remainingMinor}
                    tone={expense.remainingMinor < 0 ? 'bad' : undefined}
                  />
                }
                hint={
                  expense.remainingMinor < 0 ? t('budgets.state_over', 'بیش از بودجه') : undefined
                }
              />
              <Stat
                icon={TrendingUp}
                label={t('budgets.kpi_forecast', 'پیش‌بینی پایان دوره')}
                value={
                  expense.forecastMinor === null ? (
                    <span className="text-sm text-[hsl(var(--fg-tertiary))]">
                      {t('budgets.forecast_none', 'داده کافی نیست')}
                    </span>
                  ) : (
                    <Money
                      minor={expense.forecastMinor}
                      tone={expense.forecastMinor > expense.budgetMinor ? 'bad' : undefined}
                    />
                  )
                }
                hint={
                  expense.forecastMinor !== null && expense.forecastMinor > expense.budgetMinor
                    ? t('budgets.state_forecast_overrun', 'پیش‌بینی: عبور از بودجه')
                    : undefined
                }
              />
            </section>
          ) : null}

          {revenue && revenue.budgetMinor > 0 ? (
            <section
              aria-label={t('budgets.kpi_revenue', 'هدف درآمد')}
              className="grid grid-cols-2 gap-3 lg:grid-cols-4"
            >
              <Stat
                label={t('budgets.kpi_revenue_target', 'هدف درآمد')}
                value={<Money minor={revenue.budgetMinor} />}
              />
              <Stat
                label={t('budgets.kpi_revenue_actual', 'درآمد محقق‌شده')}
                value={<Money minor={revenue.actualMinor} />}
              />
              <Stat
                label={t('budgets.kpi_revenue_gap', 'تا هدف')}
                value={<Money minor={Math.max(0, revenue.remainingMinor)} />}
              />
              <Stat
                label={t('budgets.kpi_forecast', 'پیش‌بینی پایان دوره')}
                value={
                  revenue.forecastMinor === null ? (
                    <span className="text-sm text-[hsl(var(--fg-tertiary))]">
                      {t('budgets.forecast_none', 'داده کافی نیست')}
                    </span>
                  ) : (
                    <Money minor={revenue.forecastMinor} />
                  )
                }
              />
            </section>
          ) : null}

          {atRisk.length > 0 ? (
            <div
              role="status"
              className="rounded-xl border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.08)] p-3 text-sm"
            >
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                {t('budgets.at_risk', 'بودجه‌های در معرض خطر')}:{' '}
                <span className="tabular-nums">{atRisk.length}</span>
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {atRisk.slice(0, 6).map((row) => (
                  <li key={row.budget.id}>
                    <button
                      type="button"
                      onClick={() => props.onSelect(row.budget.id)}
                      className="min-h-9 rounded-lg bg-[hsl(var(--surface-elevated))] px-2.5 text-xs underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.5)]"
                    >
                      {row.budget.name || accountName(row.budget.accountId)} ·{' '}
                      {t(`budgets.state_${row.performance.state}`, row.performance.state)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {report.rows.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-5">
              <Panel
                className="lg:col-span-3"
                title={t('budgets.chart_title', 'برنامه در برابر مصرف')}
                description={
                  report.source === 'per_budget'
                    ? t(
                        'budgets.chart_needs_migration',
                        'تفکیک ماهانه پس از اجرای مهاجرت بودجه در دسترس است.',
                      )
                    : t('budgets.chart_hint', 'بودجه‌های تأییدشده‌ی هزینه، به تفکیک زیردوره.')
                }
              >
                {chartData.length > 0 && report.source === 'batch' ? (
                  <div className="-mx-2 overflow-x-auto px-2">
                    <div className={chartData.length > 6 ? 'min-w-[560px]' : undefined}>
                      <BudgetChart
                        data={chartData}
                        planLabel={t('budgets.plan', 'برنامه')}
                        actualLabel={t('budgets.actual', 'مصرف‌شده')}
                        fmt={(v) => formatSelectedMoney(v)}
                        height={260}
                      />
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon="search"
                    title={t('budgets.chart_empty', 'داده‌ای برای نمودار نیست')}
                  />
                )}
              </Panel>

              <Panel
                className="lg:col-span-2"
                title={t('budgets.allocation', 'توزیع بودجه به تفکیک حساب')}
              >
                {allocation.length === 0 ? (
                  <EmptyState
                    icon="search"
                    title={t('budgets.chart_empty', 'داده‌ای برای نمودار نیست')}
                  />
                ) : (
                  <ul className="space-y-3">
                    {allocation.slice(0, 8).map((a) => (
                      <li key={a.accountId}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate">{accountName(a.accountId)}</span>
                          <span
                            className="shrink-0 tabular-nums text-xs text-[hsl(var(--fg-tertiary))]"
                            dir="ltr"
                          >
                            {Math.round(a.share * 100)}%
                          </span>
                        </div>
                        <div
                          className="mt-1 h-2 overflow-hidden rounded-full bg-[hsl(var(--surface-muted))]"
                          role="img"
                          aria-label={`${accountName(a.accountId)} ${Math.round(a.share * 100)}%`}
                        >
                          <div
                            className={
                              a.over
                                ? 'h-full bg-[hsl(var(--color-destructive))]'
                                : 'h-full bg-[hsl(var(--color-primary))]'
                            }
                            style={{ inlineSize: `${Math.max(2, Math.round(a.share * 100))}%` }}
                          />
                        </div>
                        <div className="mt-1 flex justify-between gap-2 text-xs">
                          <Money minor={a.budget} tone="muted" />
                          {a.over ? (
                            <Badge tone="bad">{t('budgets.state_over', 'بیش از بودجه')}</Badge>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          ) : null}

          <ListSection title={t('budgets.list', 'بودجه‌ها')}>
            {report.rows.length === 0 ? (
              <EmptyState
                icon="search"
                title={t('budgets.empty_title', 'بودجه‌ای تعریف نشده')}
                description={t(
                  'budgets.empty_hint_create',
                  'اولین بودجه را روی یک حساب هزینه یا درآمد بسازید.',
                )}
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <DataTable
                    tableId="budgets-performance"
                    t={t}
                    rows={rows}
                    columns={columns}
                    rowKey={(row) => row.budget.id}
                    onRowClick={(row) => props.onSelect(row.budget.id)}
                    searchValue={search}
                    onSearchChange={setSearch}
                    minWidthClass="min-w-[720px]"
                    emptyState={
                      <EmptyState
                        icon="search"
                        title={t('budgets.no_match', 'بودجه‌ای با این فیلتر نیست')}
                      />
                    }
                  />
                </div>
                <div className="space-y-3 md:hidden">
                  <Field label={t('common.search', 'جستجو')} value={search} onChange={setSearch} />
                  {rows.length === 0 ? (
                    <EmptyState
                      icon="search"
                      title={t('budgets.no_match', 'بودجه‌ای با این فیلتر نیست')}
                    />
                  ) : (
                    rows.map((row) => (
                      <button
                        key={row.budget.id}
                        type="button"
                        onClick={() => props.onSelect(row.budget.id)}
                        className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.5)]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate font-medium">
                            {row.budget.name || accountName(row.budget.accountId)}
                          </p>
                          <RowBadges t={t} row={row} />
                        </div>
                        <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <MiniFigure
                            label={t('budgets.budget', 'بودجه')}
                            minor={row.performance.budgetMinor}
                          />
                          <MiniFigure
                            label={t('budgets.actual', 'مصرف‌شده')}
                            minor={row.performance.actualMinor}
                          />
                          <MiniFigure
                            label={t('budgets.remaining', 'باقی‌مانده')}
                            minor={row.performance.remainingMinor}
                          />
                        </dl>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </ListSection>
        </>
      ) : null}

      <SpendCheck
        t={t}
        accounts={accounts}
        isBusy={props.isBusy}
        result={props.checkResult}
        onCheck={props.onCheckSpend}
        onDate={filters.onDate}
      />

      <Sheet open={selected !== null} onOpenChange={(open) => !open && props.onSelect(null)}>
        <SheetContent side="end" className="w-full overflow-y-auto sm:max-w-lg">
          {selected ? (
            <BudgetDetail
              t={t}
              row={selected}
              accountName={accountName}
              canManage={props.canManage}
              canApprove={props.canApprove}
              isBusy={props.isBusy}
              revisions={props.revisions}
              isRevisionsLoading={props.isRevisionsLoading}
              onSubmit={props.onSubmit}
              onApprove={props.onApprove}
              onArchive={props.onArchive}
              onRevise={props.onRevise}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent side="end" className="w-full overflow-y-auto sm:max-w-lg">
          <CreateBudget
            t={t}
            accounts={accounts}
            branches={props.branches}
            isBusy={props.isBusy}
            onDate={filters.onDate}
            onSave={(input) => {
              props.onSave({ ...input, id: props.newId() })
              setCreating(false)
            }}
          />
        </SheetContent>
      </Sheet>
    </CapabilityPage>
  )
})

BudgetsView.displayName = 'BudgetsView'

function RowBadges({ t, row }: { t: Translate; row: BudgetReportRow }) {
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {row.budget.status !== 'approved' ? (
        <Badge tone={STATUS_TONE[row.budget.status]}>
          {t(`budgets.status_${row.budget.status}`, row.budget.status)}
        </Badge>
      ) : (
        <Badge tone={STATE_TONE[row.performance.state]}>
          {t(`budgets.state_${row.performance.state}`, row.performance.state)}
        </Badge>
      )}
    </span>
  )
}

function MiniFigure({ label, minor }: { label: string; minor: number }) {
  return (
    <div className="min-w-0">
      <dt className="text-[hsl(var(--fg-tertiary))]">{label}</dt>
      <dd className="truncate">
        <Money minor={minor} tone={minor < 0 ? 'bad' : undefined} />
      </dd>
    </div>
  )
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-[hsl(var(--surface-muted)/0.4)] p-2.5">
      <dt className="text-xs text-[hsl(var(--fg-tertiary))]">{label}</dt>
      <dd className="mt-0.5 truncate text-sm">{children}</dd>
    </div>
  )
}

function BudgetDetail({
  t,
  row,
  accountName,
  canManage,
  canApprove,
  isBusy,
  revisions,
  isRevisionsLoading,
  onSubmit,
  onApprove,
  onArchive,
  onRevise,
}: {
  t: Translate
  row: BudgetReportRow
  accountName: (id: string) => string
  canManage: boolean
  canApprove: boolean
  isBusy: boolean
  revisions: BudgetRevisionRow[]
  isRevisionsLoading: boolean
  onSubmit: (id: string) => void
  onApprove: (id: string) => void
  onArchive: (id: string) => void
  onRevise: BudgetsViewProps['onRevise']
}) {
  const { date, dateTime } = useDateFormat()
  const { budget, performance: p } = row
  const [reviseAmount, setReviseAmount] = useState(budget.amountMinor)
  const [reason, setReason] = useState('')

  // Why is it in this state — in words, from the server's figures.
  const why =
    p.state === 'over'
      ? t('budgets.why_over', 'مصرف‌شده به‌علاوه‌ی تعهدها از بودجه بیشتر است.')
      : p.state === 'warning' || p.state === 'near_limit'
        ? t('budgets.why_warning', 'مصرف‌شده و تعهدها به آستانه‌ی هشدار رسیده‌اند.')
        : p.state === 'forecast_overrun'
          ? budget.type === 'expense'
            ? t(
                'budgets.why_forecast_expense',
                'با روند فعلی، هزینه تا پایان دوره از بودجه عبور می‌کند.',
              )
            : t('budgets.why_forecast_revenue', 'با روند فعلی، درآمد تا پایان دوره به هدف نمی‌رسد.')
          : null

  return (
    <div className="space-y-5">
      <SheetHeader>
        <SheetTitle>{budget.name || accountName(budget.accountId)}</SheetTitle>
        <SheetDescription>
          {accountName(budget.accountId)} · {t(`budgets.type_${budget.type}`, budget.type)} ·{' '}
          {date(row.periodStart)} – {date(row.periodEnd)}
        </SheetDescription>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={STATUS_TONE[budget.status]}>
            {t(`budgets.status_${budget.status}`, budget.status)}
          </Badge>
          <Badge tone={STATE_TONE[p.state]}>{t(`budgets.state_${p.state}`, p.state)}</Badge>
          <Badge tone="neutral">{t(`budgets.action_${budget.action}`, budget.action)}</Badge>
          <Badge tone="neutral">
            {t('budgets.version', 'نسخه')} {budget.version}
          </Badge>
        </div>
      </SheetHeader>

      {why ? (
        <p role="status" className="rounded-lg bg-[hsl(var(--color-warning)/0.1)] p-3 text-sm">
          {why}
        </p>
      ) : null}

      <section aria-labelledby="budget-overview">
        <h3 id="budget-overview" className="mb-2 text-sm font-semibold">
          {t('budgets.overview', 'خلاصه')}
        </h3>
        <dl className="grid grid-cols-2 gap-2">
          <Figure label={t('budgets.budget', 'بودجه')}>
            <Money minor={p.budgetMinor} />
          </Figure>
          <Figure label={t('budgets.theoretical', 'برنامه تا امروز')}>
            <Money minor={p.theoreticalMinor} />
          </Figure>
          <Figure label={t('budgets.actual', 'مصرف‌شده')}>
            <Money minor={p.actualMinor} />
          </Figure>
          {budget.type === 'expense' ? (
            <Figure label={t('budgets.committed', 'تعهدشده')}>
              <Money minor={p.openCommitmentMinor} />
            </Figure>
          ) : null}
          <Figure label={t('budgets.remaining', 'باقی‌مانده')}>
            <Money minor={p.remainingMinor} tone={p.remainingMinor < 0 ? 'bad' : undefined} />
          </Figure>
          <Figure label={t('budgets.variance_amount', 'انحراف')}>
            <Money minor={p.varianceMinor} signed tone="auto" />
          </Figure>
          <Figure label={t('budgets.variance_to_date', 'انحراف تا امروز')}>
            <Money minor={p.varianceToDateMinor} signed tone="auto" />
          </Figure>
          <Figure label={t('budgets.forecast', 'پیش‌بینی')}>
            {p.forecastMinor === null ? (
              t('budgets.forecast_none', 'داده کافی نیست')
            ) : (
              <Money minor={p.forecastMinor} />
            )}
          </Figure>
        </dl>
        <p className="mt-2 text-xs text-[hsl(var(--fg-tertiary))]">
          {t(`budgets.forecast_method_${p.forecastMethod}`, p.forecastMethod)}
        </p>
      </section>

      <section aria-labelledby="budget-distribution">
        <h3 id="budget-distribution" className="mb-2 text-sm font-semibold">
          {t('budgets.distribution', 'توزیع')} ·{' '}
          {t(`budgets.distribution_${row.distributionKind}`, row.distributionKind)}
        </h3>
        {row.distributionMismatch ? (
          <p className="mb-2 text-xs text-[hsl(var(--color-destructive))]">
            {t(
              'budgets.distribution_mismatch',
              'توزیع ذخیره‌شده با مبلغ یا زیردوره‌ها نمی‌خواند؛ تقسیم برابر نمایش داده می‌شود.',
            )}
          </p>
        ) : null}
        <ul className="divide-y divide-[hsl(var(--border-default))] text-sm">
          {row.series.map((point) => (
            <li key={point.start} className="flex items-center justify-between gap-2 py-1.5">
              <span>{date(point.start, { month: 'long', year: 'numeric' })}</span>
              <span className="flex gap-3">
                <Money minor={point.planMinor} tone="muted" />
                <Money minor={point.actualMinor} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="budget-approval" className="space-y-2">
        <h3 id="budget-approval" className="text-sm font-semibold">
          {t('budgets.approval', 'تصویب')}
        </h3>
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {budget.approvedAt
            ? `${t('budgets.approved_at', 'تصویب شده در')} ${dateTime(budget.approvedAt)}`
            : budget.status === 'approved'
              ? t('budgets.approved_unknown', 'تصویب‌کننده ثبت نشده (بودجه‌ی پیش از مهاجرت)')
              : t('budgets.not_approved', 'هنوز تصویب نشده')}
        </p>
        <div className="flex flex-wrap gap-2">
          {canManage && budget.status === 'draft' ? (
            <ActionButton variant="quiet" disabled={isBusy} onClick={() => onSubmit(budget.id)}>
              {t('budgets.submit', 'ارسال برای تصویب')}
            </ActionButton>
          ) : null}
          {canApprove && (budget.status === 'draft' || budget.status === 'pending_approval') ? (
            <ActionButton disabled={isBusy} onClick={() => onApprove(budget.id)}>
              {t('budgets.approve', 'تصویب')}
            </ActionButton>
          ) : null}
          {canApprove && budget.status !== 'archived' ? (
            <ActionButton variant="danger" disabled={isBusy} onClick={() => onArchive(budget.id)}>
              {t('budgets.archive', 'بایگانی')}
            </ActionButton>
          ) : null}
        </div>
      </section>

      {canApprove && budget.status === 'approved' ? (
        <section aria-labelledby="budget-revise" className="space-y-3">
          <h3 id="budget-revise" className="text-sm font-semibold">
            {t('budgets.revise', 'اصلاحیه')}
          </h3>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">
            {t(
              'budgets.revise_hint',
              'نسخه‌ی فعلی در تاریخچه می‌ماند؛ اسناد ثبت‌شده تغییر نمی‌کنند.',
            )}
          </p>
          <MinorInput
            label={t('budgets.new_amount', 'مبلغ جدید')}
            value={reviseAmount}
            onChange={setReviseAmount}
            disabled={isBusy}
          />
          <Field
            label={t('budgets.reason', 'دلیل اصلاح')}
            value={reason}
            onChange={setReason}
            disabled={isBusy}
          />
          {reviseAmount !== budget.amountMinor ? (
            <p className="text-xs">
              <Money minor={budget.amountMinor} tone="muted" /> → <Money minor={reviseAmount} />
            </p>
          ) : null}
          <ActionButton
            disabled={
              isBusy ||
              reason.trim().length < 3 ||
              reviseAmount === budget.amountMinor ||
              reviseAmount < 0
            }
            onClick={() =>
              onRevise({
                id: budget.id,
                expectedVersion: budget.version,
                amountMinor: reviseAmount,
                reason: reason.trim(),
              })
            }
          >
            {t('budgets.revise_action', 'ثبت اصلاحیه')}
          </ActionButton>
        </section>
      ) : null}

      <section aria-labelledby="budget-revisions">
        <h3 id="budget-revisions" className="mb-2 text-sm font-semibold">
          {t('budgets.revisions', 'تاریخچه‌ی اصلاحیه‌ها')}
        </h3>
        {isRevisionsLoading ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : revisions.length === 0 ? (
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">
            {t('budgets.revisions_empty', 'اصلاحیه‌ای ثبت نشده')}
          </p>
        ) : (
          <ol className="space-y-2">
            {revisions.map((rev) => (
              <li
                key={rev.id}
                className="rounded-lg border border-[hsl(var(--border-default))] p-2.5 text-xs"
              >
                <p className="font-medium">
                  {t('budgets.version', 'نسخه')} {rev.previous_version} → {rev.version} ·{' '}
                  {dateTime(rev.created_at)}
                </p>
                <p className="mt-1 text-[hsl(var(--fg-secondary))]">{rev.reason}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function CreateBudget({
  t,
  accounts,
  branches,
  isBusy,
  onDate,
  onSave,
}: {
  t: Translate
  accounts: Account[]
  branches: Array<{ id: string; name: string }>
  isBusy: boolean
  onDate: string
  onSave: (input: Omit<SaveBudgetInput, 'id'>) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<BudgetType>('expense')
  const [accountId, setAccountId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('yearly')
  const [startsOn, setStartsOn] = useState(onDate.slice(0, 8) + '01')
  const [amountMinor, setAmountMinor] = useState(0)
  // The currency the amount is TYPED in. The server converts to the ledger's
  // base currency at the workspace's own rate for the period start.
  const [currency, setCurrency] = useState<'AFN' | 'USD' | 'PKR' | 'IRR'>('AFN')
  const intlLocale = useIntlLocale()
  const [action, setAction] = useState<BudgetAction>('warn')
  const [warnAtPercent, setWarnAtPercent] = useState(80)
  const [custom, setCustom] = useState(false)
  const months = period === 'monthly' ? 1 : period === 'quarterly' ? 3 : 12
  const [weightsPct, setWeightsPct] = useState<number[]>(() => Array.from({ length: 12 }, () => 0))

  const eligible = accounts.filter(
    (a) =>
      !a.isGroup &&
      a.isActive &&
      (type === 'revenue' ? a.type === 'revenue' : a.type !== 'revenue'),
  )
  const weights = weightsPct.slice(0, months)
  // Two-decimal percentages → basis points; the server re-validates the 100%.
  const bp = weights.map((w) => Math.round(w * 100))
  const bpTotal = bp.reduce((s, x) => s + x, 0)
  const valid =
    accountId !== '' &&
    amountMinor >= 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(startsOn) &&
    (!custom || bpTotal === 10_000)

  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle>{t('budgets.new', 'بودجه جدید')}</SheetTitle>
        <SheetDescription>
          {t('budgets.new_hint', 'بودجه به‌صورت پیش‌نویس ذخیره می‌شود و پس از تصویب کنترل می‌کند.')}
        </SheetDescription>
      </SheetHeader>

      <Field label={t('budgets.name', 'عنوان')} value={name} onChange={setName} disabled={isBusy} />
      <SegmentedFilter
        label={t('budgets.type', 'نوع')}
        value={type}
        onChange={(next) => {
          setType(next)
          setAccountId('')
        }}
        options={[
          { value: 'expense', label: t('budgets.type_expense', 'هزینه') },
          { value: 'revenue', label: t('budgets.type_revenue', 'درآمد') },
        ]}
      />
      <SelectField
        label={t('budgets.account', 'حساب')}
        value={accountId}
        onChange={setAccountId}
        placeholder={t('budgets.pick_account', 'یک حساب انتخاب کنید')}
        options={eligible.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))}
        disabled={isBusy}
      />
      {branches.length > 0 ? (
        <SelectField
          label={t('budgets.branch', 'شعبه')}
          value={branchId || 'all'}
          onChange={(v) => setBranchId(v === 'all' ? '' : v)}
          options={[
            { value: 'all', label: t('budgets.branch_all', 'همه‌ی شعب') },
            ...branches.map((b) => ({ value: b.id, label: b.name })),
          ]}
          disabled={isBusy}
        />
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          label={t('budgets.period', 'دوره')}
          value={period}
          onChange={(v) => setPeriod(v as typeof period)}
          options={(['monthly', 'quarterly', 'yearly'] as const).map((v) => ({
            value: v,
            label: t(`budgets.period_${v}`, v),
          }))}
          disabled={isBusy}
        />
        <Field
          label={t('budgets.starts_on', 'شروع دوره')}
          type="date"
          dir="ltr"
          value={startsOn}
          onChange={setStartsOn}
          disabled={isBusy}
        />
      </div>
      <SelectField
        label={t('budgets.currency', 'ارز بودجه')}
        value={currency}
        onChange={(v) => setCurrency(v as typeof currency)}
        options={(['AFN', 'USD', 'PKR', 'IRR'] as const).map((code) => ({
          value: code,
          label: t(`budgets.currency_${code}`, code),
        }))}
        disabled={isBusy}
      />
      {currency !== 'AFN' ? (
        <p className="-mt-2 text-xs text-[hsl(var(--fg-tertiary))]">
          {t(
            'budgets.currency_hint',
            'مبلغ با نرخ ثبت‌شده‌ی همین کسب‌وکار در تاریخ شروع دوره به افغانی تبدیل و کنترل می‌شود؛ مبلغ و نرخ اصلی نگهداری می‌شوند.',
          )}
        </p>
      ) : null}
      <MinorInput
        label={`${t('budgets.amount_total', 'مبلغ کل دوره')} (${currency})`}
        value={amountMinor}
        onChange={setAmountMinor}
        disabled={isBusy}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          label={t('budgets.action', 'رفتار کنترلی')}
          value={action}
          onChange={(v) => setAction(v as BudgetAction)}
          options={(['warn', 'block', 'approval', 'track'] as const).map((v) => ({
            value: v,
            label: t(`budgets.action_${v}`, v),
          }))}
          disabled={isBusy}
        />
        <NumberField
          label={t('budgets.warn_at', 'آستانه‌ی هشدار (٪)')}
          value={warnAtPercent}
          onChange={setWarnAtPercent}
          min={0}
          max={100}
          disabled={isBusy}
        />
      </div>

      {months > 1 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('budgets.distribution', 'توزیع')}</legend>
          <SegmentedFilter
            label={t('budgets.distribution', 'توزیع')}
            value={custom ? 'custom' : 'equal'}
            onChange={(v) => setCustom(v === 'custom')}
            options={[
              { value: 'equal', label: t('budgets.distribution_equal', 'برابر') },
              { value: 'custom', label: t('budgets.distribution_custom', 'دستی (درصد)') },
            ]}
          />
          {custom ? (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {weights.map((w, i) => (
                  <NumberField
                    key={i}
                    label={`${t('budgets.sub_period', 'زیردوره')} ${i + 1}`}
                    value={w}
                    min={0}
                    max={100}
                    onChange={(value) =>
                      setWeightsPct((prev) => prev.map((x, j) => (j === i ? value : x)))
                    }
                    disabled={isBusy}
                  />
                ))}
              </div>
              <p
                className={
                  bpTotal === 10_000
                    ? 'text-xs text-[hsl(var(--fg-tertiary))]'
                    : 'text-xs text-[hsl(var(--color-destructive))]'
                }
                role="status"
              >
                {t('budgets.distribution_total', 'جمع درصدها')}:{' '}
                <span dir="ltr" className="tabular-nums">
                  {bpTotal / 100}%
                </span>
              </p>
            </>
          ) : null}
        </fieldset>
      ) : null}

      <div className="rounded-lg bg-[hsl(var(--surface-muted)/0.4)] p-3 text-xs">
        <p className="font-medium">{t('budgets.preview', 'پیش‌نمایش')}</p>
        <p className="mt-1">
          {t('budgets.amount_total', 'مبلغ کل دوره')}:{' '}
          <span dir="ltr" className="tabular-nums font-medium">
            {formatMoney(amountMinor / 100, currency, intlLocale)}
          </span>{' '}
          · {t(`budgets.action_${action}`, action)} · {t('budgets.status_draft', 'پیش‌نویس')}
        </p>
        <p className="mt-1 text-[hsl(var(--fg-tertiary))]">
          {t(
            'budgets.preview_server',
            'تقسیم دقیق به ریال/افغانی و بررسی هم‌پوشانی هنگام ذخیره و تصویب روی سرور انجام می‌شود.',
          )}
        </p>
      </div>

      <ActionButton
        className="min-h-11 w-full"
        disabled={isBusy || !valid}
        onClick={() =>
          onSave({
            accountId,
            branchId: branchId || null,
            dimensionValueId: null,
            period,
            startsOn,
            amountMinor,
            action,
            warnAtPercent,
            isActive: true,
            name: name.trim() || null,
            type,
            currency,
            distributionWeightsBp: custom && months > 1 ? bp : null,
          })
        }
      >
        {t('budgets.save_draft', 'ذخیره‌ی پیش‌نویس')}
      </ActionButton>
    </div>
  )
}

function SpendCheck({
  t,
  accounts,
  isBusy,
  result,
  onCheck,
  onDate,
}: {
  t: Translate
  accounts: Account[]
  isBusy: boolean
  result: BudgetCheck | null
  onCheck: BudgetsViewProps['onCheckSpend']
  onDate: string
}) {
  const [accountId, setAccountId] = useState('')
  const [amountMinor, setAmountMinor] = useState(0)

  return (
    <Panel
      title={t('budgets.check_title', 'بررسی یک هزینه')}
      description={t('budgets.check_hint', 'پیش از تعهد پول پرسیده می‌شود، نه بعد از آن.')}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
        <SelectField
          label={t('budgets.account', 'حساب')}
          value={accountId}
          onChange={setAccountId}
          placeholder={t('budgets.pick_account', 'یک حساب انتخاب کنید')}
          options={accounts
            .filter((a) => !a.isGroup && a.isActive)
            .map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))}
          disabled={isBusy}
        />
        <MinorInput
          label={t('budgets.amount_to_spend', 'مبلغ')}
          value={amountMinor}
          onChange={setAmountMinor}
          disabled={isBusy}
        />
        <ActionButton
          className="min-h-11 self-end"
          disabled={isBusy || accountId === '' || amountMinor <= 0}
          onClick={() => onCheck({ accountId, amountMinor, onDate })}
        >
          {t('budgets.check_action', 'بررسی')}
        </ActionButton>
      </div>
      {result ? (
        <div className="mt-4 space-y-2 text-sm" role="status">
          <Badge
            tone={
              result.decision === 'block'
                ? 'bad'
                : result.decision === 'require_approval' || result.decision === 'warn'
                  ? 'warn'
                  : 'good'
            }
          >
            {t(
              `budgets.decision_${result.decision ?? (result.allowed ? 'allow' : 'block')}`,
              result.decision ?? '',
            )}
          </Badge>
          {(result.impacts ?? [])
            .filter((i) => i.exceeds)
            .map((i) => (
              <p key={i.budgetId} className="text-xs">
                {t('budgets.available', 'قابل استفاده')}: <Money minor={i.availableMinor} /> ·{' '}
                {t('budgets.exceeded_by', 'بیش از سقف')}:{' '}
                <Money minor={i.exceededByMinor} tone="bad" />
              </p>
            ))}
        </div>
      ) : null}
    </Panel>
  )
}
