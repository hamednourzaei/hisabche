// ============================================
// Installment plan of one invoice (#123).
//
//   GET    /invoices/:id/installments
//   PUT    /invoices/:id/installments   { count, firstDueDate }
//   DELETE /invoices/:id/installments
//
// A plan is a schedule. It records no payment: `paid` on each line is derived
// by the server from what the invoice still owes.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export interface InstallmentLine {
  seq: number
  dueDate: string
  amount: number
  paid: number
  remaining: number
  /** Days past due with something still unpaid; 0 otherwise. */
  daysLate: number
}

export interface InstallmentPlan {
  invoiceId: string
  currency: string
  outstanding: number
  /** Empty = no plan. */
  lines: InstallmentLine[]
  nextDue: { seq: number; dueDate: string; remaining: number } | null
}

export const installmentKeys = {
  all: ['installments'] as const,
  invoice: (invoiceId: string) => [...installmentKeys.all, invoiceId] as const,
}

const normalise = (data: InstallmentPlan): InstallmentPlan => ({
  ...data,
  lines: asList<InstallmentLine>(data?.lines),
})

export function useInstallmentPlan(invoiceId: string, requested: boolean) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: installmentKeys.invoice(invoiceId),
    queryFn: async () =>
      normalise((await apiClient.get<InstallmentPlan>(`/invoices/${invoiceId}/installments`)).data),
    enabled: ready && requested && !!invoiceId,
    // Derived from payments: never served stale beside a payment just recorded.
    staleTime: 0,
  })
}

export function useSaveInstallmentPlan(invoiceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { count: number; firstDueDate: string }) =>
      normalise(
        (await apiClient.put<InstallmentPlan>(`/invoices/${invoiceId}/installments`, input)).data,
      ),
    onSuccess: (plan) => queryClient.setQueryData(installmentKeys.invoice(invoiceId), plan),
  })
}

export function useClearInstallmentPlan(invoiceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      normalise(
        (await apiClient.delete<InstallmentPlan>(`/invoices/${invoiceId}/installments`)).data,
      ),
    onSuccess: (plan) => queryClient.setQueryData(installmentKeys.invoice(invoiceId), plan),
  })
}
