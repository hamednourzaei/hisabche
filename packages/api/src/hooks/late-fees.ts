// ============================================
// Late payment fees (#124).
//
//   GET  /late-fees/policy
//   PUT  /late-fees/policy
//   GET  /invoices/:id/late-fees      a preview — charges nothing
//   POST /invoices/:id/late-fees      { language }   manager and up
//
// A fee is charged only when a manager says so, and it is an ordinary sale
// invoice; nothing is charged automatically.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LateFeePolicy, LateFeePolicyInput } from '@hisabche/validation'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { invoiceKeys } from './invoices'
import { paymentKeys } from './payments'
import { useAuthReady } from './useAuthReady'

/** Why nothing can be charged on the invoice — or `ready`. */
export type LateFeeState =
  | 'ready'
  | 'off'
  | 'other_currency'
  | 'not_sale'
  | 'cancelled'
  | 'no_customer'
  | 'no_due_date'
  | 'fee_invoice'

export interface LateFeeLine {
  /** The installment; 0 = the invoice as a whole. */
  seq: number
  dueDate: string
  daysLate: number
  overdue: number
  fee: number
  assessed: number
  toAssess: number
  capped: boolean
}

export interface LateFeeAssessment {
  id: string
  seq: number
  periodNo: number
  dueDate: string
  daysLate: number
  overdue: number
  fee: number
  assessedAt: string
  /** Null while the fee invoice has not been issued yet. */
  feeInvoiceId: string | null
}

export interface LateFeePreview {
  invoiceId: string
  invoiceNumber: string
  currency: string
  state: LateFeeState
  policy: LateFeePolicy | null
  lines: LateFeeLine[]
  totalToAssess: number
  assessments: LateFeeAssessment[]
}

export const lateFeeKeys = {
  all: ['late-fees'] as const,
  policy: () => [...lateFeeKeys.all, 'policy'] as const,
  invoice: (invoiceId: string) => [...lateFeeKeys.all, 'invoice', invoiceId] as const,
}

const normalise = (data: LateFeePreview): LateFeePreview => ({
  ...data,
  lines: asList<LateFeeLine>(data?.lines),
  assessments: asList<LateFeeAssessment>(data?.assessments),
})

export function useLateFeePolicy(requested: boolean) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: lateFeeKeys.policy(),
    queryFn: async (): Promise<LateFeePolicy | null> =>
      (await apiClient.get<{ policy: LateFeePolicy | null }>('/late-fees/policy')).data?.policy ??
      null,
    enabled: ready && requested,
  })
}

export function useSaveLateFeePolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (policy: LateFeePolicyInput) =>
      (await apiClient.put<{ policy: LateFeePolicy }>('/late-fees/policy', policy)).data.policy,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lateFeeKeys.all }),
  })
}

export function useLateFeePreview(invoiceId: string, requested: boolean) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: lateFeeKeys.invoice(invoiceId),
    queryFn: async () =>
      normalise((await apiClient.get<LateFeePreview>(`/invoices/${invoiceId}/late-fees`)).data),
    enabled: ready && requested && !!invoiceId,
    // Derived from payments and from today's date: never served stale.
    staleTime: 0,
  })
}

export function useAssessLateFee(invoiceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { language: 'fa' | 'af' | 'en' }) =>
      normalise(
        (await apiClient.post<LateFeePreview>(`/invoices/${invoiceId}/late-fees`, input)).data,
      ),
    onSuccess: (preview) => queryClient.setQueryData(lateFeeKeys.invoice(invoiceId), preview),
    // A fee is a new invoice and a new receivable — whether or not every step
    // of the call succeeded, what the customer owes may have changed.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
      void queryClient.invalidateQueries({ queryKey: paymentKeys.all })
    },
  })
}
