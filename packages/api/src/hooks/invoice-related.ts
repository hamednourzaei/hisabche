// ============================================
// packages/api/src/hooks/invoice-related.ts
//
// H2 — the payments behind an invoice's `paid_amount`, and the journal entry
// it produced.
//
// Both existed in the database and neither was reachable from the app. After
// Phase F, `paid_amount` is a projection of `SUM(payment_allocations)`
// maintained by trigger — so when it looks wrong, the allocations are the only
// place the answer is, and there was no way to see them.
// ============================================

import { useQuery } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

export interface InvoicePaymentLink {
  paymentId: string
  allocationId: string
  /** Allocated to THIS invoice, not the payment's full amount. */
  amount: number
  date: string | null
  method: string | null
  reference: string | null
  status: string | null
}

export interface InvoiceJournalLink {
  id: string
  entryNumber: string | null
  date: string | null
  status: string | null
}

export interface InvoiceRelated {
  payments: InvoicePaymentLink[]
  /** `null` when the invoice was never posted, or is awaiting approval. */
  journalEntry: InvoiceJournalLink | null
  allocatedTotal: number
}

export const invoiceRelatedKeys = {
  all: ['invoice-related'] as const,
  detail: (id: string) => ['invoice-related', id] as const,
}

/**
 * ⚠️ `staleTime: 0`.
 *
 * Recording a payment changes this answer immediately, and an invoice that
 * still shows «تسویه‌نشده» right after the user settled it reads as the payment
 * not having been saved. The route is uncached on the server for the same
 * reason.
 */
export function useInvoiceRelated(invoiceId: string | undefined) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: invoiceRelatedKeys.detail(invoiceId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<InvoiceRelated>(`/invoices/${invoiceId}/related`)
      return data
    },
    enabled: authReady && Boolean(invoiceId),
    staleTime: 0,
  })
}
