'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/shelves/warehouse-products-section.tsx
//
// «کالاها» of the warehouse hub (`/warehouse?view=products`), owner 17 Oct 2026:
// one row of tabs — «همه‌ی کالاها» and every warehouse, each named with its
// branch — and under a warehouse, its shelves with the products on each.
//
// The tab is in the address (`?stockWarehouse=<id>`), so a link opens the same
// shelf list. «همه‌ی کالاها» is the catalogue as it always was.
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
import { SegmentedControl } from '../../segmented-control'
import { SelectField } from '../../select-field'
import { ProductListContainer } from '../../products/containers/product-list-container'
import { PlaceDialog, ShelfDialog, type PlaceRequest, type ShelfT } from './shelf-dialogs'
import { stockOptions, WarehouseShelvesView } from './warehouse-shelves-view'

/** The warehouse tabs; more than this and a searchable list is easier to use. */
export const MAX_WAREHOUSE_TABS = 5
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

  return (
    <div className="space-y-4">
      {warehouses.length > 0 ? (
        <div className="flex justify-center">
          {warehouses.length + 1 <= MAX_WAREHOUSE_TABS ? (
            <SegmentedControl
              label={t('warehouseShelves.pickerLabel')}
              options={options}
              value={active}
              onChange={pick}
              className="overflow-x-auto"
            />
          ) : (
            <div className="w-full sm:max-w-sm">
              <SelectField
                aria-label={t('warehouseShelves.pickerLabel')}
                value={active}
                onChange={pick}
                searchable
                searchPlaceholder={t('warehouseShelves.pickWarehouse')}
                noResultsText={t('warehouseShelves.noMatch')}
                options={options.map((option) => ({ ...option, keywords: option.label }))}
              />
            </div>
          )}
        </div>
      ) : null}
      {active === ALL_PRODUCTS ? (
        <ProductListContainer />
      ) : (
        <WarehouseShelvesContainer warehouseId={active} />
      )}
    </div>
  )
}

export function WarehouseShelvesContainer({ warehouseId }: { warehouseId: string }) {
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
