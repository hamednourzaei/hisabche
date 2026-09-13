'use client'

// ============================================
// packages/ui/src/components/ui/budgets/budgets-view.tsx
//
// Budgets.
//
// ---------------------------------------------------------------------------
// TWO DIFFERENT QUESTIONS, DELIBERATELY NOT MIXED
//
// The variance table answers "what happened": budget against actual, per
// period. Committed money is absent from it on purpose — a purchase order that
// was never received did not happen, and putting it in a historical report
// makes the history wrong.
//
// The spend check answers "may I": budget − actual − COMMITTED, asked before
// the money is promised. That ordering is the whole difference between a
// control and a report. A budget discovered at month end cannot stop anything.
//
// ---------------------------------------------------------------------------
// LAYOUT — the invoices list structure: header, active filter, stat strip,
// the budgets on the shared DataTable, the spend check, then the variance
// history on a second DataTable.
// ============================================

import { memo, useMemo, useState } from 'react'
import { CheckCircle2, ListChecks, ShieldAlert, TrendingUp } from 'lucide-react'
import type { Budget, BudgetCheck, VarianceRow } from '@hisabche/api'

import { useDateFormat } from '../../../hooks/use-date-format'
import { DataTable, matchesSearch, type TableColumn } from '../data-table'
import { SegmentedFilter } from '../segmented-filter'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  ErrorNote,
  Field,
  ListSection,
  Loading,
  MinorInput,
  Money,
  Panel,
  Stat,
  StatGrid,
} from '../capability/capability-kit'

export interface BudgetsViewProps {
  t: (key: string, fallback?: string) => string
  budgets: Budget[]
  variance: VarianceRow[]
  isLoading: boolean
  /** The variance read is separate; its failure must not look like «no history». */
  isVarianceLoading: boolean
  varianceError: string | null
  error: string | null
  actionError: string | null
  isBusy: boolean
  checkResult: BudgetCheck | null
  onCheckSpend: (input: { accountId: string; amountMinor: number; onDate: string }) => void
  onRefresh: () => void
}

const STATE_TONE: Record<string, string | undefined> = {
  ok: 'good',
  warning: 'warn',
  exceeded: 'bad',
}

type ActiveFilter = 'all' | 'active' | 'inactive'

export const BudgetsView = memo(function BudgetsView({
  t,
  budgets,
  variance,
  isLoading,
  isVarianceLoading,
  varianceError,
  error,
  actionError,
  isBusy,
  checkResult,
  onCheckSpend,
  onRefresh,
}: BudgetsViewProps) {
  const { date } = useDateFormat()
  const [accountId, setAccountId] = useState('')
  const [amountMinor, setAmountMinor] = useState(0)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [search, setSearch] = useState('')
  const [varianceSearch, setVarianceSearch] = useState('')

  const today = new Date().toISOString().slice(0, 10)

  const rows = useMemo(
    () =>
      budgets
        .filter((budget) =>
          activeFilter === 'all'
            ? true
            : activeFilter === 'active'
              ? budget.isActive
              : !budget.isActive,
        )
        .filter((budget) =>
          matchesSearch(search, [
            budget.accountId,
            t(`budgets.period_${budget.period}`, budget.period),
            t(`budgets.action_${budget.action}`, budget.action),
          ]),
        ),
    [activeFilter, budgets, search, t],
  )

  const varianceRows = useMemo(
    () =>
      variance.filter((row) =>
        matchesSearch(varianceSearch, [row.accountId, date(row.periodStart)]),
      ),
    [date, variance, varianceSearch],
  )

  const columns = useMemo<TableColumn<Budget>[]>(
    () => [
      {
        id: 'account',
        labelKey: 'budgets.account',
        labelFallback: 'حساب',
        locked: true,
        sortValue: (budget) => budget.accountId,
        render: (budget) => (
          <span className="font-mono text-xs" dir="ltr">
            {budget.accountId.slice(0, 8)}
          </span>
        ),
      },
      {
        id: 'period',
        labelKey: 'budgets.period',
        labelFallback: 'دوره',
        sortValue: (budget) => budget.period,
        render: (budget) => (
          <span className="text-[hsl(var(--fg-secondary))]">
            {t(`budgets.period_${budget.period}`, budget.period)}
          </span>
        ),
      },
      {
        id: 'amount',
        labelKey: 'budgets.amount',
        labelFallback: 'سقف هر دوره',
        align: 'end',
        sortValue: (budget) => budget.amountMinor,
        render: (budget) => <Money minor={budget.amountMinor} />,
      },
      {
        id: 'action',
        labelKey: 'budgets.action',
        labelFallback: 'رفتار',
        showFrom: 'md',
        sortValue: (budget) => budget.action,
        render: (budget) => (
          <Badge
            tone={budget.action === 'block' ? 'bad' : budget.action === 'warn' ? 'warn' : 'neutral'}
          >
            {t(`budgets.action_${budget.action}`, budget.action)}
          </Badge>
        ),
      },
      {
        id: 'status',
        labelKey: 'common.status',
        labelFallback: 'وضعیت',
        sortValue: (budget) => (budget.isActive ? 1 : 0),
        render: (budget) =>
          budget.isActive ? (
            <Badge tone="good">{t('common.active', 'فعال')}</Badge>
          ) : (
            <Badge tone="neutral">{t('common.inactive', 'غیرفعال')}</Badge>
          ),
      },
    ],
    [t],
  )

  const varianceColumns = useMemo<TableColumn<VarianceRow>[]>(
    () => [
      {
        id: 'periodStart',
        labelKey: 'budgets.period_start',
        labelFallback: 'آغاز دوره',
        locked: true,
        sortValue: (row) => row.periodStart,
        render: (row) => <span>{date(row.periodStart)}</span>,
      },
      {
        id: 'budget',
        labelKey: 'budgets.budget',
        labelFallback: 'بودجه',
        align: 'end',
        showFrom: 'md',
        sortValue: (row) => row.budgetMinor,
        render: (row) => <Money minor={row.budgetMinor} tone="muted" />,
      },
      {
        id: 'actual',
        labelKey: 'budgets.actual',
        labelFallback: 'خرج‌شده',
        align: 'end',
        sortValue: (row) => row.actualMinor,
        render: (row) => <Money minor={row.actualMinor} />,
      },
      {
        id: 'variance',
        labelKey: 'budgets.variance_amount',
        labelFallback: 'انحراف',
        align: 'end',
        sortValue: (row) => row.varianceMinor,
        render: (row) => (
          <span>
            {/* Positive is overspend, so the sign is inverted for tone:
                more than budgeted is the bad direction. */}
            <Money minor={row.varianceMinor} signed tone={row.varianceMinor > 0 ? 'bad' : 'good'} />
            {row.variancePercent != null ? (
              <span className="ms-2 text-xs text-[hsl(var(--fg-tertiary))]">
                {Math.round(row.variancePercent)}%
              </span>
            ) : null}
          </span>
        ),
      },
    ],
    [date],
  )

  const activeCount = budgets.filter((budget) => budget.isActive).length
  const blockingCount = budgets.filter((budget) => budget.action === 'block').length
  const overspentCount = variance.filter((row) => row.varianceMinor > 0).length

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('budgets.title', 'بودجه')}
        description={t('budgets.subtitle', 'سقف هزینه به تفکیک حساب و دوره')}
        action={
          <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
            {t('common.refresh', 'تازه‌سازی')}
          </ActionButton>
        }
      />

      {actionError ? <ErrorNote message={actionError} /> : null}

      <SegmentedFilter
        label={t('common.status', 'وضعیت')}
        value={activeFilter}
        onChange={setActiveFilter}
        options={[
          { value: 'all', label: t('common.all', 'همه') },
          { value: 'active', label: t('common.active', 'فعال') },
          { value: 'inactive', label: t('common.inactive', 'غیرفعال') },
        ]}
      />

      {!isLoading && !error && budgets.length > 0 ? (
        <StatGrid>
          <Stat
            icon={ListChecks}
            label={t('budgets.stat_total', 'تعداد بودجه‌ها')}
            value={budgets.length}
          />
          <Stat icon={CheckCircle2} label={t('common.active', 'فعال')} value={activeCount} />
          <Stat
            icon={ShieldAlert}
            label={t('budgets.stat_blocking', 'بودجه‌های مسدودکننده')}
            value={blockingCount}
          />
          {/* Only from a variance read that succeeded — a failed read would
              otherwise report «0 overspent», a reassurance nobody earned. */}
          {!isVarianceLoading && !varianceError ? (
            <Stat
              icon={TrendingUp}
              label={t('budgets.stat_overspent', 'دوره‌های بیش از بودجه')}
              value={overspentCount}
            />
          ) : null}
        </StatGrid>
      ) : null}

      <ListSection title={t('budgets.list', 'بودجه‌ها')}>
        {isLoading ? (
          <Loading label={t('common.loading', 'در حال بارگذاری…')} />
        ) : error ? (
          <ErrorNote
            message={error}
            onRetry={onRefresh}
            retryLabel={t('common.retry', 'تلاش دوباره')}
          />
        ) : (
          <DataTable
            tableId="budgets"
            t={t}
            rows={rows}
            columns={columns}
            rowKey={(budget) => budget.id}
            searchValue={search}
            onSearchChange={setSearch}
            minWidthClass="min-w-[420px] sm:min-w-[640px]"
            emptyState={
              budgets.length === 0 ? (
                <EmptyState
                  icon="search"
                  title={t('budgets.empty_title', 'بودجه‌ای تعریف نشده')}
                  description={t(
                    'budgets.empty_hint',
                    'بودجه از تنظیمات حسابداری، روی یک حساب، تعریف می‌شود.',
                  )}
                />
              ) : (
                <EmptyState
                  icon="search"
                  title={t('budgets.no_match', 'بودجه‌ای با این فیلتر نیست')}
                />
              )
            }
          />
        )}
      </ListSection>

      <Panel
        title={t('budgets.check_title', 'بررسی یک هزینه')}
        description={t('budgets.check_hint', 'پیش از تعهد پول پرسیده می‌شود، نه بعد از آن.')}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
          <Field
            label={t('budgets.account', 'حساب')}
            value={accountId}
            onChange={setAccountId}
            disabled={isBusy}
            dir="ltr"
          />
          <MinorInput
            label={t('budgets.amount_to_spend', 'مبلغ')}
            value={amountMinor}
            onChange={setAmountMinor}
            disabled={isBusy}
          />
          <ActionButton
            className="self-end"
            disabled={isBusy || accountId.trim() === '' || amountMinor <= 0}
            onClick={() =>
              onCheckSpend({ accountId: accountId.trim(), amountMinor, onDate: today })
            }
          >
            {t('budgets.check_action', 'بررسی')}
          </ActionButton>
        </div>

        {checkResult ? (
          <div className="mt-4 rounded-xl bg-[hsl(var(--surface-muted)/0.4)] p-4 text-sm">
            {/* The state carries more than allowed/refused: a spend can be
                permitted and still cross the warning threshold, and hiding
                that is how a budget is discovered only once it is broken. */}
            <Badge
              tone={
                (checkResult.status ? STATE_TONE[checkResult.status.state] : undefined) ??
                (checkResult.allowed ? 'good' : 'bad')
              }
            >
              {checkResult.allowed
                ? t('budgets.allowed', 'مجاز است')
                : t('budgets.blocked', 'از سقف عبور می‌کند')}
            </Badge>
            {checkResult.code ? (
              <span className="ms-2 text-[hsl(var(--fg-tertiary))]">
                {t(`budgets.code_${checkResult.code}`, checkResult.code)}
              </span>
            ) : null}

            {checkResult.status ? (
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('budgets.budget', 'بودجه')}
                  </dt>
                  <dd>
                    <Money minor={checkResult.status.budgetMinor} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('budgets.actual', 'خرج‌شده')}
                  </dt>
                  <dd>
                    <Money minor={checkResult.status.actualMinor} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('budgets.committed', 'تعهدشده')}
                  </dt>
                  <dd>
                    <Money minor={checkResult.status.committedMinor} tone="muted" />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('budgets.available', 'قابل استفاده')}
                  </dt>
                  <dd>
                    <Money minor={checkResult.status.availableMinor} tone="auto" />
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <ListSection
        title={t('budgets.variance', 'انحراف از بودجه')}
        description={t('budgets.variance_hint', 'گذشته‌نگر — تعهدها در این جدول نیستند.')}
      >
        {isVarianceLoading ? (
          <Loading label={t('common.loading', 'در حال بارگذاری…')} />
        ) : varianceError ? (
          <ErrorNote
            message={varianceError}
            onRetry={onRefresh}
            retryLabel={t('common.retry', 'تلاش دوباره')}
          />
        ) : (
          <DataTable
            tableId="budgets-variance"
            t={t}
            rows={varianceRows}
            columns={varianceColumns}
            rowKey={(row) => `${row.budgetId}-${row.periodStart}`}
            searchValue={varianceSearch}
            onSearchChange={setVarianceSearch}
            minWidthClass="min-w-[420px] sm:min-w-[640px]"
            emptyState={
              <EmptyState icon="search" title={t('budgets.variance_empty', 'انحرافی ثبت نشده')} />
            }
          />
        )}
      </ListSection>
    </CapabilityPage>
  )
})

BudgetsView.displayName = 'BudgetsView'
