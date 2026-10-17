'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/map/warehouse-location-drawer.tsx
//
// «چه چیزی روی این قفسه است؟» — one location, in full.
//
// ---------------------------------------------------------------------------
// A DRAWER, NOT A PAGE
//
// Opening a location must not cost a person their place on the map. The drawer
// slides over the floor plan, the map is still behind it, and closing it puts
// the floor back exactly where it was.
//
// ---------------------------------------------------------------------------
// ⚠️ EVERY FACT HERE IS ALSO IN TEXT
//
// The rectangle's colour says «راکد»; this drawer says «بدون فروش از این انبار
// در ۹۴ روز». A person who cannot see the colour, or who is on a phone with no
// hover, gets the same answer. That is why the band is never only a colour.
//
// ⚠️ AND A PLACEMENT IS NOT A STOCK MOVEMENT. «ثبت در این موقعیت» says where
// goods ARE. It cannot create a unit, and the server refuses more than the
// warehouse holds (see `storage_place_stock`).
// ============================================

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import type { MapLocation } from '@hisabche/api'

import { cn } from '../../../../lib/utils'
import { routeForEntity } from '../../../../lib/entity-route'
import { SelectField } from '../../select-field'
import { bandReason, productBand, type MapTranslator } from './map-filtering'

export interface WarehouseLocationDrawerProps {
  t: MapTranslator
  fmt: (value: number) => string
  formatDate: (value: string) => string
  /** `null` closes the drawer. */
  location: MapLocation | null
  costVisible: boolean
  demandWindowDays: number
  /** The warehouse's own stock, for the «what is in this warehouse» hint. */
  warehouseProducts: Array<{ id: string; name: string; quantity: number }>
  /** `product.write` — recording what sits on a shelf. */
  canPlace: boolean
  /** `inventory.configure` — the layout itself (owner on the live capability map). */
  canConfigure: boolean
  isPlacing: boolean
  placeError: string | null
  /** The last answer from the server: what was recorded, and what was free. */
  placedResult: { quantity: number; available: number } | null
  onPlace: (input: { productId: string; quantity: number }) => void
  onEdit: () => void
  onClose: () => void
  onNavigate?: ((route: string) => void) | undefined
}

/** Movement of one product, in the reader's words. */
export function productStatusText(
  product: {
    soldInWindow: number
    daysSinceSale: number | null
    neverSold: boolean
    stagnant: boolean
  },
  demandWindowDays: number,
  t: MapTranslator,
): string {
  const status = productBand(product)
  const label = t(`warehouseMap.band.${status}`)
  if (status === 'moving') return label
  if (product.neverSold) return `${label} — ${t('warehouseMap.reason.neverSold')}`
  if (product.daysSinceSale === null) return label
  return `${label} — ${t('warehouseMap.reason.soldLongAgo', {
    days: product.daysSinceSale,
    window: demandWindowDays,
  })}`
}

export function WarehouseLocationDrawer({
  t,
  fmt,
  formatDate,
  location,
  costVisible,
  demandWindowDays,
  warehouseProducts,
  canPlace,
  canConfigure,
  isPlacing,
  placeError,
  placedResult,
  onPlace,
  onEdit,
  onClose,
  onNavigate,
}: WarehouseLocationDrawerProps) {
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')

  // A new location resets the form — the previous shelf's numbers are not an
  // answer about this one.
  //
  // ⚠️ DURING RENDER, NOT IN AN EFFECT. `setState` in an effect paints the
  // previous shelf's quantity for one frame, and then renders again; React's own
  // answer to «a prop changed» is to adjust the state while rendering.
  const [lastLocationId, setLastLocationId] = useState<string | null>(location?.id ?? null)
  if ((location?.id ?? null) !== lastLocationId) {
    setLastLocationId(location?.id ?? null)
    setProductId('')
    setQuantity('')
  }

  useEffect(() => {
    if (!location) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [location, onClose])

  if (!location) return null

  const reason = bandReason(location, demandWindowDays)
  const reasonText = t(`warehouseMap.reason.${reason.key}`, reason.values)
  const selected = warehouseProducts.find((product) => product.id === productId)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 md:items-stretch"
      role="dialog"
      aria-modal="true"
      aria-label={`${location.code}${location.name ? ` — ${location.name}` : ''}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-[var(--radius-lg)] bg-[hsl(var(--surface-elevated))] shadow-2xl md:max-h-full md:max-w-xl md:rounded-none"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border-default))] px-5 py-4">
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-[hsl(var(--fg-primary))]">
              <span className="tabular-nums">{location.code}</span>
              {location.name ? <span className="font-normal">— {location.name}</span> : null}
              {location.isActive ? null : (
                <span className="rounded-full bg-[hsl(var(--color-warning)/0.15)] px-2 py-0.5 text-xs text-[hsl(var(--color-warning))]">
                  {t('warehouseMap.retired')}
                </span>
              )}
            </h2>
            <p className="mt-0.5 text-xs text-[hsl(var(--fg-tertiary))]">
              {location.path} · {t(`warehouseMap.kind.${location.kind}`)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="shrink-0 rounded-full p-2 text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* The band, in words, with the reason a person can check. */}
          <div className="flex flex-wrap items-baseline gap-2 border-b border-[hsl(var(--border-default))] px-5 py-3">
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-sm',
                location.band === 'moving' &&
                  'bg-[hsl(var(--color-success)/0.15)] text-[hsl(var(--color-success))]',
                location.band === 'slow' &&
                  'bg-[hsl(var(--color-warning)/0.15)] text-[hsl(var(--color-warning))]',
                location.band === 'stagnant' &&
                  'bg-[hsl(var(--color-destructive)/0.15)] text-[hsl(var(--color-destructive))]',
                location.band === 'empty' &&
                  'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
              )}
            >
              {t(`warehouseMap.band.${location.band}`)}
            </span>
            <span className="text-sm text-[hsl(var(--fg-secondary))]">{reasonText}</span>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 py-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('warehouseMap.kpi.products')}
              </dt>
              <dd className="tabular-nums text-[hsl(var(--fg-primary))]">
                {location.productCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('warehouseMap.kpi.quantity')}
              </dt>
              <dd className="tabular-nums text-[hsl(var(--fg-primary))]">{location.quantity}</dd>
            </div>
            <div>
              <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('warehouseMap.kpi.value')}
              </dt>
              {location.value === null ? (
                <dd className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {costVisible ? t('warehouseMap.valueUnknown') : t('warehouseMap.costHidden')}
                </dd>
              ) : (
                <dd className="tabular-nums text-[hsl(var(--fg-primary))]">
                  {fmt(location.value)}
                </dd>
              )}
            </div>
            <div>
              <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('warehouseMap.capacity.label')}
              </dt>
              <dd className="text-[hsl(var(--fg-primary))]">
                {location.capacityUsed === null
                  ? t('warehouseMap.capacity.unknown')
                  : `${Math.round(location.capacityUsed * 100)}%`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('warehouseMap.lastSale')}
              </dt>
              <dd className="text-[hsl(var(--fg-primary))]">
                {location.lastSoldAt === null
                  ? t('warehouseMap.neverSoldHere')
                  : formatDate(location.lastSoldAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('warehouseMap.stagnantProducts')}
              </dt>
              <dd className="tabular-nums text-[hsl(var(--fg-primary))]">
                {location.stagnantProductCount}
              </dd>
            </div>
          </dl>

          {location.productsWithoutCost > 0 && costVisible ? (
            <p className="mx-5 mb-3 flex items-start gap-2 rounded-[var(--radius-sm)] bg-[hsl(var(--color-warning)/0.12)] px-3 py-2 text-xs text-[hsl(var(--color-warning))]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{t('warehouseMap.withoutCost', { count: location.productsWithoutCost })}</span>
            </p>
          ) : null}

          {location.products.some((product) => product.exceedsStock) ? (
            <p className="mx-5 mb-3 flex items-start gap-2 rounded-[var(--radius-sm)] bg-[hsl(var(--color-warning)/0.12)] px-3 py-2 text-xs text-[hsl(var(--color-warning))]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{t('warehouseMap.driftNotice')}</span>
            </p>
          ) : null}

          {location.products.length === 0 ? (
            <p className="px-5 py-3 text-sm text-[hsl(var(--fg-secondary))]">
              {t('warehouseMap.emptyLocation')}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[hsl(var(--surface-elevated))]">
                <tr className="border-b border-[hsl(var(--border-default))] text-xs text-[hsl(var(--fg-tertiary))]">
                  <th className="px-5 py-2 text-start font-medium">{t('warehouseMap.product')}</th>
                  <th className="px-2 py-2 text-end font-medium">
                    {t('warehouseMap.kpi.quantity')}
                  </th>
                  {costVisible ? (
                    <>
                      <th className="px-2 py-2 text-end font-medium">
                        {t('warehouseMap.unitCost')}
                      </th>
                      <th className="px-2 py-2 text-end font-medium">
                        {t('warehouseMap.kpi.value')}
                      </th>
                    </>
                  ) : null}
                  <th className="px-5 py-2 text-start font-medium">
                    {t('warehouseMap.kpi.status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {location.products.map((product) => {
                  const route = routeForEntity('product', product.productId)
                  return (
                    <tr
                      key={product.productId}
                      className="border-b border-[hsl(var(--border-default)/0.5)] last:border-0"
                    >
                      <td className="px-5 py-2">
                        <span className="block text-[hsl(var(--fg-primary))]">
                          {product.name || t('warehouseMap.unknownProduct')}
                        </span>
                        {product.sku ? (
                          <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                            {product.sku}
                          </span>
                        ) : null}
                        {route && onNavigate ? (
                          <button
                            type="button"
                            onClick={() => onNavigate(route)}
                            className="mt-0.5 rounded text-xs text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
                          >
                            {t('warehouseMap.openProduct')}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-end tabular-nums text-[hsl(var(--fg-primary))]">
                        {product.quantity}
                        {product.unit ? (
                          <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                            {' '}
                            {product.unit}
                          </span>
                        ) : null}
                      </td>
                      {costVisible ? (
                        <>
                          <td className="px-2 py-2 text-end tabular-nums text-[hsl(var(--fg-secondary))]">
                            {product.unitCost === null ? '—' : fmt(product.unitCost)}
                          </td>
                          <td className="px-2 py-2 text-end tabular-nums text-[hsl(var(--fg-primary))]">
                            {product.value === null ? '—' : fmt(product.value)}
                          </td>
                        </>
                      ) : null}
                      <td className="px-5 py-2 text-[hsl(var(--fg-secondary))]">
                        {productStatusText(product, demandWindowDays, t)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {canPlace ? (
            <form
              className="space-y-3 border-t border-[hsl(var(--border-default))] px-5 py-4"
              onSubmit={(event) => {
                event.preventDefault()
                const parsed = Number(quantity)
                if (!productId || !Number.isFinite(parsed) || parsed < 0) return
                onPlace({ productId, quantity: parsed })
              }}
            >
              <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                {t('warehouseMap.place.title')}
              </p>
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('warehouseMap.place.hint')}
              </p>
              <SelectField
                aria-label={t('warehouseMap.place.product')}
                value={productId}
                onChange={setProductId}
                placeholder={t('warehouseMap.place.productPlaceholder')}
                options={warehouseProducts.map((product) => ({
                  value: product.id,
                  label: `${product.name} — ${product.quantity}`,
                }))}
              />
              {selected ? (
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {t('warehouseMap.place.warehouseHolds', {
                    name: selected.name,
                    quantity: selected.quantity,
                  })}
                </p>
              ) : null}
              <label className="block text-xs text-[hsl(var(--fg-secondary))]">
                {t('warehouseMap.place.quantity')}
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="mt-1 w-full rounded-[var(--radius-sm)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2 text-sm text-[hsl(var(--fg-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
                />
              </label>
              {placeError ? (
                <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
                  {placeError}
                </p>
              ) : null}
              {placedResult ? (
                <p role="status" className="text-xs text-[hsl(var(--color-success))]">
                  {t('warehouseMap.place.saved', {
                    quantity: placedResult.quantity,
                    available: placedResult.available,
                  })}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={isPlacing || !productId || quantity === ''}
                className="w-full rounded-[var(--radius-sm)] bg-[hsl(var(--color-primary))] px-3 py-2 text-sm font-medium text-[hsl(var(--color-primary-fg))] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
              >
                {isPlacing ? t('warehouseMap.place.saving') : t('warehouseMap.place.save')}
              </button>
            </form>
          ) : null}
        </div>

        {canConfigure ? (
          <footer className="flex items-center justify-between gap-3 border-t border-[hsl(var(--border-default))] px-5 py-3">
            <span className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t('warehouseMap.layoutFootnote')}
            </span>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-[var(--radius-sm)] border border-[hsl(var(--border-default))] px-3 py-1.5 text-sm text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
            >
              {t('warehouseMap.editLocation')}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  )
}
