'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/shelves/warehouse-shelves-view.tsx
//
// The screens of «نقشه قفسه‌ها» that are not the map: loading, not migrated,
// failed, and a warehouse with no shelves yet. Pure (the container reads it).
// The shelf cards that were here are gone (owner, 18 Oct 2026: ONE address,
// `?view=shelfMap`) — shelves are the map, a shelf is its table
// (warehouse-shelf-map.tsx). `stockOptions` is the «بدون قفسه» rule both use.
//
// Where the numbers come from:
//   shelves and what sits on them   GET /warehouses/:id/map  (locations[].products)
//   what the warehouse holds        GET /warehouses/:id      (products[].quantity)
//   «بدون قفسه»                     holds − sum on shelves, per product, never < 0
// ============================================

import { Package, Plus } from 'lucide-react'
import type { MapLocation } from '@hisabche/api'

import { cn } from '../../../../lib/utils'
import type { ShelfT, StockOption } from './shelf-dialogs'

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]'
const chipButton = cn(
  'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium sm:min-h-9',
  'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
  FOCUS,
)

export interface WarehouseShelvesViewProps {
  t: ShelfT
  state: 'loading' | 'error' | 'not-migrated' | 'offline-unavailable' | 'ready'
  errorMessage: string | null
  onRetry: () => void
  /** Active shelves of this warehouse. */
  shelves: MapLocation[]
  canConfigure: boolean
  onAddShelf: () => void
  /** The warehouse filter. */
  toolbar?: React.ReactNode
}

/** Holds − placed, per product. Pure; exported for the tests. */
export function stockOptions(
  products: Array<{
    id: string
    name: string
    sku?: string | null
    unit: string
    quantity: number
  }>,
  shelves: MapLocation[],
): StockOption[] {
  const onShelf = new Map<string, Record<string, number>>()
  for (const shelf of shelves) {
    for (const row of shelf.products) {
      const map = onShelf.get(row.productId) ?? {}
      map[shelf.id] = (map[shelf.id] ?? 0) + row.quantity
      onShelf.set(row.productId, map)
    }
  }
  return products.map((product) => {
    const placed = onShelf.get(product.id) ?? {}
    const sum = Object.values(placed).reduce((total, value) => total + value, 0)
    return {
      id: product.id,
      name: product.name,
      sku: product.sku ?? null,
      unit: product.unit,
      total: product.quantity,
      free: Math.max(0, product.quantity - sum),
      onShelf: placed,
    }
  })
}

/** Everything but the map itself; `null` when the map has something to draw. */
export function WarehouseShelvesView({
  t,
  state,
  errorMessage,
  onRetry,
  shelves,
  canConfigure,
  onAddShelf,
  toolbar,
}: WarehouseShelvesViewProps) {
  const bar = toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null

  if (state === 'loading') {
    return (
      <div className="space-y-4">
        {bar}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl bg-[hsl(var(--surface-muted))]"
            />
          ))}
        </div>
      </div>
    )
  }
  if (state === 'offline-unavailable') {
    return (
      <div className="space-y-4">
        {bar}
        <Notice>{t('warehouseShelves.notAvailableOffline')}</Notice>
      </div>
    )
  }
  if (state === 'not-migrated') {
    return (
      <div className="space-y-4">
        {bar}
        <Notice>{t('warehouseShelves.notMigrated')}</Notice>
      </div>
    )
  }
  if (state === 'error') {
    return (
      <div className="space-y-4">
        {bar}
        <Notice tone="error">
          <span>{errorMessage ?? t('warehouseShelves.loadFailed')}</span>
          <button
            type="button"
            onClick={onRetry}
            className={cn(chipButton, 'border border-current')}
          >
            {t('warehouseShelves.retry')}
          </button>
        </Notice>
      </div>
    )
  }
  if (shelves.length > 0) return null

  // A warehouse without shelves still works fully — say so, offer to add one.
  return (
    <div className="space-y-4">
      {bar}
      <section className="rounded-2xl border border-dashed border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-6 text-center sm:p-10">
        <Package
          className="mx-auto mb-3 size-10 text-[hsl(var(--fg-tertiary))]"
          aria-hidden="true"
        />
        <h3 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t('warehouseShelves.noShelvesTitle')}
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-[hsl(var(--fg-secondary))]">
          {t('warehouseShelves.noShelvesBody')}
        </p>
        {canConfigure ? (
          <button
            type="button"
            onClick={onAddShelf}
            className={cn(
              'mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[hsl(var(--color-primary))] px-5 text-sm font-bold text-[hsl(var(--color-primary-fg))]',
              FOCUS,
            )}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('warehouseShelves.addShelf')}
          </button>
        ) : (
          <p className="mt-3 text-xs text-[hsl(var(--fg-tertiary))]">
            {t('warehouseShelves.noShelvesNoAccess')}
          </p>
        )}
      </section>
    </div>
  )
}

function Notice({
  children,
  tone = 'info',
}: {
  children: React.ReactNode
  tone?: 'info' | 'error'
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 text-sm',
        tone === 'error'
          ? 'bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]'
          : 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--fg-primary))]',
      )}
    >
      {children}
    </div>
  )
}
