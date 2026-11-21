'use client'

// ============================================
// Multi-warehouse (request #90) — the warehouse list on the stock page.
//
// One row per warehouse with the SAME figures the stat cards show (products,
// value, low, out), from the server. Stock that is in no warehouse is its own
// row rather than silently missing: without it the rows would not add up to
// the cards above them. Clicking a row opens that warehouse's products.
//
// ---------------------------------------------------------------------------
// WHAT THE ROW SHOWS (redesign, 20 Nov 2026)
//
//   name — with a rule under it, as wide as the name itself
//   location
//   products — the count, with «N کم · N تمام» beside it
//   value    — the server's summary, at the purchase price
//   share    — this row's value as a share of the rows in THIS list
//   status   — بدون انبار / غیرفعال / خالی / کمبود / فعال
//
// The share denominator comes from `valueShares` — the SAME helper the
// «ارزش به تفکیک انبار» chart uses, so the two cannot disagree. It is the sum
// of the rows here, never the workspace total.
//
// A row without a `summary` is UNKNOWN — «—» in every figure and «نامعلوم» as
// its status, never a zero (see warehouse-list-without-summary.test.ts).
// ============================================

import { memo, useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import type { StockSummary, WarehouseOverviewItem } from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { valueShares } from '../../../lib/warehouse/warehouse-share'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { DataTable, matchesSearch, type CardTone, type TableColumn } from '../data-table'
import { EmptyState } from '../empty-state'
import { formatPercent, fullAmount } from '../kpi-card'

export const UNASSIGNED_WAREHOUSE_ID = 'unassigned'

interface Row {
  id: string
  name: string
  location: string
  /** False = the warehouse is deactivated; its stock stays, the state is shown. */
  isActive: boolean
  /**
   * `null` when the answer did not carry one — an older offline engine or a
   * response cached before the shape was fixed. A warehouse with no figures is
   * shown with «—»; it must not take the whole page down, and it must not be
   * shown as «۰ محصول» either (unknown is not zero).
   */
  summary: StockSummary | null
  unassigned: boolean
}

/** One figure of a row, or «—» when the row has none. */
function figure(
  format: (value: number) => string,
  summary: StockSummary | null,
  pick: (summary: StockSummary) => number,
): string {
  return summary ? format(pick(summary)) : '—'
}

type StatusKind = 'unassigned' | 'inactive' | 'empty' | 'low' | 'active' | 'unknown'

/** The row's state, in the order the badge says it. */
function statusKind(row: Row): StatusKind {
  if (row.unassigned) return 'unassigned'
  if (!row.isActive) return 'inactive'
  const summary = row.summary
  if (!summary) return 'unknown'
  if (summary.productCount === 0) return 'empty'
  if (summary.lowStockCount > 0 || summary.outOfStockCount > 0) return 'low'
  return 'active'
}

type PillTone = 'success' | 'warning' | 'destructive' | 'neutral'

const STATUS_TONE: Record<StatusKind, PillTone> = {
  unassigned: 'warning',
  inactive: 'neutral',
  empty: 'destructive',
  low: 'warning',
  active: 'success',
  unknown: 'neutral',
}

const STATUS_LABEL: Record<StatusKind, { key: string; fallback: string }> = {
  unassigned: { key: 'warehouse.unassigned', fallback: 'بدون انبار' },
  inactive: { key: 'warehouse.statusInactive', fallback: 'غیرفعال' },
  empty: { key: 'warehouse.statusEmpty', fallback: 'خالی' },
  low: { key: 'warehouse.statusLow', fallback: 'کمبود' },
  active: { key: 'warehouse.statusActive', fallback: 'فعال' },
  unknown: { key: 'warehouse.summaryUnavailable', fallback: 'نامعلوم' },
}

/** The mobile card's coloured edge — the same state as the badge. */
const CARD_TONE: Record<StatusKind, CardTone | undefined> = {
  unassigned: 'warning',
  inactive: undefined,
  empty: 'destructive',
  low: 'warning',
  active: 'success',
  unknown: undefined,
}

const PILL: Record<PillTone, string> = {
  success:
    'border-[hsl(var(--color-success)/0.16)] bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]',
  warning:
    'border-[hsl(var(--color-warning)/0.18)] bg-[hsl(var(--color-warning)/0.1)] text-[hsl(var(--color-warning))]',
  destructive:
    'border-[hsl(var(--color-destructive)/0.16)] bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]',
  neutral:
    'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-tertiary))]',
}

function StatusPill({ kind, label }: { kind: StatusKind; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        PILL[STATUS_TONE[kind]],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  )
}

export const WarehouseListTable = memo(function WarehouseListTable({
  t,
  fmt,
  warehouses,
  unassigned,
  onOpen,
  onAdd,
  onEdit,
}: {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  warehouses: WarehouseOverviewItem[]
  unassigned: StockSummary | null
  onOpen: (id: string) => void
  onAdd: () => void
  /** «ویرایش» on a warehouse row (not on the «بدون انبار» row). */
  onEdit: (warehouse: { id: string; name: string; location: string }) => void
}) {
  const locale = useIntlLocale()
  const [search, setSearch] = useState('')

  const rows = useMemo<Row[]>(() => {
    // The type says `summary` is always there; the wire does not promise it.
    const list: Row[] = warehouses.map((warehouse) => ({
      id: warehouse.id,
      name: warehouse.name,
      location: warehouse.location,
      isActive: (warehouse as { isActive?: boolean }).isActive !== false,
      summary: (warehouse as { summary?: StockSummary | null }).summary ?? null,
      unassigned: false,
    }))
    if (unassigned) {
      list.push({
        id: UNASSIGNED_WAREHOUSE_ID,
        name: t('warehouse.unassigned', 'بدون انبار'),
        location: t('warehouse.unassignedHint', 'موجودی‌ای که هنوز در هیچ انباری ثبت نشده'),
        isActive: true,
        summary: unassigned,
        unassigned: true,
      })
    }
    return list.filter((row) => matchesSearch(search, [row.name, row.location]))
  }, [warehouses, unassigned, search, t])

  // ⚠️ The denominator is the FULL list, not the search result: typing in the
  // search box must not change what «۳۵٪» means. An unknown row is left out.
  const shares = useMemo(() => {
    const values = warehouses.map(
      (warehouse) => (warehouse as { summary?: StockSummary | null }).summary?.totalValue ?? null,
    )
    if (unassigned) values.push(unassigned.totalValue)
    return valueShares(values)
  }, [warehouses, unassigned])

  const columns = useMemo<TableColumn<Row>[]>(
    () => [
      {
        id: 'name',
        labelKey: 'warehouse.warehouseName',
        labelFallback: 'انبار',
        locked: true,
        sortValue: (row) => row.name,
        render: (row) => (
          // The rule is as wide as the NAME, not the column: an inline-flex
          // shrinks to its widest child (the name), and the line stretches to
          // it. It therefore keeps the same shape in the table and in the
          // mobile card, which renders this same cell.
          <span className="inline-flex max-w-full flex-col gap-1 pb-1">
            <span
              className={cn(
                'truncate font-semibold',
                row.unassigned
                  ? 'text-[hsl(var(--color-warning))]'
                  : 'text-[hsl(var(--fg-primary))]',
              )}
            >
              {row.name}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'block h-px w-full rounded-full',
                row.unassigned
                  ? 'bg-[hsl(var(--color-warning)/0.45)]'
                  : 'bg-[hsl(var(--border-strong))]',
              )}
            />
          </span>
        ),
      },
      {
        id: 'location',
        labelKey: 'warehouse.location',
        labelFallback: 'محل',
        showFrom: 'md',
        sortValue: (row) => row.location,
        render: (row) => (
          <span className="text-[hsl(var(--fg-secondary))]">{row.location || '—'}</span>
        ),
      },
      {
        id: 'products',
        labelKey: 'warehouse.totalProducts',
        labelFallback: 'تعداد محصولات',
        sortValue: (row) => row.summary?.productCount ?? null,
        render: (row) => {
          const summary = row.summary
          if (!summary) return <span className="text-[hsl(var(--fg-tertiary))]">—</span>
          const low = summary.lowStockCount
          const out = summary.outOfStockCount
          return (
            <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="font-semibold tabular-nums">
                {fullAmount(summary.productCount, locale)}
              </span>
              {low > 0 || out > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold">
                  {low > 0 ? (
                    <span className="text-[hsl(var(--color-warning))]">
                      {fullAmount(low, locale)} {t('warehouse.lowShort', 'کم')}
                    </span>
                  ) : null}
                  {low > 0 && out > 0 ? (
                    <span className="text-[hsl(var(--fg-tertiary))] opacity-60">·</span>
                  ) : null}
                  {out > 0 ? (
                    <span className="text-[hsl(var(--color-destructive))]">
                      {fullAmount(out, locale)} {t('warehouse.outShort', 'تمام')}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </span>
          )
        },
      },
      {
        id: 'value',
        labelKey: 'warehouse.totalValue',
        labelFallback: 'ارزش کل',
        align: 'end',
        sortValue: (row) => row.summary?.totalValue ?? null,
        render: (row) => (
          <span className="font-semibold tabular-nums">
            {figure(fmt, row.summary, (summary) => summary.totalValue)}
          </span>
        ),
      },
      {
        id: 'share',
        labelKey: 'warehouse.share',
        labelFallback: 'سهم',
        showFrom: 'md',
        sortValue: (row) => shares.percent(row.summary?.totalValue ?? null),
        render: (row) => {
          const percent = shares.percent(row.summary?.totalValue ?? null)
          if (percent === null) {
            return <span className="text-[hsl(var(--fg-tertiary))]">—</span>
          }
          return (
            <span className="inline-flex min-w-[104px] items-center gap-2">
              <span className="w-10 shrink-0 text-start text-[11px] font-semibold tabular-nums text-[hsl(var(--fg-secondary))]">
                {formatPercent(percent, locale)}
              </span>
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-[hsl(var(--surface-muted))]">
                <span
                  className={cn(
                    'block h-full rounded-full',
                    row.unassigned
                      ? 'bg-[hsl(var(--color-warning))]'
                      : 'bg-[hsl(var(--color-primary))]',
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                />
              </span>
            </span>
          )
        },
      },
      {
        id: 'status',
        labelKey: 'common.status',
        labelFallback: 'وضعیت',
        render: (row) => {
          const kind = statusKind(row)
          const label = STATUS_LABEL[kind]
          return <StatusPill kind={kind} label={t(label.key, label.fallback)} />
        },
      },
      {
        id: 'actions',
        labelKey: 'warehouse.actions',
        labelFallback: 'عملیات',
        align: 'end',
        locked: true,
        render: (row) =>
          row.unassigned ? null : (
            <button
              type="button"
              // The row click opens the warehouse; this edits it.
              onClick={(e) => {
                e.stopPropagation()
                onEdit({ id: row.id, name: row.name, location: row.location })
              }}
              aria-label={t('warehouse.editWarehouse', 'ویرایش انبار')}
              title={t('warehouse.editWarehouse', 'ویرایش انبار')}
              className="inline-flex size-8 items-center justify-center rounded-lg text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--surface-muted))]"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
          ),
      },
    ],
    [fmt, locale, onEdit, shares, t],
  )

  return (
    <DataTable
      tableId="warehouse-list"
      t={t}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.id}
      onRowClick={(row) => onOpen(row.id)}
      searchValue={search}
      onSearchChange={setSearch}
      minWidthClass="min-w-[680px]"
      cardTone={(row) => CARD_TONE[statusKind(row)]}
      emptyState={
        <EmptyState
          icon="product"
          title={t('warehouse.noWarehouses', 'هنوز انباری ثبت نشده')}
          description={t('warehouse.noWarehousesDesc', 'اولین انبار خود را اضافه کنید')}
          action={{ label: t('warehouse.addWarehouse', 'افزودن انبار'), onClick: onAdd }}
        />
      }
    />
  )
})

WarehouseListTable.displayName = 'WarehouseListTable'
