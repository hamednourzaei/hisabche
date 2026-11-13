// ============================================
// packages/api/src/hooks/expense-claims.ts
//
// V61 B.2.18 — an employee's expense claim, from draft to reimbursement.
//
// ⚠️ THE ENDPOINT IS `online_required` (offline-endpoint-matrix.ts). A claim is
// approved against the ledger and reimbursed as a real payment, so neither can
// happen on a device that cannot see the books. The screen is behind
// `OfflineGate` for that reason — not because the list is expensive.
//
// ⚠️ `amount_minor` is minor units OF THE LINE'S OWN CURRENCY. It is never
// multiplied or divided here; the server totals the lines and pays that total in
// the claim's own currency (services/human-resources/expense-claims.service.ts),
// and refuses the claim outright when its lines are not all in one currency.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { responseBody } from '../lib/response-body'
import { useAuthReady } from './useAuthReady'

export const EXPENSE_CLAIM_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'reimbursed',
] as const
export type ExpenseClaimStatus = (typeof EXPENSE_CLAIM_STATUSES)[number]

export interface ExpenseClaimLine {
  id: string
  category: string
  amount_minor: number
  currency: string
  receipt_url: string | null
  notes: string | null
}

/** A claim row, snake_case: it is the database row, untouched. */
export interface ExpenseClaim {
  id: string
  employee_id: string
  title: string
  status: ExpenseClaimStatus
  approved_at: string | null
  rejected_reason: string | null
  payment_id: string | null
  created_at: string
  expense_lines: ExpenseClaimLine[]
}

export interface ExpenseClaimLineInput {
  category: string
  amount_minor: number
  currency: string
  receipt_url?: string | undefined
  notes?: string | undefined
}

export const expenseClaimKeys = {
  all: ['expense-claims'] as const,
  list: (status?: string) => [...expenseClaimKeys.all, 'list', status ?? 'all'] as const,
}

export function useExpenseClaims(status?: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: expenseClaimKeys.list(status),
    queryFn: async () => {
      const payload = responseBody<unknown>(
        await apiClient.get('/expense-claims', {
          params: status ? { status } : undefined,
        }),
      )
      // The route answers `{ data: rows }`; `asList` refuses to hand a
      // non-list to a `.map`, which is how two screens went down before.
      return asList<ExpenseClaim>(payload, 'expense-claims')
    },
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useCreateExpenseClaim() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      employee_id: string
      title: string
      submit?: boolean | undefined
      lines: ExpenseClaimLineInput[]
    }) => responseBody<ExpenseClaim>(await apiClient.post('/expense-claims', input)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: expenseClaimKeys.all }),
  })
}

export function useApproveExpenseClaim() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      responseBody<ExpenseClaim>(await apiClient.post(`/expense-claims/${id}/approve`, {})),
    // ⚠️ Only the claim list. Approval records the decision and books NOTHING —
    // there is no expense account role to post to yet — so invalidating the
    // ledger or the dashboard here would imply an entry that does not exist.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: expenseClaimKeys.all }),
  })
}

export function useRejectExpenseClaim() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; reason: string }) =>
      responseBody<ExpenseClaim>(
        await apiClient.post(`/expense-claims/${input.id}/reject`, { reason: input.reason }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: expenseClaimKeys.all }),
  })
}

export function useReimburseExpenseClaim() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; currency: string }) =>
      responseBody<ExpenseClaim>(
        await apiClient.post(`/expense-claims/${input.id}/reimburse`, {
          currency: input.currency,
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expenseClaimKeys.all })
      // The reimbursement is a REAL payment: it moves cash and the party ledger.
      void queryClient.invalidateQueries({ queryKey: ['payments'] })
      void queryClient.invalidateQueries({ queryKey: ['ledger'] })
      void queryClient.invalidateQueries({ queryKey: ['transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
