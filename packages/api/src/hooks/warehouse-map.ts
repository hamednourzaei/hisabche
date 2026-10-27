// ============================================
// packages/api/src/hooks/warehouse-map.ts
//
// «مشاهده نقشه انبار» — where the goods physically are. Every number comes from
// the server (backend/src/services/inventory/warehouse-map.domain.ts); this file
// only carries the shape of it and the four calls that change the plan.
//
// ⚠️ A PLACEMENT IS NOT A STOCK MOVEMENT. `usePlaceStock` records that goods are
// ON a shelf; it never adds, removes or revalues anything. So it invalidates the
// map and NOTHING else — there is no money or stock figure for it to invalidate.
// The warehouse's own numbers live in `warehouses.ts` and stay untouched.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'
import { warehouseKeys } from './warehouses'

/**
 * How goods in a location move — the same bands the dead-stock list uses, from
 * the same constants (backend/src/services/inventory/reorder.domain.ts):
 *
 *   empty     nothing is recorded there
 *   moving    everything there sold inside the demand window (30 days)
 *   slow      sold, but not inside the window and not yet dead
 *   stagnant  every product there is dead stock (90 days, or never sold)
 */
export type HeatBand = 'empty' | 'moving' | 'slow' | 'stagnant'

/** Which figure colours the floor. `value` is not offered without cost access. */
export type MapMetric = 'band' | 'quantity' | 'value'

export interface MapLocationProduct {
  productId: string
  name: string
  sku: string | null
  unit: string | null
  quantity: number
  /** `null` = no purchase price on the product, or no permission to read it. */
  unitCost: number | null
  /** `null` = not shown to this reader, or the product has no price. Never 0. */
  value: number | null
  lastSoldAt: string | null
  daysSinceSale: number | null
  neverSold: boolean
  soldInWindow: number
  avgDailySales: number
  stagnant: boolean
  /** The locations of this warehouse claim more of it than the warehouse holds. */
  exceedsStock: boolean
}

export interface MapLocation {
  id: string
  code: string
  name: string | null
  kind: string
  parentId: string | null
  depth: number
  /** `Z01 › R02 › S04` — the codes from the root down. */
  path: string
  x: number
  y: number
  width: number
  height: number
  capacity: number | null
  isActive: boolean
  products: MapLocationProduct[]
  productCount: number
  quantity: number
  /** `null` = the reader may not see what the stock cost. */
  value: number | null
  /** Products here with no purchase price — not included in `value`. */
  productsWithoutCost: number
  lastSoldAt: string | null
  daysSinceSale: number | null
  neverSold: boolean
  band: HeatBand
  stagnantProductCount: number
  stagnantQuantity: number
  stagnantValue: number | null
  /** 0–3, relative to the fullest location of THIS warehouse. */
  quantityClass: number
  /** `null` when the reader may not see cost. */
  valueClass: number | null
  /** `null` until a capacity is recorded for this location. */
  capacityUsed: number | null
}

export interface WarehouseMapTotals {
  locationCount: number
  activeLocationCount: number
  retiredLocationCount: number
  emptyLocationCount: number
  locationProductCount: number
  placedQuantity: number
  placedValue: number | null
  stagnantLocationCount: number
  stagnantValue: number | null
  stagnantQuantity: number
  /** Products with no purchase price: every money figure above is a lower bound. */
  productsWithoutCost: number
  capacityTotal: number | null
  capacityRecordedCount: number
}

export interface WarehouseMap {
  warehouse: { id: string; name: string; branchId: string | null; branchName: string | null }
  currency: string
  /** False = this reader may not see cost; every money figure above is null. */
  costVisible: boolean
  /** The staleness threshold the map was built with. */
  days: number
  demandWindowDays: number
  asOf: string
  /** False = `docs/warehouse-map-01-migration.sql` has not been run yet. */
  migrated: boolean
  /**
   * The answer came from the device's engine, which keeps shelves but not the
   * map's heat, stagnation and value. That is «not available offline» — NOT
   * «the server's script has not been run», which is what `migrated: false` says.
   */
  notAvailableOffline?: boolean
  /** The shelf each product's purchases fill; `null` = shelf-capacity-01 not run. */
  autoShelves?: Array<{ productId: string; locationId: string }> | null
  locations: MapLocation[]
  totals: WarehouseMapTotals
  unplaced: { productCount: number; quantity: number; value: number | null }
  drift: { productCount: number; quantity: number; value: number | null }
}

export const warehouseMapKeys = {
  all: ['warehouse-map'] as const,
  one: (warehouseId: string, days: number) => [...warehouseMapKeys.all, warehouseId, days] as const,
}

const emptyTotals: WarehouseMapTotals = {
  locationCount: 0,
  activeLocationCount: 0,
  retiredLocationCount: 0,
  emptyLocationCount: 0,
  locationProductCount: 0,
  placedQuantity: 0,
  placedValue: null,
  stagnantLocationCount: 0,
  stagnantValue: null,
  stagnantQuantity: 0,
  productsWithoutCost: 0,
  capacityTotal: null,
  capacityRecordedCount: 0,
}

/**
 * The map of one warehouse.
 *
 * ⚠️ Read fresh every time it is opened and never persisted to the device: it
 * is a picture of where the goods are right now, and a stale one sends a person
 * to the wrong shelf. `migrated: false` is a real answer — the screen names the
 * script instead of drawing an empty warehouse.
 */
export function useWarehouseMap(warehouseId: string | null, days: number) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: warehouseMapKeys.one(warehouseId ?? '', days),
    queryFn: async (): Promise<WarehouseMap> => {
      const { data } = await apiClient.get<Partial<WarehouseMap>>(
        `/warehouses/${warehouseId}/map`,
        {
          params: { days },
        },
      )
      return {
        warehouse: data?.warehouse ?? { id: '', name: '', branchId: null, branchName: null },
        // ⚠️ No currency is invented here: the server fills it from the books.
        currency: data?.currency ?? '',
        costVisible: data?.costVisible === true,
        days: Number(data?.days ?? days),
        demandWindowDays: Number(data?.demandWindowDays ?? 30),
        asOf: data?.asOf ?? '',
        // ⚠️ The server always says `migrated`; the device's engine never does.
        // A missing flag is the engine, not an old database.
        migrated: data?.migrated === true,
        notAvailableOffline: data?.migrated === undefined,
        locations: asList<MapLocation>(data?.locations),
        totals: data?.totals ?? emptyTotals,
        unplaced: data?.unplaced ?? { productCount: 0, quantity: 0, value: null },
        drift: data?.drift ?? { productCount: 0, quantity: 0, value: null },
        // Mapped by name, like every field here: left out, it would vanish.
        autoShelves: Array.isArray(data?.autoShelves) ? data.autoShelves : null,
      }
    },
    enabled: authReady && !!warehouseId,
    staleTime: 0,
    refetchOnMount: 'always',
    meta: { persist: false },
  })
}

export interface CreateStorageLocationInput {
  parentId?: string | null | undefined
  code: string
  name?: string | undefined
  kind?: 'zone' | 'aisle' | 'rack' | 'shelf' | 'bin' | undefined
  x?: number | undefined
  y?: number | undefined
  width?: number | undefined
  height?: number | undefined
  capacity?: number | null | undefined
}

/**
 * Put a shelf in a warehouse (`inventory.configure`). `input.warehouseId`
 * names a warehouse created a moment ago (the warehouse form's shelf rows);
 * otherwise the hook's own warehouse.
 */
export function useCreateStorageLocation(warehouseId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      warehouseId: target,
      ...input
    }: CreateStorageLocationInput & { warehouseId?: string | undefined }) => {
      const { data } = await apiClient.post(`/warehouses/${target ?? warehouseId}/locations`, input)
      return data as { id: string; code: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseMapKeys.all })
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all })
    },
  })
}

export interface UpdateStorageLocationInput {
  code?: string | undefined
  name?: string | undefined
  kind?: 'zone' | 'aisle' | 'rack' | 'shelf' | 'bin' | undefined
  x?: number | undefined
  y?: number | undefined
  width?: number | undefined
  height?: number | undefined
  capacity?: number | null | undefined
  /** Retirement, not deletion: what is recorded there stays. */
  isActive?: boolean | undefined
}

/** Rename, move or retire a location (owner only — `inventory.configure`). */
export function useUpdateStorageLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateStorageLocationInput & { id: string }) => {
      const { id, ...body } = input
      const { data } = await apiClient.patch(`/storage-locations/${id}`, body)
      return data as { id: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseMapKeys.all })
    },
  })
}

/**
 * Record what actually sits in a location (`product.write`).
 *
 * The server refuses more units than the WAREHOUSE holds, so the answer to
 * «چند تا جا میشود؟» is the server's, not this screen's.
 */
/** One product's shelves, per warehouse the member may use (the product page). */
export interface ProductStorageWarehouse {
  id: string
  name: string
  onHand: number
  placed: Array<{ locationId: string; code: string; name: string | null; quantity: number }>
  choices: Array<{ id: string; code: string; name: string | null }>
}

export type ProductStorageLocations =
  { configured: false } | { configured: true; warehouses: ProductStorageWarehouse[] }

/**
 * Where ONE product sits, shelf by shelf. Under `warehouseMapKeys.all`, so
 * placing or moving stock anywhere refreshes the product page too. Read fresh
 * and never persisted to the device (a stale shelf sends a person the wrong way).
 */
export function useProductStorageLocations(productId: string | null) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: [...warehouseMapKeys.all, 'product', productId ?? ''] as const,
    queryFn: async (): Promise<ProductStorageLocations> => {
      const { data } = await apiClient.get<Partial<{ configured: boolean; warehouses: unknown }>>(
        `/products/${productId}/storage-locations`,
      )
      if (data?.configured === false) return { configured: false }
      return { configured: true, warehouses: asList<ProductStorageWarehouse>(data?.warehouses) }
    },
    enabled: authReady && !!productId,
    staleTime: 0,
    meta: { persist: false },
  })
}

/**
 * Move units of one product from one shelf to another in the same warehouse.
 *
 * Two calls of the ONE placing path, in this order: the old shelf goes down
 * first, so the warehouse cap is never exceeded midway. If the second call
 * fails the units are «not on a shelf» — an honest state — and the error is
 * returned; nothing invents a stock figure.
 */
export function useMoveProductPlacement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      productId: string
      fromLocationId: string | null
      fromQuantityAfter: number
      toLocationId: string
      toQuantityAfter: number
    }) => {
      if (input.fromLocationId) {
        await apiClient.post(`/storage-locations/${input.fromLocationId}/place`, {
          productId: input.productId,
          quantity: input.fromQuantityAfter,
        })
      }
      await apiClient.post(`/storage-locations/${input.toLocationId}/place`, {
        productId: input.productId,
        quantity: input.toQuantityAfter,
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: warehouseMapKeys.all })
    },
  })
}

/** «خریدهای بعدی این کالا خودکار روی همین قفسه برود» — on or off. */
export function useSetAutoShelf() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { locationId: string; productId: string; enabled: boolean }) => {
      const { data } = await apiClient.put(`/storage-locations/${input.locationId}/auto-shelf`, {
        productId: input.productId,
        enabled: input.enabled,
      })
      return data as { locationId: string; productId: string; enabled: boolean }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseMapKeys.all })
    },
  })
}

export function usePlaceStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { locationId: string; productId: string; quantity: number }) => {
      const { data } = await apiClient.post(`/storage-locations/${input.locationId}/place`, {
        productId: input.productId,
        quantity: input.quantity,
      })
      return data as { locationId: string; productId: string; quantity: number; available: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseMapKeys.all })
    },
  })
}
