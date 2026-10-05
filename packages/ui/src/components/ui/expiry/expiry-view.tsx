'use client'

// ============================================
// packages/ui/src/components/ui/expiry/expiry-view.tsx
//
// Batches and their expiry.
//
// ---------------------------------------------------------------------------
// EXPIRED IS SHOWN FIRST
//
// Expired stock leads the table because it is the only group whose deadline
// has already passed. Beside the quantities is what that stock is WORTH — the
// gap between what the balance sheet counts and what the shop can actually
// sell is the figure a write-off decision needs.
//
// ---------------------------------------------------------------------------
// LAYOUT — the invoices list structure: header, four figures, one shared
// DataTable of every batch with its filters in the table's own toolbar.
//
// ⚠️ THE FOUR FIGURES ARE ALWAYS ON SCREEN. They used to be rendered only once
// the report had arrived, and as many as the server returned groups — so they
// popped in, two today and five tomorrow. Now there are four cards from the
// first paint; while the report loads each says «…», and when it could not be
// read each says «—». Neither is a number.
//
// ⚠️ A ROW OPENS ITS PRODUCT; «ویرایش» CORRECTS THE DATE. Dates only — a batch's
// quantity belongs to the movements that made it.
//
// ⚠️ THE WAREHOUSE FILTER IS OFFERED ONLY WHEN THERE IS MORE THAN ONE PLACE TO
// CHOOSE. A batch received before warehouses existed is in none; it is listed
// under «بدون انبار», never guessed into one.
//
// The «issue plan» calculator that sat under the table is gone (owner's order,
// 4 Oct 2026): it asked for a product id by hand and changed nothing.
// ============================================

import { memo, useMemo, useState } from 'react'
import { CalendarClock, Leaf, PackageX, Pencil, ShieldAlert } from 'lucide-react'
import type { ExpiryBucket, ExpiryReport, ExpiryState, StockBatch } from '@hisabche/api'
import { useDateFormat } from '../../../hooks/use-date-format'
import { formatSelectedMoney } from '../../../lib/money-display'
import { BentoStats, type BentoStat } from '../bento-stats'
import { DataTable, TableFilterSelect, matchesSearch, type TableColumn } from '../data-table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../dialog'
import { JalaliDatePicker } from '../jalali-datepicker'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  ErrorNote,
  ListSection,
  Loading,
} from '../capability/capability-kit'

export interface ExpiryViewProps {
  t: (key: string, fallback?: string) => string
  report: ExpiryReport | null
  batches: StockBatch[]
  /** The business's warehouses — the names behind a batch's `warehouseId`. */
  warehouses: ReadonlyArray<{ id: string; name: string }>
  isLoading: boolean
  error: string | null
  isSaving: boolean
  /** Resolves when the date is stored; rejects with the reason when it is not. */
  onSaveExpiry: (batchId: string, expiryDate: string | null) => Promise<void>
  onOpenProduct: (productId: string) => void
  onRefresh: () => void
}

const STATE_TONE: Record<ExpiryState, string> = {
  expired: 'bad',
  near_expiry: 'warn',
  fresh: 'good',
  no_expiry: 'neutral',
}

// Expired first. The server already orders the buckets this way; the view
// states the order it depends on rather than trusting an array's shape.
export const EXPIRY_STATE_ORDER: ExpiryState[] = ['expired', 'near_expiry', 'fresh', 'no_expiry']

const ALL = 'all'
/** A batch that is in no warehouse. A filter value, never a warehouse id. */
export const NO_WAREHOUSE = 'none'

type BatchRow = ExpiryBucket['batches'][number] & {
  state: ExpiryState
  warehouseId: string | null
}

/**
 * The four figures, from the report's groups.
 *
 * «ناسالم» is what cannot be sold as usual: expired, plus what will be within
 * the near-expiry window. `nearestDays` is the closest date still ahead — null
 * when no dated batch is left to expire.
 */
export function expiryFigures(buckets: readonly ExpiryBucket[]): {
  fresh: number
  unhealthy: number
  nearestDays: number | null
} {
  const quantity = (state: ExpiryState) =>
    buckets.find((bucket) => bucket.state === state)?.totalQuantity ?? 0
  const ahead = buckets
    .flatMap((bucket) => bucket.batches)
    .map((batch) => batch.daysRemaining)
    .filter((days): days is number => days !== null && days >= 0)
  return {
    fresh: quantity('fresh'),
    unhealthy: quantity('expired') + quantity('near_expiry'),
    nearestDays: ahead.length > 0 ? Math.min(...ahead) : null,
  }
}

export const ExpiryView = memo(function ExpiryView({
  t,
  report,
  batches,
  warehouses,
  isLoading,
  error,
  isSaving,
  onSaveExpiry,
  onOpenProduct,
  onRefresh,
}: ExpiryViewProps) {
  const { date } = useDateFormat()
  const [stateFilter, setStateFilter] = useState(ALL)
  const [warehouseFilter, setWarehouseFilter] = useState(ALL)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<BatchRow | null>(null)
  const [draft, setDraft] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const buckets = useMemo(
    () =>
      [...(report?.buckets ?? [])].sort(
        (a, b) => EXPIRY_STATE_ORDER.indexOf(a.state) - EXPIRY_STATE_ORDER.indexOf(b.state),
      ),
    [report],
  )

  // The report names a batch; the batch list says where it is.
  const warehouseOfBatch = useMemo(
    () => new Map(batches.map((batch) => [batch.id, batch.warehouseId ?? null])),
    [batches],
  )
  const warehouseName = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name])),
    [warehouses],
  )

  const rows = useMemo<BatchRow[]>(
    () =>
      buckets
        .filter((bucket) => stateFilter === ALL || bucket.state === stateFilter)
        .flatMap((bucket) =>
          bucket.batches.map((batch) => ({
            ...batch,
            state: bucket.state,
            warehouseId: warehouseOfBatch.get(batch.batchId) ?? null,
          })),
        )
        .filter(
          (batch) =>
            warehouseFilter === ALL ||
            (warehouseFilter === NO_WAREHOUSE
              ? batch.warehouseId === null
              : batch.warehouseId === warehouseFilter),
        )
        .filter((batch) =>
          matchesSearch(search, [
            batch.batchNumber,
            batch.productId,
            batch.warehouseId ? (warehouseName.get(batch.warehouseId) ?? '') : '',
          ]),
        ),
    [buckets, search, stateFilter, warehouseFilter, warehouseOfBatch, warehouseName],
  )

  const stats = useMemo<BentoStat[]>(() => {
    const figures = report ? expiryFigures(report.buckets) : null
    // Loading says «…»; a report that could not be read says «—».
    const pending = isLoading ? '…' : '—'
    return [
      {
        id: 'fresh',
        icon: Leaf,
        label: t('expiry.state_fresh', 'سالم'),
        text: figures ? String(figures.fresh) : pending,
      },
      {
        id: 'unhealthy',
        icon: ShieldAlert,
        label: t('expiry.unhealthy', 'ناسالم'),
        text: figures ? String(figures.unhealthy) : pending,
      },
      {
        id: 'expiredValue',
        icon: PackageX,
        label: t('expiry.expired_value', 'ارزش کالای منقضی'),
        text: report ? formatSelectedMoney(report.expiredValueMinor / 100) : pending,
      },
      {
        id: 'nearest',
        icon: CalendarClock,
        label: t('expiry.nearest', 'نزدیک‌ترین انقضا'),
        text: !figures
          ? pending
          : figures.nearestDays === null
            ? t('expiry.nearest_none', 'ندارد')
            : `${figures.nearestDays} ${t('expiry.days', 'روز')}`,
      },
    ]
  }, [isLoading, report, t])

  const columns = useMemo<TableColumn<BatchRow>[]>(
    () => [
      {
        id: 'state',
        labelKey: 'common.status',
        labelFallback: 'وضعیت',
        sortValue: (row) => EXPIRY_STATE_ORDER.indexOf(row.state),
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
        id: 'warehouse',
        labelKey: 'expiry.warehouse',
        labelFallback: 'انبار',
        showFrom: 'md',
        sortValue: (row) => (row.warehouseId ? (warehouseName.get(row.warehouseId) ?? '') : ''),
        render: (row) => (
          <span className="text-[hsl(var(--fg-secondary))]">
            {row.warehouseId
              ? (warehouseName.get(row.warehouseId) ?? '—')
              : t('expiry.no_warehouse', 'بدون انبار')}
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
      {
        id: 'edit',
        labelKey: 'expiry.edit_expiry',
        labelFallback: 'ویرایش انقضا',
        locked: true,
        align: 'end',
        render: (row) => (
          <button
            type="button"
            onClick={(event) => {
              // The row itself opens the product.
              event.stopPropagation()
              setSaveError(null)
              setDraft(row.expiryDate ?? '')
              setEditing(row)
            }}
            aria-label={`${t('expiry.edit_expiry', 'ویرایش انقضا')} — ${row.batchNumber}`}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--surface-muted))]"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            {t('common.edit', 'ویرایش')}
          </button>
        ),
      },
    ],
    [date, t, warehouseName],
  )

  const stateOptions = useMemo(
    () => [
      { value: ALL, label: t('common.all', 'همه') },
      ...EXPIRY_STATE_ORDER.map((state) => ({
        value: state as string,
        label: t(`expiry.state_${state}`, state),
      })),
    ],
    [t],
  )

  const warehouseOptions = useMemo(
    () => [
      { value: ALL, label: t('expiry.all_warehouses', 'همه‌ی انبارها') },
      ...warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
      { value: NO_WAREHOUSE, label: t('expiry.no_warehouse', 'بدون انبار') },
    ],
    [t, warehouses],
  )

  // «Nothing recorded» is said only when the data actually loaded and holds no
  // batch at all. Anything else that empties the table is the filter/search.
  const hasNoBatches =
    batches.length === 0 && buckets.every((bucket) => bucket.batches.length === 0)

  const save = async () => {
    if (!editing) return
    try {
      await onSaveExpiry(editing.batchId, draft || null)
      setEditing(null)
    } catch (reason) {
      setSaveError(
        reason instanceof Error && reason.message
          ? reason.message
          : t('expiry.save_failed', 'ذخیره نشد. دوباره تلاش کنید.'),
      )
    }
  }

  const subtitle = t('expiry.subtitle', 'کالای منقضی، نزدیک انقضا و سالم')

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('expiry.title', 'انقضا و بچ')}
        description={
          report ? `${subtitle} · ${t('expiry.as_of', 'تا تاریخ')}: ${date(report.asOf)}` : subtitle
        }
        action={
          <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
            {t('common.refresh', 'تازه‌سازی')}
          </ActionButton>
        }
      />

      <BentoStats t={t} stats={stats} />

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
            onRowClick={(row) => onOpenProduct(row.productId)}
            searchValue={search}
            onSearchChange={setSearch}
            actions={
              <>
                <TableFilterSelect
                  label={t('common.status', 'وضعیت')}
                  value={stateFilter}
                  onChange={setStateFilter}
                  options={stateOptions}
                  allValue={ALL}
                />
                {warehouses.length > 0 ? (
                  <TableFilterSelect
                    label={t('expiry.warehouse', 'انبار')}
                    value={warehouseFilter}
                    onChange={setWarehouseFilter}
                    options={warehouseOptions}
                    allValue={ALL}
                  />
                ) : null}
              </>
            }
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

      {editing ? (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="sm:max-w-sm" data-expiry-edit="">
            <DialogHeader>
              <DialogTitle>
                {t('expiry.edit_expiry', 'ویرایش انقضا')} —{' '}
                <span dir="ltr" className="font-mono text-sm">
                  {editing.batchNumber}
                </span>
              </DialogTitle>
            </DialogHeader>

            <JalaliDatePicker
              value={draft}
              onChange={setDraft}
              placeholder={t('expiry.expiry_date', 'تاریخ انقضا')}
            />

            {saveError ? <ErrorNote message={saveError} /> : null}

            <DialogFooter className="gap-2">
              <ActionButton variant="quiet" onClick={() => setEditing(null)} disabled={isSaving}>
                {t('common.cancel', 'انصراف')}
              </ActionButton>
              <ActionButton onClick={() => void save()} disabled={isSaving}>
                {t('common.save', 'ذخیره')}
              </ActionButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </CapabilityPage>
  )
})

ExpiryView.displayName = 'ExpiryView'
