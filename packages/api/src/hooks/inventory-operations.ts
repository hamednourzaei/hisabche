// ============================================
// packages/api/src/hooks/inventory-operations.ts
//
// T11 — client hooks for backend that had none.
//
// Every endpoint below already existed and had ZERO callers. That is the
// pattern this whole task list keeps turning up: the work was done server-side
// and never reached a screen, so from a user's point of view it did not exist.
//
//   L1  PUT /products/:id/units          multi-unit was unusable without it
//   L2  /cycle-counts                    stock counting
//   L3  /inventory/reorder-suggestions
//   L4  /inventory/dead-stock
//   M3  /pos/sessions/history
//   N3  /intelligence/cash-forecast
//   N4  /intelligence/stale-opportunities
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { asList } from '../lib/as-list'

// ─── L1 · product units ───────────────────────────────────────────────

export interface ProductUnit {
  id: string
  unitId: string
  unitCode: string
  unitName: string | null
  /** Base units per one of THIS unit, for THIS product. */
  conversionFactorToBase: number
  isBaseUnit: boolean
  isPurchaseDefault: boolean
  isSaleDefault: boolean
}

export interface ProductUnitInput {
  unitId: string
  conversionFactorToBase: number
  isBaseUnit: boolean
  isPurchaseDefault: boolean
  isSaleDefault: boolean
}

export const inventoryOpsKeys = {
  all: ['inventory-ops'] as const,
  productUnits: (productId: string) =>
    [...inventoryOpsKeys.all, 'product-units', productId] as const,
  cycleCounts: (status?: string) =>
    [...inventoryOpsKeys.all, 'cycle-counts', status ?? 'all'] as const,
  reorder: () => [...inventoryOpsKeys.all, 'reorder'] as const,
  deadStock: (days?: number) => [...inventoryOpsKeys.all, 'dead-stock', days ?? 90] as const,
  shiftHistory: () => [...inventoryOpsKeys.all, 'shift-history'] as const,
  cashForecast: (days?: number) => [...inventoryOpsKeys.all, 'cash-forecast', days ?? 30] as const,
  staleOpportunities: () => [...inventoryOpsKeys.all, 'stale-opportunities'] as const,
}

export function useProductUnits(productId?: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: inventoryOpsKeys.productUnits(productId ?? ''),
    queryFn: async (): Promise<ProductUnit[]> => {
      const { data } = await apiClient.get(`/products/${productId}/units`)
      return asList<ProductUnit>(data)
    },
    enabled: ready && Boolean(productId),
  })
}

/**
 * Replace a product's whole unit set.
 *
 * ⚠️ THE WHOLE SET, not one row. «Exactly one base», «the base factor is 1»
 * and «at most one default per side» are properties of the set — editing row
 * by row passes through states that break them, and the database enforces
 * those rules with partial unique indexes.
 *
 * An empty array is legitimate and means «this product is single-unit again».
 */
export function useSaveProductUnits(productId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (units: ProductUnitInput[]) => {
      const { data } = await apiClient.put(`/products/${productId}/units`, { units })
      return asList<ProductUnit>(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryOpsKeys.productUnits(productId) })
      // How a quantity is read just changed, so anything showing quantities is
      // stale — not only this product's own row.
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['warehouse'] })
    },
  })
}

// ─── L2 · cycle counts ────────────────────────────────────────────────

export type CycleCountStatus = 'draft' | 'counting' | 'completed' | 'cancelled'

/**
 * One line of a count.
 *
 * ⚠️ `expectedQty` is FROZEN when the count is opened, not read again at
 * completion. Re-reading it would compare the shelf against a quantity that
 * has moved since, so every sale made during the count would read as a
 * shortage — the write-off would be exactly the day's takings.
 */
export interface CycleCountLine {
  id: string
  product_id: string
  expected_qty: number
  /** Null until somebody has actually counted this line. */
  counted_qty: number | null
  variance_qty: number | null
  variance_value: number | null
  notes: string | null
}

/** Field names are the server's, unmapped — see the note on `useCycleCount`. */
export interface CycleCount {
  id: string
  count_number: string | null
  status: CycleCountStatus
  warehouse_id: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  notes: string | null
  /** Money. Populated once the count is completed and priced. */
  shortage_value: number | null
  surplus_value: number | null
  net_loss: number | null
  lines?: CycleCountLine[]
}

export function useCycleCounts(status?: CycleCountStatus) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: inventoryOpsKeys.cycleCounts(status),
    queryFn: async (): Promise<CycleCount[]> => {
      const { data } = await apiClient.get('/cycle-counts', {
        params: status ? { status } : {},
      })
      return asList<CycleCount>(data)
    },
    enabled: ready,
  })
}

/**
 * One count with its lines.
 *
 * ⚠️ The field names are snake_case because that is what the endpoint returns
 * — it selects straight from the table. Renaming them here would be a second
 * mapping to keep in step for no gain; the shape is documented above instead.
 */
export function useCycleCount(countId?: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: [...inventoryOpsKeys.all, 'cycle-count', countId ?? ''],
    queryFn: async (): Promise<CycleCount> => {
      const { data } = await apiClient.get(`/cycle-counts/${countId}`)
      return data as CycleCount
    },
    enabled: ready && Boolean(countId),
  })
}

export function useCancelCycleCount(countId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    // The reason is required by the server: a cancelled count with no
    // explanation is unauditable.
    mutationFn: async (reason: string) => {
      const { data } = await apiClient.post(`/cycle-counts/${countId}/cancel`, { reason })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryOpsKeys.all })
    },
  })
}

export function useCreateCycleCount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { warehouseId: string; productIds: string[]; notes?: string }) => {
      const { data } = await apiClient.post('/cycle-counts', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryOpsKeys.all })
    },
  })
}

/** The route is `/lines`, not `/record` — verified against cycle-count.routes.ts. */
export function useRecordCount(countId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { productId: string; countedQty: number }) => {
      const { data } = await apiClient.post(`/cycle-counts/${countId}/lines`, input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryOpsKeys.all })
    },
  })
}

export function useCompleteCycleCount(countId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/cycle-counts/${countId}/complete`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryOpsKeys.all })
      // Completing a count writes ADJUSTMENT stock movements — real inventory
      // change, so stock and its value both moved.
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['warehouse'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ─── L3 · reorder suggestions ─────────────────────────────────────────

export interface ReorderSuggestion {
  productId: string
  productName: string
  onHand: number
  reorderLevel: number
  suggestedQuantity: number
  /** Days of cover left at the current sales rate, or null when unknown. */
  daysOfCover?: number | null
}

export function useReorderSuggestions() {
  const ready = useAuthReady()

  return useQuery({
    queryKey: inventoryOpsKeys.reorder(),
    queryFn: async (): Promise<ReorderSuggestion[]> => {
      const { data } = await apiClient.get('/inventory/reorder-suggestions')
      return asList<ReorderSuggestion>(data)
    },
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── L4 · dead stock ──────────────────────────────────────────────────

export interface DeadStockItem {
  productId: string
  productName: string
  onHand: number
  stockValue: number
  lastMovementAt: string | null
  daysSinceMovement: number | null
}

export function useDeadStock(days = 90) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: inventoryOpsKeys.deadStock(days),
    queryFn: async (): Promise<DeadStockItem[]> => {
      const { data } = await apiClient.get('/inventory/dead-stock', { params: { days } })
      return asList<DeadStockItem>(data)
    },
    enabled: ready,
    staleTime: 10 * 60 * 1000,
  })
}

// ─── M3 · shift history ───────────────────────────────────────────────

export interface ShiftHistoryEntry {
  id: string
  openedAt: string
  closedAt: string | null
  openingFloatMinor: number
  countedCashMinor: number | null
  expectedCashMinor: number | null
  varianceMinor: number | null
  varianceReason: string | null
}

export function useShiftHistory() {
  const ready = useAuthReady()

  return useQuery({
    queryKey: inventoryOpsKeys.shiftHistory(),
    queryFn: async (): Promise<ShiftHistoryEntry[]> => {
      const { data } = await apiClient.get('/pos/sessions/history')
      return asList<ShiftHistoryEntry>(data)
    },
    enabled: ready,
  })
}

// ─── N3 · cash forecast ───────────────────────────────────────────────

export interface CashForecast {
  openingBalance: number
  /** Per-day projection. */
  days: { date: string; expectedIn: number; expectedOut: number; balance: number }[]
  /** The first day the balance goes negative, or null. */
  firstShortfallDate: string | null
}

export function useCashForecast(days = 30) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: inventoryOpsKeys.cashForecast(days),
    queryFn: async (): Promise<CashForecast | null> => {
      const { data } = await apiClient.get('/intelligence/cash-forecast', { params: { days } })
      return (data as CashForecast) ?? null
    },
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── N4 · stale opportunities ─────────────────────────────────────────

export interface StaleOpportunity {
  id: string
  title: string
  customerName: string | null
  stage: string | null
  valueMinor: number | null
  lastActivityAt: string | null
  daysStale: number | null
}

export function useStaleOpportunities() {
  const ready = useAuthReady()

  return useQuery({
    queryKey: inventoryOpsKeys.staleOpportunities(),
    queryFn: async (): Promise<StaleOpportunity[]> => {
      const { data } = await apiClient.get('/intelligence/stale-opportunities')
      return asList<StaleOpportunity>(data)
    },
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  })
}
