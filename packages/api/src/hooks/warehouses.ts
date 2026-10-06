// ============================================
// packages/api/src/hooks/warehouses.ts
//
// Multi-warehouse (request #90): the warehouse list with each warehouse's
// stat cards, one warehouse's products, adding a warehouse, and assigning stock
// that is in no warehouse. Every figure comes from the server
// (backend/src/services/inventory/warehouse-summary.domain.ts).
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'
import { productKeys, type StockSummary } from './products'

export interface WarehouseOverviewItem {
  id: string
  name: string
  location: string
  isActive: boolean
  summary: StockSummary
}

export interface WarehouseOverview {
  warehouses: WarehouseOverviewItem[]
  /** Stock that is in no warehouse; null when there is none. */
  unassigned: StockSummary | null
}

export interface WarehouseProduct {
  id: string
  name: string
  sku: string
  unit: string
  /** Quantity in this warehouse. */
  quantity: number
  /** The product's total across the business. */
  totalQuantity: number
  sellPrice: number
  buyPrice: number
  minStockLevel: number | null
  /** The cover image; null (or absent, from an older server) = none. */
  imageUrl?: string | null | undefined
}

export interface WarehouseDetail {
  /** null for the «unassigned» pseudo-warehouse. */
  warehouse: { id: string; name: string; location: string } | null
  products: WarehouseProduct[]
  summary: StockSummary
}

export const warehouseKeys = {
  all: ['warehouses'] as const,
  overview: () => [...warehouseKeys.all, 'overview'] as const,
  detail: (id: string) => [...warehouseKeys.all, 'detail', id] as const,
  product: (id: string) => [...warehouseKeys.all, 'product', id] as const,
}

const emptySummary: StockSummary = {
  productCount: 0,
  totalValue: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
}

export function useWarehouseOverview() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: warehouseKeys.overview(),
    queryFn: async (): Promise<WarehouseOverview> => {
      const { data } = await apiClient.get<Partial<WarehouseOverview>>('/warehouses/overview')
      return {
        warehouses: asList<WarehouseOverviewItem>(data?.warehouses),
        unassigned: data?.unassigned ?? null,
      }
    },
    enabled: authReady,
    staleTime: 10_000,
  })
}

/** `id = 'unassigned'` reads the stock that is in no warehouse. */
export function useWarehouseDetail(id: string | null) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: warehouseKeys.detail(id ?? ''),
    queryFn: async (): Promise<WarehouseDetail> => {
      const { data } = await apiClient.get<Partial<WarehouseDetail>>(`/warehouses/${id}/detail`)
      return {
        warehouse: data?.warehouse ?? null,
        products: asList<WarehouseProduct>(data?.products),
        summary: data?.summary ?? emptySummary,
      }
    },
    enabled: authReady && !!id,
    staleTime: 10_000,
  })
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; location?: string }) => {
      const { data } = await apiClient.post('/warehouses', {
        name: input.name,
        location: input.location ?? '',
      })
      return data as { id: string; name: string }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: warehouseKeys.all }),
  })
}

/** Rename / relocate a warehouse (PATCH /warehouses/:id). */
export function useUpdateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; location: string }) => {
      const { data } = await apiClient.patch(`/warehouses/${input.id}`, input)
      return data as { id: string; name: string }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: warehouseKeys.all }),
  })
}

export function useAssignWarehouseStock(warehouseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { productId: string; quantity: number; notes?: string }) => {
      const { data } = await apiClient.post(`/warehouses/${warehouseId}/assign`, input)
      return data as { assigned: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all })
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

/**
 * Move a quantity of one product from one warehouse to another.
 *
 * ⚠️ `POST /stock-transfers` had no caller. The key makes a retry after a lost
 * answer the SAME movement, so the goods move once.
 */
export function useTransferStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      productId: string
      fromWarehouseId: string
      toWarehouseId: string
      quantity: number
      notes?: string | undefined
      idempotencyKey: string
    }) => {
      const { idempotencyKey, ...body } = input
      const { data } = await apiClient.post('/stock-transfers', body, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      return data as { success: boolean; transferred: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all })
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

/** Where one product's stock is (GET /products/:id/warehouse-breakdown). */
export interface ProductWarehouseBreakdown {
  /** The product total — the figure the product page shows. */
  total: number
  /** Every live warehouse and this product's quantity there. */
  warehouses: Array<{ id: string; name: string; quantity: number }>
  /** In no warehouse. total − Σ warehouses; may be negative. */
  unassigned: number
}

export function useProductWarehouseBreakdown(productId: string | null) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: warehouseKeys.product(productId ?? ''),
    queryFn: async (): Promise<ProductWarehouseBreakdown> => {
      const { data } = await apiClient.get<Partial<ProductWarehouseBreakdown>>(
        `/products/${productId}/warehouse-breakdown`,
      )
      return {
        total: Number(data?.total ?? 0),
        warehouses: asList<ProductWarehouseBreakdown['warehouses'][number]>(data?.warehouses),
        unassigned: Number(data?.unassigned ?? 0),
      }
    },
    enabled: authReady && !!productId,
    staleTime: 10_000,
  })
}
