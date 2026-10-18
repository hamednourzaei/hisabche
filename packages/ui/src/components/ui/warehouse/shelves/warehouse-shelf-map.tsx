'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/shelves/warehouse-shelf-map.tsx
//
// «نقشه قفسه‌ها» and «کالاهای یک قفسه» (owner, 18 Oct 2026).
//
//   ShelfMapView        every shelf as a tile, aisle by aisle, odd and even side;
//                       the colour is how full it is (only when a capacity is set).
//   ShelfProductsView   one shelf: its products in the shared DataTable with the
//                       same pager as the catalogue (`/warehouse?view=products`),
//                       and per row «جابه‌جایی» and «انتقال به انبار دیگر».
//
// Both are pure; the numbers come from the same `/warehouses/:id/map` answer
// as the shelf cards.
// ============================================

import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowLeftRight, Plus, Truck } from 'lucide-react'
import type { MapLocation, MapLocationProduct } from '@hisabche/api'

import { cn } from '../../../../lib/utils'
import { ActionButton, Badge, EmptyState } from '../../capability/capability-kit'
import { DataTable, type TableColumn } from '../../data-table'
import { searchKey } from '../../select-field'
import { fillBand, groupIntoAisles, pageOf, type FillBand } from './shelf-map'
import type { ShelfT } from './shelf-dialogs'

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]'
const PAGE_SIZE = 10

const BAND: Record<FillBand, string> = {
  none: 'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
  empty: 'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]',
  low: 'border-[hsl(var(--color-success)/0.45)] bg-[hsl(var(--color-success)/0.1)]',
  mid: 'border-[hsl(var(--color-warning)/0.5)] bg-[hsl(var(--color-warning)/0.12)]',
  full: 'border-[hsl(var(--color-primary)/0.55)] bg-[hsl(var(--color-primary)/0.14)]',
  over: 'border-[hsl(var(--color-destructive)/0.6)] bg-[hsl(var(--color-destructive)/0.12)]',
}
const DOT: Record<FillBand, string> = {
  none: 'bg-[hsl(var(--fg-tertiary))]',
  empty: 'bg-[hsl(var(--surface-muted))] border border-[hsl(var(--border-default))]',
  low: 'bg-[hsl(var(--color-success))]',
  mid: 'bg-[hsl(var(--color-warning))]',
  full: 'bg-[hsl(var(--color-primary))]',
  over: 'bg-[hsl(var(--color-destructive))]',
}

/** `(key, fallback)` reader for the shared kit, over the ICU `t`. */
export type PlainT = (key: string, fallback?: string) => string

export function ShelfMapView({
  t,
  formatQuantity,
  shelves,
  onOpenShelf,
}: {
  t: ShelfT
  formatQuantity: (value: number) => string
  shelves: MapLocation[]
  onOpenShelf: (shelf: MapLocation) => void
}) {
  const aisles = useMemo(() => groupIntoAisles(shelves), [shelves])
  const legend: FillBand[] = ['empty', 'low', 'mid', 'full', 'over', 'none']

  const tile = (shelf: MapLocation) => {
    const band = fillBand(shelf.capacityUsed, shelf.productCount)
    return (
      <button
        key={shelf.id}
        type="button"
        data-map-shelf={shelf.code}
        onClick={() => onOpenShelf(shelf)}
        title={shelf.name ?? shelf.code}
        className={cn(
          'group flex min-h-20 w-28 shrink-0 flex-col justify-between rounded-xl border p-2.5 text-start transition',
          'hover:-translate-y-0.5 hover:shadow-md',
          BAND[band],
          FOCUS,
        )}
      >
        <span className="font-mono text-sm font-bold text-[hsl(var(--fg-primary))]" dir="ltr">
          {shelf.code}
        </span>
        <span className="text-[11px] text-[hsl(var(--fg-secondary))]">
          {t('warehouseShelves.map.items', { count: formatQuantity(shelf.productCount) })}
        </span>
        {shelf.capacityUsed !== null ? (
          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[hsl(var(--surface-base)/0.7)]">
            <span
              className={cn('block h-full rounded-full', DOT[band])}
              style={{ width: `${Math.min(100, Math.round(shelf.capacityUsed * 100))}%` }}
            />
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <div className="space-y-4" data-shelf-map="">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[hsl(var(--fg-secondary))]">
        {legend.map((band) => (
          <li key={band} className="inline-flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-full', DOT[band])} aria-hidden="true" />
            {t(`warehouseShelves.map.band.${band}`)}
          </li>
        ))}
      </ul>
      {aisles.map((aisle) => (
        <section
          key={aisle.aisle || '—'}
          data-aisle={aisle.aisle}
          className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-3 shadow-sm sm:p-4"
        >
          <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {aisle.aisle
              ? t('warehouseShelves.map.aisle', { aisle: aisle.aisle })
              : t('warehouseShelves.map.otherAisle')}
          </h3>
          {(['odd', 'even'] as const).map((side) =>
            aisle[side].length > 0 ? (
              <div key={side} className="mb-2 last:mb-0">
                {aisle.aisle ? (
                  <p className="mb-1.5 text-[11px] font-medium text-[hsl(var(--fg-tertiary))]">
                    {t(`warehouseShelves.map.${side}`)}
                  </p>
                ) : null}
                <div className="flex gap-2 overflow-x-auto pb-1">{aisle[side].map(tile)}</div>
              </div>
            ) : null,
          )}
        </section>
      ))}
    </div>
  )
}

export function ShelfProductsView({
  t,
  plainT,
  formatQuantity,
  formatMoney,
  unitLabel,
  shelf,
  warehouseName,
  canPlace,
  canMove,
  canTransfer,
  onBack,
  onAdd,
  onMove,
  onTransfer,
}: {
  t: ShelfT
  plainT: PlainT
  formatQuantity: (value: number) => string
  formatMoney: (value: number) => string
  unitLabel: (unit: string) => string
  shelf: MapLocation
  warehouseName: string
  canPlace: boolean
  /** More than one shelf: something to move to. */
  canMove: boolean
  /** Another live warehouse exists and the reader may move stock. */
  canTransfer: boolean
  onBack: () => void
  onAdd: () => void
  onMove: (row: MapLocationProduct) => void
  onTransfer: (row: MapLocationProduct) => void
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const needle = searchKey(search)
  const filtered = needle
    ? shelf.products.filter((row) => searchKey(`${row.name} ${row.sku ?? ''}`).includes(needle))
    : shelf.products
  const view = pageOf(filtered, page, PAGE_SIZE)

  const columns: TableColumn<MapLocationProduct>[] = [
    {
      id: 'name',
      labelKey: 'warehouseShelves.table.product',
      labelFallback: 'کالا',
      locked: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-[hsl(var(--fg-primary))]">
            {row.name}
          </span>
          {row.sku ? (
            <span className="block truncate text-xs text-[hsl(var(--fg-tertiary))]" dir="ltr">
              {row.sku}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'quantity',
      labelKey: 'warehouseShelves.table.quantity',
      labelFallback: 'مقدار روی قفسه',
      align: 'end',
      sortValue: (row) => row.quantity,
      render: (row) => (
        <span className="tabular-nums font-semibold">
          {formatQuantity(row.quantity)} {unitLabel(row.unit ?? '')}
          {row.exceedsStock ? (
            <span className="ms-1 text-xs text-[hsl(var(--color-destructive))]">
              {t('warehouseShelves.table.exceeds')}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'value',
      labelKey: 'warehouseShelves.table.value',
      labelFallback: 'ارزش (قیمت خرید)',
      align: 'end',
      showFrom: 'sm',
      sortValue: (row) => row.value,
      // `null` = no price or not allowed to see it — never drawn as 0.
      render: (row) => (
        <span className="tabular-nums">{row.value === null ? '—' : formatMoney(row.value)}</span>
      ),
    },
    {
      id: 'lastSale',
      labelKey: 'warehouseShelves.table.lastSale',
      labelFallback: 'آخرین فروش',
      showFrom: 'md',
      sortValue: (row) => row.daysSinceSale,
      render: (row) =>
        row.neverSold ? (
          <span className="text-[hsl(var(--fg-tertiary))]">
            {t('warehouseShelves.table.neverSold')}
          </span>
        ) : row.daysSinceSale !== null ? (
          <span className={cn(row.stagnant && 'text-[hsl(var(--color-warning))]')}>
            {t('warehouseShelves.table.daysAgo', { days: formatQuantity(row.daysSinceSale) })}
            {row.stagnant ? ` · ${t('warehouseShelves.table.stagnant')}` : ''}
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'actions',
      labelKey: 'warehouseShelves.table.actions',
      labelFallback: 'اقدام',
      locked: true,
      render: (row) => (
        <span className="flex flex-wrap justify-end gap-1">
          {canMove ? (
            <ActionButton variant="quiet" onClick={() => onMove(row)}>
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
              {t('warehouseShelves.move')}
            </ActionButton>
          ) : null}
          {canTransfer ? (
            <ActionButton variant="quiet" onClick={() => onTransfer(row)}>
              <Truck className="size-3.5" aria-hidden="true" />
              {t('warehouseShelves.table.transfer')}
            </ActionButton>
          ) : null}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4" data-shelf-products={shelf.code}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={t('warehouseShelves.map.back')}
            className={cn(
              'inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted))]',
              FOCUS,
            )}
          >
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-xs text-[hsl(var(--fg-tertiary))]">
              {warehouseName} › {t('warehouseShelves.map.title')}
            </p>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[hsl(var(--fg-primary))]">
              <span
                className="rounded-lg bg-[hsl(var(--color-primary)/0.12)] px-2.5 py-0.5 font-mono text-[hsl(var(--color-primary))]"
                dir="ltr"
              >
                {shelf.code}
              </span>
              {shelf.name ? (
                <span className="truncate text-sm font-medium">{shelf.name}</span>
              ) : null}
            </h2>
            <p className="text-xs text-[hsl(var(--fg-secondary))]">
              {t('warehouseShelves.shelfItems', {
                count: formatQuantity(shelf.productCount),
                quantity: formatQuantity(shelf.quantity),
              })}
              {shelf.capacity !== null
                ? ` · ${t('warehouseShelves.capacity', { capacity: formatQuantity(shelf.capacity) })}`
                : ''}
            </p>
          </div>
        </div>
        {canPlace ? (
          <ActionButton onClick={onAdd}>
            <Plus className="size-4" aria-hidden="true" />
            {t('warehouseShelves.addProductHere')}
          </ActionButton>
        ) : null}
      </div>

      <DataTable
        tableId="shelf-products"
        t={plainT}
        rows={view.rows}
        columns={columns}
        rowKey={(row) => row.productId}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        minWidthClass="min-w-[420px]"
        emptyState={
          <EmptyState
            title={needle ? t('warehouseShelves.noMatch') : t('warehouseShelves.emptyShelf')}
          />
        }
      />

      {view.pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <ActionButton
            variant="quiet"
            disabled={view.page <= 1}
            onClick={() => setPage(view.page - 1)}
          >
            {plainT('common.previous', 'قبلی')}
          </ActionButton>
          <Badge>
            <span dir="ltr" className="tabular-nums">
              {view.page} / {view.pageCount}
            </span>
          </Badge>
          <ActionButton
            variant="quiet"
            disabled={view.page >= view.pageCount}
            onClick={() => setPage(view.page + 1)}
          >
            {plainT('common.next', 'بعدی')}
          </ActionButton>
        </div>
      ) : null}
      <p className="text-xs text-[hsl(var(--fg-tertiary))]">
        {plainT('common.total', 'مجموع')}:{' '}
        <span dir="ltr" className="tabular-nums">
          {filtered.length}
        </span>
      </p>
    </div>
  )
}
