'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/shelves/warehouse-shelves-view.tsx
//
// «قفسه‌ها» of ONE warehouse: every shelf as a card, the products recorded on
// it listed underneath, and one card for what is in the warehouse but on no
// shelf yet. Pure: everything comes in as props (the container reads it).
//
// Where the numbers come from:
//   shelves and what sits on them   GET /warehouses/:id/map  (locations[].products)
//   what the warehouse holds        GET /warehouses/:id      (products[].quantity)
//   «بدون قفسه»                     holds − sum on shelves, per product, never < 0
// ============================================

import { useState } from 'react'
import { ArrowLeftRight, ChevronDown, Package, Pencil, Plus, Search } from 'lucide-react'
import type { MapLocation } from '@hisabche/api'

import { cn } from '../../../../lib/utils'
import { searchKey } from '../../select-field'
import type { PlaceRequest, ShelfT, StockOption } from './shelf-dialogs'

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]'
const chipButton = cn(
  'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium sm:min-h-9',
  'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
  FOCUS,
)

export interface WarehouseShelvesViewProps {
  t: ShelfT
  formatQuantity: (value: number) => string
  unitLabel: (unit: string) => string
  state: 'loading' | 'error' | 'not-migrated' | 'ready'
  errorMessage: string | null
  onRetry: () => void
  /** Active shelves of this warehouse, in plan order. */
  shelves: MapLocation[]
  /** Every product this warehouse holds, with what is on no shelf. */
  stock: StockOption[]
  canConfigure: boolean
  canPlace: boolean
  onAddShelf: () => void
  onEditShelf: (shelf: MapLocation) => void
  onRequest: (request: PlaceRequest) => void
  /** The warehouse filter — the same control the catalogue table has beside its search. */
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

export function WarehouseShelvesView({
  t,
  formatQuantity,
  unitLabel,
  state,
  errorMessage,
  onRetry,
  shelves,
  stock,
  canConfigure,
  canPlace,
  onAddShelf,
  onEditShelf,
  onRequest,
  toolbar,
}: WarehouseShelvesViewProps) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())

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

  const needle = searchKey(query)
  const matches = (name: string, sku: string | null) =>
    !needle || searchKey(`${name} ${sku ?? ''}`).includes(needle)
  const unshelved = stock.filter((row) => row.free > 0 && matches(row.name, row.sku))
  const visibleShelves = needle
    ? shelves.filter((shelf) => shelf.products.some((row) => matches(row.name, row.sku)))
    : shelves
  const nothingMatches = needle !== '' && unshelved.length === 0 && visibleShelves.length === 0
  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // A warehouse without shelves still works fully — say so, offer the switch on.
  if (shelves.length === 0) {
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

  return (
    <div className="space-y-4" data-warehouse-shelves="">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block w-full sm:max-w-sm">
            <Search
              className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-[hsl(var(--fg-tertiary))]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('warehouseShelves.search')}
              aria-label={t('warehouseShelves.search')}
              className="min-h-11 w-full rounded-full border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] ps-9 pe-4 text-sm text-[hsl(var(--fg-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
            />
          </label>
          {toolbar}
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <span className="text-xs text-[hsl(var(--fg-tertiary))]">
            {t('warehouseShelves.shelfCount', { count: formatQuantity(shelves.length) })}
          </span>
          {canConfigure ? (
            <button
              type="button"
              onClick={onAddShelf}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full bg-[hsl(var(--color-primary))] px-4 text-sm font-bold text-[hsl(var(--color-primary-fg))] sm:min-h-10',
                FOCUS,
              )}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('warehouseShelves.addShelf')}
            </button>
          ) : null}
        </div>
      </div>

      {nothingMatches ? (
        <p className="rounded-2xl bg-[hsl(var(--surface-muted))] p-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
          {t('warehouseShelves.noMatch')}
        </p>
      ) : null}

      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {unshelved.length > 0 ? (
          <article
            data-unshelved=""
            className="overflow-hidden rounded-2xl border border-[hsl(var(--color-warning)/0.45)] bg-[hsl(var(--color-warning)/0.06)]"
          >
            <header className="px-4 pt-4">
              <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                {t('warehouseShelves.unshelved')}
              </h3>
              <p className="mt-0.5 text-xs text-[hsl(var(--fg-secondary))]">
                {t('warehouseShelves.unshelvedHint')}
              </p>
            </header>
            <ul className="mt-2 divide-y divide-[hsl(var(--border-default)/0.6)]">
              {unshelved.map((row) => (
                <ProductRow
                  key={row.id}
                  name={row.name}
                  sku={row.sku}
                  quantity={`${formatQuantity(row.free)} ${unitLabel(row.unit)}`}
                >
                  {canPlace ? (
                    <button
                      type="button"
                      onClick={() => onRequest({ mode: 'place', productId: row.id })}
                      className={chipButton}
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      {t('warehouseShelves.putOnShelf')}
                    </button>
                  ) : null}
                </ProductRow>
              ))}
            </ul>
          </article>
        ) : null}

        {visibleShelves.map((shelf) => {
          const rows = needle
            ? shelf.products.filter((row) => matches(row.name, row.sku))
            : shelf.products
          const open = needle !== '' || !collapsed.has(shelf.id)
          return (
            <article
              key={shelf.id}
              data-shelf={shelf.code}
              className="overflow-hidden rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-sm"
            >
              <header className="flex items-start gap-2 px-4 pt-4">
                <button
                  type="button"
                  onClick={() => toggle(shelf.id)}
                  aria-expanded={open}
                  aria-label={open ? t('warehouseShelves.collapse') : t('warehouseShelves.expand')}
                  className={cn(
                    'flex min-w-0 flex-1 items-start gap-3 rounded-lg text-start',
                    FOCUS,
                  )}
                >
                  <span
                    className="shrink-0 rounded-lg bg-[hsl(var(--color-primary)/0.12)] px-2.5 py-1 font-mono text-sm font-bold text-[hsl(var(--color-primary))]"
                    dir="ltr"
                  >
                    {shelf.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    {shelf.name ? (
                      <span className="block truncate text-sm font-medium text-[hsl(var(--fg-primary))]">
                        {shelf.name}
                      </span>
                    ) : null}
                    <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('warehouseShelves.shelfItems', {
                        count: formatQuantity(shelf.productCount),
                        quantity: formatQuantity(shelf.quantity),
                      })}
                      {shelf.capacity !== null
                        ? ` · ${t('warehouseShelves.capacity', { capacity: formatQuantity(shelf.capacity) })}`
                        : ''}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'mt-1 size-4 shrink-0 text-[hsl(var(--fg-tertiary))] transition-transform',
                      open && 'rotate-180',
                    )}
                    aria-hidden="true"
                  />
                </button>
                {canConfigure ? (
                  <button
                    type="button"
                    onClick={() => onEditShelf(shelf)}
                    aria-label={t('warehouseShelves.editShelf')}
                    className={cn(
                      'rounded-full p-2 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))]',
                      FOCUS,
                    )}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </header>
              {shelf.capacityUsed !== null ? (
                <div className="mx-4 mt-3 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--surface-muted))]">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      shelf.capacityUsed > 1
                        ? 'bg-[hsl(var(--color-destructive))]'
                        : 'bg-[hsl(var(--color-primary))]',
                    )}
                    style={{ width: `${Math.min(100, Math.round(shelf.capacityUsed * 100))}%` }}
                  />
                </div>
              ) : null}
              {open ? (
                <>
                  {rows.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('warehouseShelves.emptyShelf')}
                    </p>
                  ) : (
                    <ul className="mt-2 divide-y divide-[hsl(var(--border-default)/0.6)]">
                      {rows.map((row) => (
                        <ProductRow
                          key={row.productId}
                          name={row.name}
                          sku={row.sku}
                          quantity={`${formatQuantity(row.quantity)} ${unitLabel(row.unit ?? '')}`}
                        >
                          {canPlace && shelves.length > 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                onRequest({
                                  mode: 'move',
                                  productId: row.productId,
                                  fromShelfId: shelf.id,
                                })
                              }
                              className={chipButton}
                            >
                              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
                              {t('warehouseShelves.move')}
                            </button>
                          ) : null}
                        </ProductRow>
                      ))}
                    </ul>
                  )}
                  {canPlace ? (
                    <div className="border-t border-[hsl(var(--border-default)/0.6)] p-2">
                      <button
                        type="button"
                        onClick={() => onRequest({ mode: 'place', shelfId: shelf.id })}
                        className={cn(chipButton, 'w-full justify-center')}
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                        {t('warehouseShelves.addProductHere')}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </article>
          )
        })}
      </div>

      {stock.length === 0 ? (
        <p className="text-center text-xs text-[hsl(var(--fg-tertiary))]">
          {t('warehouseShelves.emptyWarehouse')}
        </p>
      ) : unshelved.length === 0 && !needle ? (
        <p className="text-center text-xs text-[hsl(var(--fg-tertiary))]">
          {t('warehouseShelves.allShelved')}
        </p>
      ) : null}
    </div>
  )
}

function ProductRow({
  name,
  sku,
  quantity,
  children,
}: {
  name: string
  sku: string | null
  quantity: string
  children?: React.ReactNode
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-[hsl(var(--fg-primary))]">{name}</span>
        {sku ? (
          <span className="block truncate text-xs text-[hsl(var(--fg-tertiary))]" dir="ltr">
            {sku}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
        {quantity}
      </span>
      {children}
    </li>
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
