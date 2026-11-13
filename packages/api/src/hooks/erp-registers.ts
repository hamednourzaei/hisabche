// ============================================
// packages/api/src/hooks/erp-registers.ts
//
// V61 registers that each live on one hub section:
//   · consignment lots (B.2.10)   — warehouse hub, «امانی»
//   · bundle components (B.2.8)   — the product's own page
//   · RFM segments (B.2.15)       — the customers hub
//   · record-count snapshots       — data and sync hub
//
// ⚠️ A consignment lot is a RECORD of goods held for or by someone else. It
// moves no stock and books nothing (the server writes one row); the screen
// says so. A snapshot is a row count, NOT a backup — nothing is restored from
// one.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { responseBody } from '../lib/response-body'
import { useAuthReady } from './useAuthReady'

// ─── Consignment ────────────────────────────────────────────────────────────

export type ConsignmentDirection = 'in' | 'out'

export interface ConsignmentLot {
  id: string
  direction: ConsignmentDirection
  party_id: string
  warehouse_id: string
  product_id: string
  quantity: number
  unit_agreed_price_minor: number
  currency: string
  status: 'open' | 'settled' | 'returned'
  created_at: string
}

export const consignmentKeys = {
  all: ['consignment-lots'] as const,
}

export function useConsignmentLots() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: consignmentKeys.all,
    queryFn: async () =>
      asList<ConsignmentLot>(
        responseBody<unknown>(await apiClient.get('/warehouses/consignments')),
        'consignment-lots',
      ),
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useCreateConsignmentLot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<ConsignmentLot, 'id' | 'status' | 'created_at'>) =>
      responseBody<ConsignmentLot>(await apiClient.post('/warehouses/consignments', input)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: consignmentKeys.all }),
  })
}

// ─── Bundles ────────────────────────────────────────────────────────────────

export interface BundleItem {
  id: string
  component_product_id: string
  quantity: number
}

export const bundleKeys = {
  items: (productId: string) => ['bundle-items', productId] as const,
}

export function useBundleItems(productId: string | null) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: bundleKeys.items(productId ?? ''),
    queryFn: async () =>
      asList<BundleItem>(
        responseBody<unknown>(await apiClient.get(`/products/${productId}/bundle-items`)),
        'bundle-items',
      ),
    enabled: authReady && Boolean(productId),
    staleTime: 30_000,
  })
}

export function useSaveBundleItems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      productId: string
      items: Array<{ component_product_id: string; quantity: number }>
    }) =>
      asList<BundleItem>(
        responseBody<unknown>(
          await apiClient.put(`/products/${input.productId}/bundle-items`, { items: input.items }),
        ),
        'bundle-items',
      ),
    onSuccess: (_rows, input) => {
      void queryClient.invalidateQueries({ queryKey: bundleKeys.items(input.productId) })
      // The product's kind (bundle / standard) changed with it.
      void queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

// ─── RFM ────────────────────────────────────────────────────────────────────

export type RfmSegment = 'champions' | 'loyal' | 'at_risk' | 'dormant' | 'no_data'

/** One customer in ONE currency: a customer who buys in two currencies has two rows. */
export interface CustomerRfmRow {
  customerId: string
  currency: string
  recencyDays: number | null
  frequency: number
  monetaryMinor: number
  segment: RfmSegment
}

export function useCustomerRfm() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: ['crm', 'rfm'] as const,
    queryFn: async () =>
      asList<CustomerRfmRow>(responseBody<unknown>(await apiClient.get('/crm/rfm')), 'crm-rfm'),
    enabled: authReady,
    staleTime: 5 * 60_000,
  })
}

// ─── Sales per seller (owner decision, 12 Nov 2026) ─────────────────────────

export interface SellerTotalRow {
  sellerUserId: string
  currency: string
  invoiceCount: number
  totalMinor: number
}

export interface SalesBySellerView {
  from: string | null
  to: string | null
  /** False before invoices-seller-01: every sale counts as its issuer's. */
  sellerColumn: boolean
  /** Owner/admin/manager see every seller; anyone else only themself. */
  seesAll: boolean
  totals: SellerTotalRow[]
  /** Sales with neither a seller nor an issuer — counted, never credited. */
  unattributed: number
}

export function useSalesBySeller(range: { from?: string; to?: string }) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: ['invoices', 'sales-by-seller', range.from ?? '', range.to ?? ''] as const,
    queryFn: async () =>
      responseBody<SalesBySellerView>(
        await apiClient.get('/invoices/sales-by-seller', {
          params: {
            ...(range.from ? { from: range.from } : {}),
            ...(range.to ? { to: range.to } : {}),
          },
        }),
      ),
    enabled: authReady,
  })
}

// ─── Snapshots (record counts, not backups) ─────────────────────────────────

export interface SnapshotView {
  id: string
  label: string
  takenAt: string
  restorable: false
  tables: Array<{ table: string; count: number | null }>
}

export interface SnapshotComparison extends SnapshotView {
  readable: boolean
  asOf: string
  changes: Array<{ table: string; then: number | null; now: number | null; added: number | null }>
}

export const snapshotKeys = {
  all: ['snapshots'] as const,
  compare: (id: string) => ['snapshots', 'compare', id] as const,
}

export function useSnapshots() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: snapshotKeys.all,
    queryFn: async () => {
      // The route answers `{ snapshots: [...] }`, not `{ data }`.
      const body = responseBody<{ snapshots?: unknown }>(await apiClient.get('/snapshots'))
      return asList<SnapshotView>(body?.snapshots, 'snapshots')
    },
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useTakeSnapshot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (label: string) =>
      responseBody<SnapshotView>(await apiClient.post('/snapshots', { label })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: snapshotKeys.all }),
  })
}

export function useSnapshotComparison(id: string | null) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: snapshotKeys.compare(id ?? ''),
    queryFn: async () =>
      responseBody<SnapshotComparison>(await apiClient.get(`/snapshots/${id}/compare`)),
    enabled: authReady && Boolean(id),
    staleTime: 0,
  })
}
