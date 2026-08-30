// ============================================
// Budget hooks — TanStack Query
//
// ---------------------------------------------------------------------------
// AVAILABLE IS NOT BUDGET MINUS SPENT
//
// It is budget − actual − COMMITTED. An approved purchase order that has not
// arrived yet is money already promised, and a budget that ignores it tells a
// shopkeeper they can afford something twice.
//
// `useCheckSpend` is asked BEFORE the money is committed. That ordering is the
// whole reason this is a control rather than a report — a variance report
// discovered at month end cannot stop anything.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

// ═══ Types ═══

export type BudgetPeriod = 'monthly' | 'quarterly' | 'yearly'
/** block refuses, warn lets it through loudly, track only records. */
export type BudgetAction = 'block' | 'warn' | 'track'

export interface Budget {
  id: string
  accountId: string
  /** Narrowing: this cost centre, this project, this branch. */
  dimensionValueId?: string | null
  branchId?: string | null
  period: BudgetPeriod
  startsOn: string
  /** Minor units allowed PER PERIOD, not in total. */
  amountMinor: number
  action: BudgetAction
  /** Percent of the budget at which a warning fires. 0 disables it. */
  warnAtPercent: number
  isActive: boolean
}

export interface BudgetStatus {
  budgetId: string
  accountId: string
  periodStart: string
  periodEnd: string
  budgetMinor: number
  actualMinor: number
  committedMinor: number
  /** budget − actual − committed. Negative means already over. */
  availableMinor: number
  utilisation: number
  state: 'ok' | 'warning' | 'exceeded'
  action: BudgetAction
}

export interface BudgetCheck {
  allowed: boolean
  code?: 'BUDGET_EXCEEDED' | 'BUDGET_WARNING'
  status?: BudgetStatus
}

export interface VarianceRow {
  budgetId: string
  accountId: string
  periodStart: string
  budgetMinor: number
  actualMinor: number
  /** actual − budget. Positive is overspend. */
  varianceMinor: number
  variancePercent: number | null
}

export const budgetKeys = {
  all: ['budgets'] as const,
  list: () => [...budgetKeys.all, 'list'] as const,
  variance: (onDate: string) => [...budgetKeys.all, 'variance', onDate] as const,
}

// ═══ Queries ═══

export function useBudgets() {
  const ready = useAuthReady()

  return useQuery({
    queryKey: budgetKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get('/operations/budgets')
      return data as Budget[]
    },
    enabled: ready,
    staleTime: 5 * 60_000,
  })
}

/**
 * Budget against actual, by period.
 *
 * Committed spend is deliberately absent here: this is a retrospective report,
 * and a purchase order that was never received did not happen. Committed money
 * belongs in the live `availableMinor` figure, not in this one.
 */
export function useBudgetVariance(onDate?: string) {
  const ready = useAuthReady()
  const date = onDate ?? new Date().toISOString().slice(0, 10)

  return useQuery({
    queryKey: budgetKeys.variance(date),
    queryFn: async () => {
      const { data } = await apiClient.get('/operations/budgets/variance', {
        params: { onDate: date },
      })
      return data as VarianceRow[]
    },
    enabled: ready,
    staleTime: 60_000,
  })
}

// ═══ Mutations ═══

export function useSaveBudget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...body }: Budget) => {
      const { data } = await apiClient.put(`/operations/budgets/${id}`, body)
      return data as Budget
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.all })
    },
  })
}

/**
 * Ask whether a spend is allowed, before committing it.
 *
 * A mutation rather than a query because it is an ACT of asking at a moment in
 * time — caching an answer would let a stale "yes" authorise a spend the
 * budget can no longer take.
 *
 * Not retried: the caller is a person waiting at a confirm button, and a
 * refusal is a real answer, not a failure to retry past.
 */
export function useCheckSpend() {
  return useMutation({
    mutationFn: async (input: {
      accountId: string
      dimensionValueId?: string | null
      branchId?: string | null
      amountMinor: number
      onDate: string
    }) => {
      const { data } = await apiClient.post('/operations/budgets/check', input)
      return data as BudgetCheck
    },
    retry: false,
  })
}
