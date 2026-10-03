// ============================================
// Manufacturing hooks — TanStack Query.
//
// One domain on the server (backend/src/services/manufacturing.service.ts),
// several screens here: the manufacturing page, the product page and the
// dashboard all read through THESE hooks, so a cost shown in one place is the
// cost shown in the others.
//
//   GET  /boms                                  the definitions
//   GET  /manufacturing/definitions/:productId  one product's, for the editor
//   PUT  /manufacturing/definitions             save (revises when already used)
//   POST /manufacturing/produce                 record a run (idempotent)
//   GET  /manufacturing/runs[?productId]        history, paged
//   GET  /manufacturing/runs/:id                one run and its snapshot lines
//   GET  /manufacturing/report?from&to          cost and consumption, aggregated
//   GET|POST|PATCH /work-orders                 planned orders
//
// ⚠️ THE LIST ENDPOINTS SEND RAW ROWS (`product_id`, `is_active`, `start_date`).
// This file used to TYPE them camelCase and read them as such, so every
// `productId` was undefined — the product name was the only thing that kept the
// table from printing «undefined». A type is not a runtime check: the rows are
// mapped below, field by field.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProduceInput, SaveProductionDefinition } from '@hisabche/validation'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'
import { useRealtime } from './useRealtime'
import { dashboardKeys } from './dashboard'
import { productKeys } from './products'
import { warehouseKeys } from './warehouses'

// ═══ Types ═══

export interface BOM {
  id: string
  productId: string
  version: number
  isActive: boolean
  currency: string | null
  /** Per ONE unit, derived by the server from the lines. */
  unitCost: number
  product: { name: string } | null
  itemsCount: number
}

export interface WorkOrder {
  id: string
  productId: string
  quantity: number
  bomId: string | null
  status: string
  startDate: string | null
  currency: string | null
  totalCost: number | null
  product: { name: string } | null
}

export interface ProductionDefinition {
  bomId: string
  productId: string
  version: number
  currency: string | null
  columns: unknown[]
  rows: Array<{ id: string; productId?: string; values: Record<string, string> }>
  otherCosts: Array<{ label: string; amount: number }>
  labor: {
    workers: number | null
    minutes: number | null
    hourlyRate: number | null
    cost: number | null
  }
  notes: string
  cost: { componentsCost: number; laborCost: number; otherCost: number; unitCost: number }
  /** productId → today's buy price of that component. */
  currentCosts: Record<string, number>
  updatedAt: string | null
}

export interface ProductionRun {
  id: string
  productId: string
  productName: string | null
  quantity: number
  currency: string | null
  bomId: string | null
  bomVersion: number | null
  componentsCost: number
  laborCost: number
  otherCost: number
  unitCost: number
  calculatedTotal: number
  overrideTotal: number | null
  overrideReason: string | null
  totalCost: number
  actualMaterialCost: number | null
  laborWorkers: number | null
  laborMinutes: number | null
  addToInventory: boolean
  consumeComponents: boolean
  warehouseId: string | null
  warehouseName: string | null
  notes: string | null
  producedOn: string | null
  completedAt: string | null
}

export interface ProductionRunLine {
  id: string
  kind: 'component' | 'labor' | 'cost'
  productId: string | null
  label: string
  unit: string | null
  quantityPerUnit: number
  quantity: number
  unitCost: number
  total: number
  actualCost: number | null
  isEstimated: boolean
  cells: Record<string, string>
}

export interface ProductionRunDetail extends ProductionRun {
  lines: ProductionRunLine[]
}

export interface ProduceResult {
  status: 'completed' | 'already_completed'
  workOrderId: string
  quantity: number
  totalCost: number
}

export interface ManufacturingReport {
  from: string
  to: string
  totals: {
    runs: number
    quantity: number
    totalCost: number
    componentsCost: number
    laborCost: number
    otherCost: number
    laborMinutes: number
  }
  products: Array<{
    productId: string
    name: string
    runs: number
    quantity: number
    totalCost: number
    firstUnitCost: number
    lastUnitCost: number
  }>
  materials: Array<{
    key: string
    productId: string | null
    name: string
    unit: string | null
    quantity: number
    value: number
    runs: number
    products: number
    previousCost: number
    currentCost: number
    change: number
    /** null = nothing earlier to compare with — not «0% change». */
    changePercent: number | null
  }>
}

// ═══ Row mappers ═══

type Raw = Record<string, unknown>

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null

const named = (value: unknown): { name: string } | null => {
  const name = (value as { name?: unknown } | null)?.name
  return typeof name === 'string' ? { name } : null
}

export function mapBom(row: Raw): BOM {
  return {
    id: String(row.id),
    productId: String(row.product_id ?? ''),
    version: Number(row.version) || 0,
    isActive: row.is_active !== false,
    currency: text(row.currency),
    unitCost: Number(row.unit_cost) || 0,
    product: named(row.product),
    itemsCount: Array.isArray(row.items) ? row.items.length : 0,
  }
}

export function mapWorkOrder(row: Raw): WorkOrder {
  return {
    id: String(row.id),
    productId: String(row.product_id ?? ''),
    quantity: Number(row.quantity) || 0,
    bomId: text(row.bom_id),
    status: String(row.status ?? 'planned'),
    startDate: text(row.start_date),
    currency: text(row.currency),
    // null = not costed yet (a planned order); 0 would read as «free».
    totalCost:
      row.total_cost === null || row.total_cost === undefined ? null : Number(row.total_cost) || 0,
    product: named(row.product),
  }
}

// ═══ Query keys ═══

export const manufacturingKeys = {
  all: ['manufacturing'] as const,
  boms: (productId?: string) => [...manufacturingKeys.all, 'boms', productId ?? null] as const,
  workOrders: (status?: string) =>
    [...manufacturingKeys.all, 'workOrders', status ?? null] as const,
  definition: (productId: string) => [...manufacturingKeys.all, 'definition', productId] as const,
  runs: (productId: string | null, limit: number, offset: number) =>
    [...manufacturingKeys.all, 'runs', productId, limit, offset] as const,
  run: (id: string) => [...manufacturingKeys.all, 'run', id] as const,
  report: (from: string, to: string, productId: string | null) =>
    [...manufacturingKeys.all, 'report', from, to, productId] as const,
}

// ═══ Definitions ═══

export function useBOMs(productId?: string) {
  const authReady = useAuthReady()
  useRealtime({ table: 'boms', queryKey: manufacturingKeys.all as unknown as string[] })

  return useQuery({
    queryKey: manufacturingKeys.boms(productId),
    queryFn: async (): Promise<BOM[]> => {
      const { data } = await apiClient.get('/boms', { params: productId ? { productId } : {} })
      return asList<Raw>(data).map(mapBom)
    },
    enabled: authReady,
    staleTime: 2 * 60_000,
  })
}

/** One product's active definition; `null` when it has none yet. */
export function useProductionDefinition(productId: string | null) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: manufacturingKeys.definition(productId ?? ''),
    queryFn: async (): Promise<ProductionDefinition | null> => {
      const { data } = await apiClient.get<{ definition: ProductionDefinition | null }>(
        `/manufacturing/definitions/${productId}`,
      )
      return data?.definition ?? null
    },
    enabled: authReady && !!productId,
    staleTime: 30_000,
  })
}

export function useSaveProductionDefinition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveProductionDefinition) => {
      const { data } = await apiClient.put<{ bomId: string; version: number; revised: boolean }>(
        '/manufacturing/definitions',
        input,
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: manufacturingKeys.all })
    },
  })
}

// ═══ Production ═══

export function useProduce() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProduceInput): Promise<ProduceResult> => {
      const { data } = await apiClient.post<ProduceResult>('/manufacturing/produce', input)
      return data
    },
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: manufacturingKeys.all })
      // A run with inventory on moved stock: the finished product, its
      // components and the warehouse all show different figures now.
      if (input.addToInventory) {
        void queryClient.invalidateQueries({ queryKey: productKeys.all })
        void queryClient.invalidateQueries({ queryKey: warehouseKeys.all })
        void queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      }
    },
  })
}

export function useProductionRuns(options: {
  productId?: string | null
  limit?: number
  offset?: number
  enabled?: boolean
}) {
  const authReady = useAuthReady()
  const productId = options.productId ?? null
  const limit = options.limit ?? 20
  const offset = options.offset ?? 0
  return useQuery({
    queryKey: manufacturingKeys.runs(productId, limit, offset),
    queryFn: async (): Promise<{ runs: ProductionRun[]; total: number }> => {
      const { data } = await apiClient.get<{ runs?: unknown; total?: number }>(
        '/manufacturing/runs',
        { params: { limit, offset, ...(productId ? { productId } : {}) } },
      )
      const runs = asList<ProductionRun>(data?.runs)
      return { runs, total: Number(data?.total) || runs.length }
    },
    enabled: authReady && options.enabled !== false,
    staleTime: 30_000,
  })
}

export function useProductionRun(id: string | null) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: manufacturingKeys.run(id ?? ''),
    queryFn: async (): Promise<ProductionRunDetail> => {
      const { data } = await apiClient.get<ProductionRunDetail>(`/manufacturing/runs/${id}`)
      return { ...data, lines: asList<ProductionRunLine>(data?.lines) }
    },
    enabled: authReady && !!id,
    // A completed run is history: it does not change.
    staleTime: 10 * 60_000,
  })
}

// ═══ Reporting ═══

export function useManufacturingReport(range: {
  from: string
  to: string
  productId?: string | null
  enabled?: boolean
}) {
  const authReady = useAuthReady()
  const productId = range.productId ?? null
  return useQuery({
    queryKey: manufacturingKeys.report(range.from, range.to, productId),
    queryFn: async (): Promise<ManufacturingReport> => {
      const { data } = await apiClient.get<ManufacturingReport>('/manufacturing/report', {
        params: { from: range.from, to: range.to, ...(productId ? { productId } : {}) },
      })
      return {
        ...data,
        products: asList<ManufacturingReport['products'][number]>(data?.products),
        materials: asList<ManufacturingReport['materials'][number]>(data?.materials),
      }
    },
    enabled: authReady && range.enabled !== false && !!range.from && !!range.to,
    staleTime: 60_000,
  })
}

// ═══ Planned orders ═══

export function useWorkOrders(status?: string) {
  const authReady = useAuthReady()
  useRealtime({ table: 'work_orders', queryKey: manufacturingKeys.all as unknown as string[] })

  return useQuery({
    queryKey: manufacturingKeys.workOrders(status),
    queryFn: async (): Promise<WorkOrder[]> => {
      const { data } = await apiClient.get('/work-orders', { params: status ? { status } : {} })
      return asList<Raw>(data).map(mapWorkOrder)
    },
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      productId: string
      quantity: number
      bomId?: string
      startDate?: string
    }) => {
      const { data } = await apiClient.post('/work-orders', input)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: manufacturingKeys.all })
    },
  })
}
