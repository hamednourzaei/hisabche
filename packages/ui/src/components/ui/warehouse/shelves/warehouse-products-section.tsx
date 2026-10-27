'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/shelves/warehouse-products-section.tsx
//
// «کالاها» of the warehouse hub (`/warehouse?view=products`), owner 17 Oct 2026.
//
// The warehouse is a FILTER of the list, not a third row of tabs (owner, same
// day: «خیلی شلوغ شد» — hub tabs, section switch and warehouse pills were three
// centred rows). It sits in the toolbar of whichever list is on screen, beside
// its search: «همه‌ی انبارها» = the catalogue as it always was; one warehouse =
// its shelves with the products on each. It is in the address
// (`?stockWarehouse=<id>`), so a link opens the same shelf list.
//
// ⚠️ The floor map (x/y/width/height) is gone from the product. Its tables and
// routes stay: a shelf is the same `storage_locations` row, read through the
// same `/warehouses/:id/map` answer.
// ============================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  asList,
  useBranches,
  useCreateStorageLocation,
  useMoveProductPlacement,
  useMyCapabilities,
  usePlaceStock,
  useSetAutoShelf,
  useStockPlacement,
  useTransferStock,
  useUpdateStorageLocation,
  useWarehouseOverview,
  useWarehouseDetail,
  useWarehouseMap,
  type Branch,
  type MapLocation,
} from '@hisabche/api'
import {
  formatMoney,
  resolveIntlLocale,
  type KnownCurrency,
  type UiLanguage,
} from '@hisabche/formatting'

import { useBookCurrency } from '../../../../hooks/use-book-currency'
import { useLocaleReplace } from '../../../../hooks/use-locale-push'
import { translateOr } from '../../../../lib/translate-or'
import { TableFilterSelect } from '../../data-table'
import { ProductListContainer } from '../../products/containers/product-list-container'
import { TransferStockDialog } from '../warehouse-dialogs'
import { PlaceDialog, ShelfDialog, type PlaceRequest, type ShelfT } from './shelf-dialogs'
import { ShelfMapView, ShelfProductsView, type PlainT } from './warehouse-shelf-map'
import { ShelfOverflowNotice, shelfOverflows } from './shelf-overflow'
import { stockOptions, WarehouseShelvesView } from './warehouse-shelves-view'

export const ALL_PRODUCTS = 'all'
/** The read window of the map answer; the shelves screen shows no staleness. */
const DAYS = 90

export function WarehouseProductsSection() {
  const t = useTranslations() as unknown as ShelfT
  const params = useSearchParams()
  const replace = useLocaleReplace()
  const placement = useStockPlacement()
  const branches = asList<Branch>(useBranches().data)

  const warehouses = placement.data?.warehouses ?? []
  // ONE address for a warehouse's shelves (owner, 18 Oct 2026: «دوتا یو ار ال
  // میخوام چیکار»): `?view=shelfMap&stockWarehouse=<id>`. The old
  // `?view=products&stockWarehouse=<id>` goes there, and picking a warehouse
  // in this filter opens its shelf map.
  const requested = params.get('stockWarehouse')
  useEffect(() => {
    if (requested) replace(`/warehouse?view=shelfMap&stockWarehouse=${requested}`)
  }, [requested, replace])
  const active = ALL_PRODUCTS

  const pick = useCallback(
    (id: string) => {
      if (id !== ALL_PRODUCTS) replace(`/warehouse?view=shelfMap&stockWarehouse=${id}`)
    },
    [replace],
  )

  const branchName = (id: string | null, fallback: string | null) =>
    fallback ?? branches.find((branch) => branch.id === id)?.name ?? null
  const options = [
    { value: ALL_PRODUCTS, label: t('warehouseShelves.all') },
    ...warehouses.map((warehouse) => {
      const branch = branchName(warehouse.branchId, warehouse.branchName)
      return {
        value: warehouse.id,
        label: branch ? `${warehouse.name} · ${branch}` : warehouse.name,
      }
    }),
  ]

  // One business-wide warehouse or none: nothing to choose, no filter shown.
  const filter =
    warehouses.length > 0 ? (
      <TableFilterSelect
        label={t('warehouseShelves.pickerLabel')}
        value={active}
        options={options}
        onChange={pick}
        allValue={ALL_PRODUCTS}
      />
    ) : null

  return <ProductListContainer actions={filter} />
}

/**
 * «نقشه قفسه‌ها» — its own button in the hub switch (owner, 18 Oct 2026).
 * `/warehouse?view=shelfMap&stockWarehouse=<id>` is the map of one warehouse;
 * `&shelf=<id>` opens one shelf as a table. Both are in the address, so a link
 * to «قفسه A-1» opens A-1. No warehouse named = the first one.
 */
export function WarehouseShelfMapSection() {
  const t = useTranslations() as unknown as ShelfT
  const params = useSearchParams()
  const replace = useLocaleReplace()
  const placement = useStockPlacement()
  const branches = asList<Branch>(useBranches().data)
  const warehouses = placement.data?.warehouses ?? []

  const requested = params.get('stockWarehouse')
  const active = warehouses.find((warehouse) => warehouse.id === requested) ?? warehouses[0]
  const shelfId = params.get('shelf')

  const go = useCallback(
    (warehouseId: string, shelf?: string | null) =>
      replace(
        `/warehouse?view=shelfMap&stockWarehouse=${warehouseId}${shelf ? `&shelf=${shelf}` : ''}`,
      ),
    [replace],
  )

  if (placement.isLoading) {
    return (
      <div
        className="h-40 animate-pulse rounded-2xl bg-[hsl(var(--surface-muted))]"
        aria-busy="true"
      />
    )
  }
  if (!active) {
    return (
      <p className="rounded-2xl bg-[hsl(var(--surface-muted))] p-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
        {t('warehouseShelves.map.noWarehouse')}
      </p>
    )
  }

  const filter =
    warehouses.length > 1 ? (
      <TableFilterSelect
        label={t('warehouseShelves.pickerLabel')}
        value={active.id}
        options={warehouses.map((warehouse) => {
          const branch =
            warehouse.branchName ??
            branches.find((row) => row.id === warehouse.branchId)?.name ??
            null
          return {
            value: warehouse.id,
            label: branch ? `${warehouse.name} · ${branch}` : warehouse.name,
          }
        })}
        onChange={(id) => go(id)}
      />
    ) : null

  return (
    <WarehouseShelvesContainer
      warehouseId={active.id}
      warehouseName={active.name}
      toolbar={filter}
      shelfId={shelfId}
      onOpenShelf={(id) => go(active.id, id)}
    />
  )
}

export function WarehouseShelvesContainer({
  warehouseId,
  warehouseName = '',
  toolbar,
  shelfId = null,
  onOpenShelf,
}: {
  warehouseId: string
  warehouseName?: string | undefined
  toolbar?: React.ReactNode
  shelfId?: string | null | undefined
  /** `null` = back to the map. */
  onOpenShelf?: ((shelfId: string | null) => void) | undefined
}) {
  const t = useTranslations() as unknown as ShelfT
  const locale = resolveIntlLocale(useLocale() as UiLanguage)
  const number = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }),
    [locale],
  )
  const formatQuantity = useCallback((value: number) => number.format(value), [number])
  const unitLabel = useCallback(
    (unit: string) => (unit ? translateOr(t as never, `unit.${unit}`, unit) : ''),
    [t],
  )

  const map = useWarehouseMap(warehouseId, DAYS)
  const detail = useWarehouseDetail(warehouseId)
  const capabilities = useMyCapabilities()
  // ⚠️ `=== true`: a capability not read yet is NOT permission (fail closed).
  const canConfigure = capabilities.can('inventory.configure') === true
  const canPlace = capabilities.can('product.write') === true

  const createShelf = useCreateStorageLocation(warehouseId)
  const updateShelf = useUpdateStorageLocation()
  const place = usePlaceStock()
  const move = useMoveProductPlacement()
  const setAuto = useSetAutoShelf()

  const [shelfDialog, setShelfDialog] = useState<{ open: boolean; editing: MapLocation | null }>({
    open: false,
    editing: null,
  })
  const [request, setRequest] = useState<PlaceRequest | null>(null)
  /** «انتقال به انبار دیگر» from one shelf: which product, from which shelf. */
  const [transfer, setTransfer] = useState<{ productId: string; shelfId: string } | null>(null)
  const transferStock = useTransferStock()
  const overview = useWarehouseOverview()
  const bookCurrency = useBookCurrency()
  const formatValue = useCallback(
    (value: number) =>
      bookCurrency
        ? formatMoney(value, bookCurrency as KnownCurrency, locale)
        : number.format(value),
    [bookCurrency, locale, number],
  )
  const plainT: PlainT = useCallback(
    (key: string, fallback?: string) => translateOr(t as never, key, fallback ?? key),
    [t],
  )
  const targets = (overview.data?.warehouses ?? [])
    .filter((item) => item.isActive && item.id !== warehouseId)
    .map((item) => ({ id: item.id, name: item.name }))

  const shelves = useMemo(
    () => (map.data?.locations ?? []).filter((location) => location.isActive),
    [map.data],
  )
  const stock = useMemo(
    () => stockOptions(detail.data?.products ?? [], shelves),
    [detail.data, shelves],
  )

  const state =
    map.isLoading || detail.isLoading
      ? 'loading'
      : map.isError
        ? 'error'
        : map.data?.notAvailableOffline === true
          ? 'offline-unavailable'
          : map.data?.migrated === false
            ? 'not-migrated'
            : 'ready'

  const openShelf = shelfId ? shelves.find((s) => s.id === shelfId) : undefined
  const unshelvedCount = stock.filter((row) => row.free > 0).length
  const overflows = shelfOverflows(map.data, stock)
  const mapBody =
    state !== 'ready' || shelves.length === 0 ? null : openShelf ? (
      <ShelfProductsView
        t={t}
        plainT={plainT}
        formatQuantity={formatQuantity}
        formatMoney={formatValue}
        unitLabel={unitLabel}
        shelf={openShelf}
        warehouseName={warehouseName}
        canPlace={canPlace}
        canMove={canPlace && shelves.length > 1}
        canTransfer={canPlace && targets.length > 0}
        onBack={() => onOpenShelf?.(null)}
        onAdd={() => setRequest({ mode: 'place', shelfId: openShelf.id })}
        onMove={(row) =>
          setRequest({ mode: 'move', productId: row.productId, fromShelfId: openShelf.id })
        }
        onTransfer={(row) => setTransfer({ productId: row.productId, shelfId: openShelf.id })}
        onEdit={canConfigure ? () => setShelfDialog({ open: true, editing: openShelf }) : undefined}
      />
    ) : (
      <div className="space-y-4">
        {/* What the shelf cards had, now on the one shelf page: add a shelf,
            and the goods that are on no shelf yet. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          <div className="flex flex-wrap items-center gap-2">
            {canPlace && unshelvedCount > 0 ? (
              <button
                type="button"
                data-unshelved=""
                onClick={() => setRequest({ mode: 'place' })}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[hsl(var(--color-warning)/0.14)] px-4 text-xs font-medium text-[hsl(var(--fg-primary))]"
              >
                {t('warehouseShelves.map.unshelvedButton', {
                  count: formatQuantity(unshelvedCount),
                })}
              </button>
            ) : null}
            {canConfigure ? (
              <button
                type="button"
                onClick={() => setShelfDialog({ open: true, editing: null })}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[hsl(var(--color-primary))] px-4 text-sm font-bold text-[hsl(var(--color-primary-fg))]"
              >
                {t('warehouseShelves.addShelf')}
              </button>
            ) : null}
          </div>
        </div>
        <ShelfMapView
          t={t}
          formatQuantity={formatQuantity}
          shelves={shelves}
          onOpenShelf={(shelf) => onOpenShelf?.(shelf.id)}
        />
      </div>
    )

  return (
    <>
      <ShelfOverflowNotice
        t={t}
        overflows={overflows}
        formatQuantity={formatQuantity}
        unitLabel={unitLabel}
        onOpenShelf={(id) => onOpenShelf?.(id)}
      />
      {mapBody ?? (
        <WarehouseShelvesView
          t={t}
          state={state}
          errorMessage={null}
          onRetry={() => void map.refetch()}
          shelves={shelves}
          canConfigure={canConfigure}
          onAddShelf={() => setShelfDialog({ open: true, editing: null })}
          toolbar={toolbar}
        />
      )}
      {canPlace && targets.length > 0 ? (
        <TransferStockDialog
          t={plainT}
          fmt={formatQuantity}
          open={transfer !== null}
          onClose={() => setTransfer(null)}
          warehouseName={warehouseName}
          products={(detail.data?.products ?? []).filter(
            (product) => product.id === transfer?.productId,
          )}
          initialProductId={transfer?.productId}
          targets={targets}
          isPending={transferStock.isPending || place.isPending}
          onTransfer={async (input) => {
            const from = transfer
            await transferStock.mutateAsync({ ...input, fromWarehouseId: warehouseId })
            // What left the warehouse left this shelf: the shelf no longer claims it.
            if (from) {
              const onShelf =
                stock.find((row) => row.id === from.productId)?.onShelf[from.shelfId] ?? 0
              await place.mutateAsync({
                locationId: from.shelfId,
                productId: from.productId,
                quantity: Math.max(0, onShelf - input.quantity),
              })
            }
          }}
        />
      ) : null}
      {canConfigure ? (
        <ShelfDialog
          t={t}
          open={shelfDialog.open}
          editing={shelfDialog.editing}
          isPending={createShelf.isPending || updateShelf.isPending}
          onClose={() => setShelfDialog({ open: false, editing: null })}
          onSubmit={(values) =>
            shelfDialog.editing
              ? updateShelf.mutateAsync({ id: shelfDialog.editing.id, ...values })
              : createShelf.mutateAsync({ kind: 'shelf', ...values })
          }
        />
      ) : null}
      {canPlace ? (
        <PlaceDialog
          t={t}
          formatQuantity={formatQuantity}
          unitLabel={unitLabel}
          request={request}
          shelves={shelves.map((shelf) => ({
            id: shelf.id,
            code: shelf.code,
            name: shelf.name,
            capacity: shelf.capacity,
            occupied: shelf.quantity,
          }))}
          autoShelfOf={(productId) =>
            map.data?.autoShelves?.find((row) => row.productId === productId)?.locationId ?? null
          }
          onSetAuto={
            map.data?.autoShelves
              ? ({ shelfId, productId, enabled }) =>
                  setAuto.mutateAsync({ locationId: shelfId, productId, enabled })
              : undefined
          }
          products={stock}
          isPending={place.isPending || move.isPending}
          onClose={() => setRequest(null)}
          onPlace={({ shelfId, productId, quantity }) =>
            place.mutateAsync({ locationId: shelfId, productId, quantity })
          }
          onMove={({ productId, fromShelfId, toShelfId, quantity }) => {
            const product = stock.find((row) => row.id === productId)
            const from = product?.onShelf[fromShelfId] ?? 0
            const to = product?.onShelf[toShelfId] ?? 0
            return move.mutateAsync({
              productId,
              fromLocationId: fromShelfId,
              fromQuantityAfter: from - quantity,
              toLocationId: toShelfId,
              toQuantityAfter: to + quantity,
            })
          }}
        />
      ) : null}
    </>
  )
}
