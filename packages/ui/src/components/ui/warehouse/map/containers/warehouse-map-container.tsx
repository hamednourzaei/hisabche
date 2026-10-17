'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/map/containers/warehouse-map-container.tsx
//
// The data behind the map: one warehouse's plan, the two layout writes, and
// «this is on that shelf».
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT IS NOT HERE
//
// No quantity, no value and no band is computed in this file. They arrive from
// `GET /api/warehouses/:id/map`; the view filters and adds up what it was given.
// Placing goods does NOT change stock — it records where they are — so nothing
// here invalidates a stock or money cache. A transfer between warehouses is
// «انتقال موجودی» on the warehouse screen and is untouched by this feature.
//
// ---------------------------------------------------------------------------
// ⚠️ THIS SECTION HAS ITS OWN ADDRESS PARAMETER
//
// The hub keeps the chosen stock section in `?view=` and clears `?warehouse=`
// when the section changes (it means «the warehouse detail is open»). The map
// therefore remembers which building it is showing in `?mapWarehouse=`, so
//
//   /warehouse?view=map&mapWarehouse=<id>
//
// can be linked, bookmarked and reloaded — including from the «مشاهده نقشه
// انبار» button on a warehouse's own screen.
// ============================================

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useCreateStorageLocation,
  useMyCapabilities,
  usePlaceStock,
  useUpdateStorageLocation,
  useWarehouseDetail,
  useWarehouseMap,
  useWarehouseOverview,
  type WarehouseMap,
} from '@hisabche/api'

import { useDateFormat } from '../../../../../hooks/use-date-format'
import { useLocalePush } from '../../../../../hooks/use-locale-push'
import { fmt } from '../../../../../lib/warehouse/warehouse-format'
import { WarehouseMapView, type WarehouseMapProductOption } from '../warehouse-map-view'
import type { LocationFormValues } from '../location-dialog'
import type { MapTranslator } from '../map-filtering'

/** The window the map opens with — the same 90 days the dead-stock list starts at. */
const DEFAULT_DAYS = 90

/**
 * The server's own word for what went wrong.
 *
 * ⚠️ THIS API ANSWERS IN MORE THAN ONE SHAPE, so read both fields:
 *   · a route's own `fail()` sends `{ error: CODE, code: CODE }`
 *   · the global error handler (anything thrown in a preHandler, e.g. a
 *     capability refusal) sends `{ statusCode, error: 'ForbiddenError',
 *     message: CODE, path, method }` — there is NO `code` in it
 *   · a zod refusal sends `{ error: 'Validation failed', details: [...] }`
 * Reading only one of them turns a specific refusal into «ذخیره نشد» for half
 * the cases.
 */
function serverCode(error: unknown): string {
  const data = (
    error as { response?: { data?: { code?: unknown; message?: unknown } } } | null | undefined
  )?.response?.data
  const value = typeof data?.code === 'string' ? data.code : data?.message
  return typeof value === 'string' ? value : ''
}

/**
 * The plan could not be read.
 *
 * ⚠️ A failed read is an ERROR, never an empty warehouse: «you have no racks»
 * and «we could not ask» send a person to do opposite things.
 */
function readError(error: unknown, t: MapTranslator): string {
  const code = serverCode(error)
  if (code === 'WAREHOUSE_NOT_PERMITTED') return t('warehouseMap.error.notPermitted')
  if (code === 'WAREHOUSE_NOT_FOUND') return t('warehouseMap.error.notFound')
  if (code === 'WAREHOUSE_MAP_SCHEMA_REQUIRED') return t('warehouseMap.schemaRequired')
  return apiErrorMessage(error, t('warehouseMap.error.load'))
}

function layoutErrorText(error: unknown, t: MapTranslator): string {
  const code = serverCode(error)
  if (code === 'STORAGE_LOCATION_CODE_TAKEN') return t('warehouseMap.error.codeTaken')
  if (code === 'STORAGE_LOCATION_CYCLE') return t('warehouseMap.error.cycle')
  if (code === 'STORAGE_LOCATION_PARENT_WAREHOUSE') return t('warehouseMap.error.parentWarehouse')
  if (code === 'WAREHOUSE_MAP_SCHEMA_REQUIRED') return t('warehouseMap.schemaRequired')
  return apiErrorMessage(error, t('warehouseMap.error.save'))
}

/**
 * «بیشتر از موجودی انبار نیست» — the cap the database enforces.
 *
 * The number comes back as the RPC's message; the sentence a person reads must
 * say that the units are not in the WAREHOUSE, because the shelf itself has no
 * limit of its own.
 */
function placeErrorText(error: unknown, t: MapTranslator): string {
  const code = serverCode(error)
  if (code === 'STORAGE_PLACEMENT_EXCEEDS_STOCK') return t('warehouseMap.error.exceedsStock')
  if (code === 'STORAGE_PRODUCT_NOT_FOUND') return t('warehouseMap.error.productNotFound')
  if (code === 'WAREHOUSE_MAP_SCHEMA_REQUIRED') return t('warehouseMap.schemaRequired')
  return apiErrorMessage(error, t('warehouseMap.error.place'))
}

export function WarehouseMapSection() {
  const translate = useTranslations()
  const t = useCallback<MapTranslator>((key, values) => translate(key, values), [translate])
  const dates = useDateFormat()

  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const push = useLocalePush()

  const [days, setDays] = useState(DEFAULT_DAYS)
  const [layoutError, setLayoutError] = useState<string | null>(null)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const [placedResult, setPlacedResult] = useState<{ quantity: number; available: number } | null>(
    null,
  )

  const overview = useWarehouseOverview()
  const warehouses = useMemo(
    () => (overview.data?.warehouses ?? []).map((row) => ({ id: row.id, name: row.name })),
    [overview.data],
  )

  // ⚠️ `?mapWarehouse=` names the building, and a name that is not in the list
  // is not an answer — a warehouse could have been removed, or the link could
  // be from another member's shelf. The first usable warehouse is shown instead.
  const requested = params.get('mapWarehouse')
  const warehouseId =
    requested && warehouses.some((row) => row.id === requested)
      ? requested
      : (warehouses[0]?.id ?? null)

  const pickWarehouse = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params.toString())
      next.set('view', 'map')
      next.set('mapWarehouse', id)
      router.push(`${pathname}?${next.toString()}`)
    },
    [params, pathname, router],
  )

  const mapQuery = useWarehouseMap(warehouseId, days)
  const detail = useWarehouseDetail(warehouseId)
  const capabilities = useMyCapabilities()
  // ⚠️ `=== true`: a capability that has not been read yet is NOT permission
  // (fail closed). The map itself still draws — only the buttons wait.
  const canConfigure = capabilities.can('inventory.configure') === true
  const canPlace = capabilities.can('product.write') === true

  const createLocation = useCreateStorageLocation(warehouseId)
  const updateLocation = useUpdateStorageLocation()
  const place = usePlaceStock()

  const warehouseProducts: WarehouseMapProductOption[] = useMemo(
    () =>
      (detail.data?.products ?? []).map((product) => ({
        id: product.id,
        name: product.name,
        quantity: product.quantity,
        category: product.category ?? null,
      })),
    [detail.data],
  )

  const onCreateLocation = useCallback(
    async (values: LocationFormValues) => {
      setLayoutError(null)
      try {
        return await createLocation.mutateAsync(values)
      } catch (error) {
        setLayoutError(layoutErrorText(error, t))
        throw error
      }
    },
    [createLocation, t],
  )

  const onUpdateLocation = useCallback(
    async (values: LocationFormValues & { id: string }) => {
      setLayoutError(null)
      try {
        return await updateLocation.mutateAsync(values)
      } catch (error) {
        setLayoutError(layoutErrorText(error, t))
        throw error
      }
    },
    [updateLocation, t],
  )

  const onPlace = useCallback(
    async (input: { locationId: string; productId: string; quantity: number }) => {
      setPlaceError(null)
      setPlacedResult(null)
      try {
        const result = await place.mutateAsync(input)
        setPlacedResult({ quantity: result.quantity, available: result.available })
      } catch (error) {
        setPlaceError(placeErrorText(error, t))
      }
    },
    [place, t],
  )

  const map: WarehouseMap | null = mapQuery.data ?? null
  const onNavigate = useCallback((route: string) => push(route), [push])

  return (
    <WarehouseMapView
      t={t}
      fmt={fmt}
      formatDate={dates.date}
      warehouses={warehouses}
      warehouseId={warehouseId}
      onPickWarehouse={pickWarehouse}
      map={map}
      isLoading={mapQuery.isLoading || overview.isLoading}
      errorMessage={mapQuery.isError ? readError(mapQuery.error, t) : null}
      onRetry={() => void mapQuery.refetch()}
      schemaRequired={map?.migrated === false}
      days={days}
      onPickDays={setDays}
      warehouseProducts={warehouseProducts}
      canConfigure={canConfigure}
      canPlace={canPlace}
      isPlacing={place.isPending}
      placeError={placeError}
      placedResult={placedResult}
      onPlace={onPlace}
      layoutPending={createLocation.isPending || updateLocation.isPending}
      layoutError={layoutError}
      onCreateLocation={onCreateLocation}
      onUpdateLocation={onUpdateLocation}
      onNavigate={onNavigate}
    />
  )
}
