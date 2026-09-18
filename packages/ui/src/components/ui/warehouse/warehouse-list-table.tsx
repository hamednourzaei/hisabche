'use client'

// ============================================
// Multi-warehouse (request #90) — the warehouse list on the stock page.
//
// One row per warehouse with the SAME figures the stat cards show (products,
// value, low, out), from the server. Stock that is in no warehouse is its own
// row rather than silently missing: without it the rows would not add up to
// the cards above them. Clicking a row opens that warehouse's products.
// ============================================

import { memo, useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import type { StockSummary, WarehouseOverviewItem } from '@hisabche/api'

import { DataTable, matchesSearch, type TableColumn } from '../data-table'
import { EmptyState } from '../empty-state'

export const UNASSIGNED_WAREHOUSE_ID = 'unassigned'

interface Row {
  id: string
  name: string
  location: string
  summary: StockSummary
  unassigned: boolean
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
  const [search, setSearch] = useState('')

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = warehouses.map((warehouse) => ({ ...warehouse, unassigned: false }))
    if (unassigned) {
      list.push({
        id: UNASSIGNED_WAREHOUSE_ID,
        name: t('warehouse.unassigned', 'بدون انبار'),
        location: t('warehouse.unassignedHint', 'موجودی‌ای که هنوز در هیچ انباری ثبت نشده'),
        summary: unassigned,
        unassigned: true,
      })
    }
    return list.filter((row) => matchesSearch(search, [row.name, row.location]))
  }, [warehouses, unassigned, search, t])

  const columns = useMemo<TableColumn<Row>[]>(
    () => [
      {
        id: 'name',
        labelKey: 'warehouse.warehouseName',
        labelFallback: 'انبار',
        locked: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <span
            className={
              row.unassigned
                ? 'font-medium text-[hsl(var(--color-warning))]'
                : 'font-medium text-[hsl(var(--fg-primary))]'
            }
          >
            {row.name}
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
        align: 'end',
        sortValue: (row) => row.summary.productCount,
        render: (row) => <span className="tabular-nums">{fmt(row.summary.productCount)}</span>,
      },
      {
        id: 'value',
        labelKey: 'warehouse.totalValue',
        labelFallback: 'ارزش کل (AFN)',
        align: 'end',
        sortValue: (row) => row.summary.totalValue,
        render: (row) => (
          <span className="font-medium tabular-nums">{fmt(row.summary.totalValue)}</span>
        ),
      },
      {
        id: 'low',
        labelKey: 'warehouse.lowStock',
        labelFallback: 'موجودی کم',
        align: 'end',
        showFrom: 'md',
        sortValue: (row) => row.summary.lowStockCount,
        render: (row) => (
          <span className="tabular-nums text-[hsl(var(--color-warning))]">
            {fmt(row.summary.lowStockCount)}
          </span>
        ),
      },
      {
        id: 'out',
        labelKey: 'warehouse.outOfStock',
        labelFallback: 'ناموجود',
        align: 'end',
        showFrom: 'md',
        sortValue: (row) => row.summary.outOfStockCount,
        render: (row) => (
          <span className="tabular-nums text-[hsl(var(--color-destructive))]">
            {fmt(row.summary.outOfStockCount)}
          </span>
        ),
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
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--surface-muted))]"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              {t('common.edit', 'ویرایش')}
            </button>
          ),
      },
    ],
    [fmt, onEdit, t],
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
      minWidthClass="min-w-[420px]"
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
