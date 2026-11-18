// ============================================
// packages/api/src/hooks/evidence.ts
//
// The chain behind a profit figure (backend/src/services/accounting/
// evidence.domain.ts). Both reads are ON DEMAND: a person asks «why?», and
// only then is the chain assembled — it reads every cost layer behind a sale.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { getActiveWorkspaceId } from '../lib/active-workspace'
import { useAuthReady } from './useAuthReady'
import type { CostStatus } from './accounting'

export interface EvidenceLayer {
  sourceType: string
  sourceId: string | null
  unitCost: number
  entryDate: string
}

export interface InvoiceEvidence {
  invoiceId: string
  currency: string
  grossSales: number
  discount: number
  netSales: number
  cost: number
  costStatus: CostStatus
  /** null when the cost of what was sold is not fully known. */
  grossProfit: number | null
  marginPercent: number | null
  lines: Array<{
    productId: string | null
    name: string
    quantity: number
    grossRevenue: number
    netRevenue: number
    cost: number
    profit: number | null
    costStatus: CostStatus
    uncostedQuantity: number
    costMissing: boolean
    costEstimated: boolean
    sources: Array<{
      quantity: number
      unitCost: number
      amount: number
      isEstimated: boolean
      layer: EvidenceLayer | null
    }>
  }>
  ledger: Array<{ id: string; entryNumber: string | null; status: string }>
  payments: Array<{ paymentId: string; amount: number }>
  paidTotal: number
  warnings: Array<'COST_MISSING' | 'COST_ESTIMATED' | 'NOT_POSTED'>
}

export interface ProductJourney {
  productId: string
  currency: string
  bought: {
    quantity: number
    amount: number
    bySource: Array<{ sourceType: string; quantity: number; amount: number }>
  }
  sold: {
    quantity: number
    cost: number
    byConsumer: Array<{ consumerType: string; quantity: number; cost: number }>
  }
  onHand: { quantity: number; value: number }
  revenue: number
  /** null when part of what was sold has no recorded cost. */
  profit: number | null
}

export const evidenceKeys = {
  invoice: (id: string) => ['evidence', getActiveWorkspaceId() ?? '', 'invoice', id] as const,
  product: (id: string, from: string, to: string, currency: string) =>
    ['evidence', getActiveWorkspaceId() ?? '', 'product', id, from, to, currency] as const,
}

export function useInvoiceEvidence(invoiceId: string, requested: boolean) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: evidenceKeys.invoice(invoiceId),
    queryFn: async () => {
      const e = (await apiClient.get(`/accounting/evidence/invoices/${invoiceId}`))
        .data as InvoiceEvidence
      return {
        ...e,
        lines: asList<InvoiceEvidence['lines'][number]>(e?.lines).map((l) => ({
          ...l,
          sources: asList<InvoiceEvidence['lines'][number]['sources'][number]>(l.sources),
        })),
        ledger: asList<InvoiceEvidence['ledger'][number]>(e?.ledger),
        payments: asList<InvoiceEvidence['payments'][number]>(e?.payments),
        warnings: asList<InvoiceEvidence['warnings'][number]>(e?.warnings),
      }
    },
    enabled: ready && requested && !!invoiceId,
    retry: false,
  })
}

export function useProductJourney(
  productId: string,
  range: { from: string; to: string; currency: string },
  requested: boolean,
) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: evidenceKeys.product(productId, range.from, range.to, range.currency),
    queryFn: async () => {
      const j = (
        await apiClient.get(`/accounting/evidence/products/${productId}`, {
          params: { fromDate: range.from, toDate: range.to, currency: range.currency },
        })
      ).data as ProductJourney
      return {
        ...j,
        bought: {
          ...j.bought,
          bySource: asList<ProductJourney['bought']['bySource'][number]>(j?.bought?.bySource),
        },
        sold: {
          ...j.sold,
          byConsumer: asList<ProductJourney['sold']['byConsumer'][number]>(j?.sold?.byConsumer),
        },
      }
    },
    enabled: ready && requested && !!productId,
    retry: false,
  })
}

/** What `POST /invoices/:id/cost` answers. */
export interface CostInvoiceResult {
  status: 'costed' | 'nothing_to_cost' | 'still_uncosted' | 'not_postable' | 'ledger_incomplete'
  cost: number
  posted: number
  unposted: number
  uncostedProducts: string[]
}

/**
 * Give a sale that was booked with no cost of goods its cost, from the
 * product's purchase price. An act the person presses; the server posts it as
 * its own journal entry, once.
 */
export function useCostInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (invoiceId: string) =>
      (await apiClient.post(`/invoices/${invoiceId}/cost`)).data as CostInvoiceResult,
    onSuccess: async (_result, invoiceId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: evidenceKeys.invoice(invoiceId) }),
        queryClient.invalidateQueries({ queryKey: ['accounting'] }),
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: unvaluedStockKey }),
      ])
    },
  })
}

// ─── Stock with no cost behind it ────────────────────────────────────────────

export interface UnvaluedStock {
  rows: Array<{
    productId: string
    name: string
    quantity: number
    unitCost: number | null
    value: number | null
    status: 'ready' | 'no_buy_price'
  }>
  ready: { products: number; quantity: number; value: number }
  blocked: { products: number; quantity: number }
}

const unvaluedStockKey = ['accounting', 'unvalued-stock'] as const

/** Stock on the shelf with no cost layer. Read fresh: it decides an action. */
export function useUnvaluedStock(requested = true) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: unvaluedStockKey,
    queryFn: async () => {
      const body = (await apiClient.get('/inventory/unvalued')).data as UnvaluedStock
      return { ...body, rows: asList<UnvaluedStock['rows'][number]>(body?.rows) }
    },
    enabled: ready && requested,
    staleTime: 0,
    retry: false,
    meta: { persist: false },
  })
}

/** Value that stock at each product's own purchase price. */
export function useValueUnvaluedStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      (await apiClient.post('/inventory/unvalued/value')).data as {
        valued: number
        quantity: number
        value: number
        blocked: UnvaluedStock['blocked']
      },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: unvaluedStockKey }),
        queryClient.invalidateQueries({ queryKey: ['accounting'] }),
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
      ])
    },
  })
}

// ─── Cost layers (WP-01) ─────────────────────────────────────────────────────

export interface ProductCostLayer {
  id: string
  productId: string
  /** The variant these units belong to; null = never assigned (strict rule). */
  variantId: string | null
  warehouseId: string | null
  remainingQty: number
  unitCost: number
  entryDate: string
  createdAt: string
}

export interface CostLayersResult {
  layers: ProductCostLayer[]
  onHand: number
  value: number
  averageCost: number
}

export const costLayersKey = (
  productId: string,
  /** undefined = every variant, null = only unassigned, uuid = one variant. */
  variantId?: string | null,
) => ['inventory', 'cost-layers', productId, variantId ?? 'unassigned'] as const

/**
 * The open cost layers of one product, optionally narrowed to one variant or to
 * the unassigned pool. Read fresh: it is what the assignment act speaks about.
 */
export function useCostLayers(productId: string, variantId?: string | null, requested = true) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: costLayersKey(productId, variantId),
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (variantId === null) params.unassigned = 'true'
      else if (variantId !== undefined) params.variantId = variantId
      const body = (await apiClient.get(`/inventory/layers/${productId}`, { params }))
        .data as CostLayersResult
      return {
        ...body,
        layers: asList<ProductCostLayer>(body?.layers),
      }
    },
    enabled: ready && requested && !!productId,
    staleTime: 0,
    retry: false,
    meta: { persist: false },
  })
}

/**
 * Say which variant a legacy, unassigned layer actually is. The strict costing
 * rule makes it unsellable by a variant until this act; the server refuses a
 * closed layer or one already assigned elsewhere.
 */
export function useAssignLayerVariant(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { layerId: string; variantId: string }) =>
      (
        await apiClient.post(`/inventory/layers/${input.layerId}/variant`, {
          variantId: input.variantId,
        })
      ).data as {
        layerId: string
        productId: string
        variantId: string
        quantity: number
        value: number
        moved: boolean
      },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory', 'cost-layers', productId] }),
        queryClient.invalidateQueries({ queryKey: unvaluedStockKey }),
        queryClient.invalidateQueries({ queryKey: ['accounting'] }),
      ])
    },
  })
}
