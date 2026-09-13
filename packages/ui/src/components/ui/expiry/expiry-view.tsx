'use client'

// ============================================
// packages/ui/src/components/ui/expiry/expiry-view.tsx
//
// Batches, expiry and what an issue would consume.
//
// ---------------------------------------------------------------------------
// EXPIRED IS SHOWN FIRST, AND IS A REFUSAL
//
// Expired stock leads the report because it is the only group whose deadline
// has already passed. Next to it is what that stock is WORTH — the gap between
// what the balance sheet counts and what the shop can actually sell is the
// figure a write-off decision needs, and neither number alone gives it.
//
// The issue plan shows expired batches under `blockedByExpiry`, not as an
// option with a warning. There is no override control on this screen, because
// medicine sold past its date is not a data-quality problem.
//
// A shortfall is shown as a shortfall. Stock the shop does not have must read
// as missing, never as a plan that quietly covers less than was asked for.
//
// ---------------------------------------------------------------------------
// LAYOUT — the invoices list structure: header, state filter, stat strip, one
// shared DataTable of every batch (expired first), then the issue planner.
// ============================================

import { memo, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Clock,
  Infinity as InfinityIcon,
  Leaf,
  PackageX,
  type LucideIcon,
} from 'lucide-react'
import type {
  AllocationPlan,
  ExpiryBucket,
  ExpiryReport,
  ExpiryState,
  StockBatch,
} from '@hisabche/api'
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
  Money,
  NumberField,
  Panel,
  Stat,
  StatGrid,
} from '../capability/capability-kit'

export interface ExpiryViewProps {
  t: (key: string, fallback?: string) => string
  report: ExpiryReport | null
  batches: StockBatch[]
  plan: AllocationPlan | null
  isLoading: boolean
  error: string | null
  actionError: string | null
  isBusy: boolean
  onPlanIssue: (input: { productId: string; quantity: number }) => void
  onRefresh: () => void
}

const STATE_TONE: Record<ExpiryState, string> = {
  expired: 'bad',
  near_expiry: 'warn',
  fresh: 'good',
  no_expiry: 'neutral',
}

const STATE_ICON: Record<ExpiryState, LucideIcon> = {
  expired: AlertTriangle,
  near_expiry: Clock,
  fresh: Leaf,
  no_expiry: InfinityIcon,
}

// Expired first. The server already orders the buckets this way; the view
// states the order it depends on rather than trusting an array's shape.
const STATE_ORDER: ExpiryState[] = ['expired', 'near_expiry', 'fresh', 'no_expiry']

type StateFilter = 'all' | ExpiryState

type BatchRow = ExpiryBucket['batches'][number] & { state: ExpiryState }

export const ExpiryView = memo(function ExpiryView({
  t,
  report,
  batches,
  plan,
  isLoading,
  error,
  actionError,
  isBusy,
  onPlanIssue,
  onRefresh,
}: ExpiryViewProps) {
  const { date } = useDateFormat()
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [search, setSearch] = useState('')

  const buckets = useMemo(
    () =>
      [...(report?.buckets ?? [])].sort(
        (a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state),
      ),
    [report],
  )

  const rows = useMemo<BatchRow[]>(
    () =>
      buckets
        .filter((bucket) => stateFilter === 'all' || bucket.state === stateFilter)
        .flatMap((bucket) => bucket.batches.map((batch) => ({ ...batch, state: bucket.state })))
        .filter((batch) => matchesSearch(search, [batch.batchNumber, batch.productId])),
    [buckets, search, stateFilter],
  )

  const columns = useMemo<TableColumn<BatchRow>[]>(
    () => [
      {
        id: 'state',
        labelKey: 'common.status',
        labelFallback: 'وضعیت',
        sortValue: (row) => STATE_ORDER.indexOf(row.state),
        render: (row) => (
          <Badge tone={STATE_TONE[row.state]}>{t(`expiry.state_${row.state}`, row.state)}</Badge>
        ),
      },
      {
        id: 'batch',
        labelKey: 'expiry.batch',
        labelFallback: 'بچ',
        locked: true,
        sortValue: (row) => row.batchNumber,
        render: (row) => (
          <span className="font-mono text-xs" dir="ltr">
            {row.batchNumber}
          </span>
        ),
      },
      {
        id: 'quantity',
        labelKey: 'expiry.quantity',
        labelFallback: 'مقدار',
        align: 'end',
        sortValue: (row) => row.quantity,
        render: (row) => <span className="tabular-nums">{row.quantity}</span>,
      },
      {
        id: 'expiryDate',
        labelKey: 'expiry.expiry_date',
        labelFallback: 'تاریخ انقضا',
        showFrom: 'md',
        sortValue: (row) => row.expiryDate,
        render: (row) => (
          <span className="text-[hsl(var(--fg-secondary))]">
            {row.expiryDate ? date(row.expiryDate) : '—'}
          </span>
        ),
      },
      {
        id: 'daysRemaining',
        labelKey: 'expiry.days_remaining',
        labelFallback: 'روز باقی‌مانده',
        align: 'end',
        sortValue: (row) => row.daysRemaining,
        render: (row) =>
          row.daysRemaining == null ? (
            '—'
          ) : (
            <span
              className={
                row.daysRemaining < 0
                  ? 'tabular-nums text-[hsl(var(--color-destructive))]'
                  : 'tabular-nums'
              }
            >
              {row.daysRemaining}
            </span>
          ),
      },
    ],
    [date, t],
  )

  const filterOptions = useMemo(
    () => [
      { value: 'all' as StateFilter, label: t('common.all', 'همه') },
      ...STATE_ORDER.map((state) => ({
        value: state as StateFilter,
        label: t(`expiry.state_${state}`, state),
      })),
    ],
    [t],
  )

  // «Nothing recorded» is said only when the data actually loaded and holds no
  // batch at all. Anything else that empties the table is the filter/search.
  const hasNoBatches =
    batches.length === 0 && buckets.every((bucket) => bucket.batches.length === 0)

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('expiry.title', 'انقضا و بچ')}
        description={t('expiry.subtitle', 'کالای منقضی، نزدیک انقضا، و برنامه‌ی مصرف')}
        action={
          <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
            {t('common.refresh', 'تازه‌سازی')}
          </ActionButton>
        }
      />

      {actionError ? <ErrorNote message={actionError} /> : null}

      {report ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedFilter
            label={t('common.status', 'وضعیت')}
            value={stateFilter}
            options={filterOptions}
            onChange={setStateFilter}
          />
          <span className="text-xs text-[hsl(var(--fg-tertiary))]">
            {t('expiry.as_of', 'تا تاریخ')}: {date(report.asOf)}
          </span>
        </div>
      ) : null}

      {report ? (
        <StatGrid>
          <Stat
            icon={PackageX}
            label={t('expiry.expired_value', 'ارزش کالای منقضی')}
            value={
              <Money
                minor={report.expiredValueMinor}
                tone={report.expiredValueMinor > 0 ? 'bad' : 'muted'}
              />
            }
            hint={t('expiry.expired_value_hint', 'در ترازنامه هست، قابل فروش نیست.')}
          />
          {buckets.map((bucket) => (
            <Stat
              key={bucket.state}
              icon={STATE_ICON[bucket.state]}
              label={t(`expiry.state_${bucket.state}`, bucket.state)}
              value={bucket.totalQuantity}
              hint={`${bucket.batches.length} ${t('expiry.batches', 'بچ')}`}
            />
          ))}
        </StatGrid>
      ) : null}

      <ListSection title={t('expiry.report', 'گزارش انقضا')}>
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
            tableId="expiry-batches"
            t={t}
            rows={rows}
            columns={columns}
            rowKey={(row) => `${row.state}-${row.batchId}`}
            searchValue={search}
            onSearchChange={setSearch}
            minWidthClass="min-w-[420px] sm:min-w-[640px]"
            emptyState={
              hasNoBatches ? (
                <EmptyState
                  icon="product"
                  title={t('expiry.empty_title', 'بچی ثبت نشده')}
                  description={t(
                    'expiry.empty_hint',
                    'بچ هنگام دریافت کالای تاریخ‌دار ثبت می‌شود.',
                  )}
                />
              ) : (
                <EmptyState icon="search" title={t('expiry.no_match', 'بچی با این فیلتر نیست')} />
              )
            }
          />
        )}
      </ListSection>

      <Panel
        title={t('expiry.plan_title', 'برنامه‌ی مصرف')}
        description={t(
          'expiry.plan_hint',
          'نشان می‌دهد از کدام بچ برداشته می‌شود — چیزی مصرف نمی‌کند. پیش‌فرض FEFO.',
        )}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
          <Field
            label={t('expiry.product', 'کالا')}
            value={productId}
            onChange={setProductId}
            disabled={isBusy}
            dir="ltr"
          />
          <NumberField
            label={t('expiry.quantity', 'مقدار')}
            value={quantity}
            onChange={setQuantity}
            min={1}
            disabled={isBusy}
          />
          <ActionButton
            className="self-end"
            disabled={isBusy || productId.trim() === '' || quantity <= 0}
            onClick={() => onPlanIssue({ productId: productId.trim(), quantity })}
          >
            {t('expiry.plan_action', 'محاسبه')}
          </ActionButton>
        </div>

        {plan ? (
          <div className="mt-4 space-y-3 text-sm">
            {plan.shortfall > 0 ? (
              <ErrorNote message={`${t('expiry.shortfall', 'کسری')}: ${plan.shortfall}`} />
            ) : null}

            <ul className="divide-y divide-[hsl(var(--border-default))]">
              {plan.allocations.map((allocation) => (
                <li
                  key={allocation.batchId}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="font-mono text-xs" dir="ltr">
                    {allocation.batchNumber}
                    {allocation.expiryDate ? ` · ${allocation.expiryDate}` : ''}
                  </span>
                  <span className="tabular-nums">{allocation.quantity}</span>
                </li>
              ))}
            </ul>

            {plan.blockedByExpiry.length > 0 ? (
              <div>
                <p className="mb-1 text-xs text-[hsl(var(--color-destructive))]">
                  {t('expiry.blocked', 'به دلیل انقضا کنار گذاشته شد')}
                </p>
                <ul className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {plan.blockedByExpiry.map((blocked) => (
                    <li key={blocked.batchId} dir="ltr" className="font-mono">
                      {blocked.batchNumber} · {blocked.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Panel>
    </CapabilityPage>
  )
})

ExpiryView.displayName = 'ExpiryView'
