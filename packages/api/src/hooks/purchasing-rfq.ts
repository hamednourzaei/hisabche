// ============================================
// packages/api/src/hooks/purchasing-rfq.ts
//
// V61 B.2.13 / B.2.14 — requests for quotation, supplier quotations, and the
// agreed prices of a long-term purchase contract.
//
// ⚠️ «Choose» marks a quotation chosen and the RFQ awarded — in one database
// transaction — and creates NO purchase document. The purchase itself is a
// purchase invoice, recorded from the invoice builder like every other.
//
// ⚠️ Money is minor units of the quotation's OWN currency, never × 100 here.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { responseBody } from '../lib/response-body'
import { useAuthReady } from './useAuthReady'

export type RfqStatus = 'open' | 'awarded' | 'cancelled'
export type QuotationStatus = 'submitted' | 'chosen' | 'rejected' | 'expired'

export interface QuotationLine {
  product_id: string
  quantity: number
  unit_price_minor: number
}

/** Database rows, snake_case and untouched. */
export interface SupplierQuotation {
  id: string
  rfq_id: string
  supplier_id: string
  currency: string
  valid_until: string
  lead_time_days: number
  lines: QuotationLine[]
  total_minor: number
  status: QuotationStatus
  created_at: string
}

export interface Rfq {
  id: string
  title: string
  status: RfqStatus
  created_at: string
  supplier_quotations: SupplierQuotation[]
}

export interface PurchaseContractPrice {
  id: string
  contract_id: string
  supplier_id: string
  product_id: string
  agreed_unit_price_minor: number
  currency: string
  valid_from: string
  valid_to: string
}

export const rfqKeys = {
  all: ['rfqs'] as const,
  list: () => [...rfqKeys.all, 'list'] as const,
  contractPrices: (supplierId?: string) =>
    [...rfqKeys.all, 'contract-prices', supplierId ?? 'all'] as const,
}

export function useRfqs() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: rfqKeys.list(),
    queryFn: async () => {
      const rows = asList<Rfq>(responseBody<unknown>(await apiClient.get('/rfqs')), 'rfqs')
      // An embed of no rows can come back as null; a list is always a list.
      return rows.map((rfq) => ({
        ...rfq,
        supplier_quotations: asList<SupplierQuotation>(rfq.supplier_quotations ?? [], 'quotations'),
      }))
    },
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useCreateRfq() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { title: string }) =>
      responseBody<Rfq>(await apiClient.post('/rfqs', input)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: rfqKeys.all }),
  })
}

export function useAddQuotation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      rfqId: string
      supplier_id: string
      currency: string
      valid_until: string
      lead_time_days: number
      lines: QuotationLine[]
    }) => {
      const { rfqId, ...body } = input
      return responseBody<SupplierQuotation>(
        await apiClient.post(`/rfqs/${rfqId}/quotations`, body),
      )
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: rfqKeys.all }),
  })
}

export function useChooseQuotation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (quotationId: string) =>
      responseBody<SupplierQuotation>(
        await apiClient.post(`/quotations/${quotationId}/choose`, {}),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: rfqKeys.all }),
  })
}

export function usePurchaseContractPrices(supplierId?: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: rfqKeys.contractPrices(supplierId),
    queryFn: async () =>
      asList<PurchaseContractPrice>(
        responseBody<unknown>(
          await apiClient.get('/purchase-contracts/prices', {
            params: supplierId ? { supplierId } : undefined,
          }),
        ),
        'purchase-contract-prices',
      ),
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useSavePurchaseContractPrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<PurchaseContractPrice, 'id'>) =>
      responseBody<PurchaseContractPrice>(
        await apiClient.post('/purchase-contracts/prices', input),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: rfqKeys.all }),
  })
}
