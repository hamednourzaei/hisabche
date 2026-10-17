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

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  asList,
  useBranches,
  useCreateStorageLocation,
  useMoveProductPlacement,
  useMyCapabilities,
  usePlaceStock,
  useStockPlacement,
  useUpdateStorageLocation,
  useWarehouseDetail,
  useWarehouseMap,
  type Branch,
  type MapLocation,
} from '@hisabche/api'
import { resolveIntlLocale, type UiLanguage } from '@hisabche/formatting'

import { useLocaleReplace } from '../../../../hooks/use-locale-push'
import { translateOr } from '../../../../lib/translate-or'
import { TableFilterSelect } from '../../data-table'
import { ProductListContainer } from '../../products/containers/product-list-container'
import { PlaceDialog, ShelfDialog, type PlaceRequest, type ShelfT } from './shelf-dialogs'
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
  const requested = params.get('stockWarehouse')
  const active = warehouses.some((warehouse) => warehouse.id === requested)
    ? requested!
    : ALL_PRODUCTS

  const pick = useCallback(
    (id: string) =>
      replace(
        id === ALL_PRODUCTS
          ? '/warehouse?view=products'
          : `/warehouse?view=products&stockWarehouse=${id}`,
      ),
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

  return active === ALL_PRODUCTS ? (
    <ProductListContainer actions={filter} />
  ) : (
    <WarehouseShelvesContainer warehouseId={active} toolbar={filter} />
  )
}

export function WarehouseShelvesContainer({
  warehouseId,
  toolbar,
}: {
  warehouseId: string
  toolbar?: React.ReactNode
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

  const [shelfDialog, setShelfDialog] = useState<{ open: boolean; editing: MapLocation | null }>({
    open: false,
    editing: null,
  })
  const [request, setRequest] = useState<PlaceRequest | null>(null)

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
        : map.data?.migrated === false
          ? 'not-migrated'
          : 'ready'

  return (
    <>
      <WarehouseShelvesView
        t={t}
        formatQuantity={formatQuantity}
        unitLabel={unitLabel}
        state={state}
        errorMessage={null}
        onRetry={() => void map.refetch()}
        shelves={shelves}
        stock={stock}
        canConfigure={canConfigure}
        canPlace={canPlace}
        onAddShelf={() => setShelfDialog({ open: true, editing: null })}
        onEditShelf={(shelf) => setShelfDialog({ open: true, editing: shelf })}
        onRequest={setRequest}
        toolbar={toolbar}
      />
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
          shelves={shelves.map((shelf) => ({ id: shelf.id, code: shelf.code, name: shelf.name }))}
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
