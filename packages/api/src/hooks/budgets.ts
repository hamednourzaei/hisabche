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
import { useMyCapabilities } from './governance'
import { asList } from '../lib/as-list'
import { localDay } from '../lib/local-day'

// ═══ Types ═══

export type BudgetPeriod = 'monthly' | 'quarterly' | 'yearly'
/**
 * block refuses, approval refuses until someone with authority approves,
 * warn lets it through loudly, track only records.
 */
export type BudgetAction = 'block' | 'warn' | 'approval' | 'track'
export type BudgetType = 'expense' | 'revenue'
export type BudgetStatusCode = 'draft' | 'pending_approval' | 'approved' | 'archived'

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
  /** Present once docs/budget-planning-migration.sql has run; defaults otherwise. */
  name?: string | null
  type?: BudgetType
  status?: BudgetStatusCode
  version?: number
  distribution?: Array<{ start: string; amountMinor: number }> | null
  notes?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
  createdBy?: string | null
  currency?: 'AFN' | 'USD' | 'PKR' | 'IRR'
  amountCurrencyMinor?: number
  fxRate?: number | null
}

/** What the page shows. Computed on the server, never in the browser. */
export interface BudgetPerformance {
  type: BudgetType
  budgetMinor: number
  theoreticalMinor: number
  actualMinor: number
  openCommitmentMinor: number
  remainingMinor: number
  /** Positive is favourable for both types. */
  varianceMinor: number
  varianceToDateMinor: number
  forecastMinor: number | null
  forecastVarianceMinor: number | null
  forecastMethod: 'plan_remaining' | 'run_rate' | 'insufficient_data'
  state: 'ok' | 'near_limit' | 'warning' | 'over' | 'forecast_overrun'
}

export interface BudgetReportRow {
  budget: Budget & Required<Pick<Budget, 'type' | 'status' | 'version'>>
  periodStart: string
  periodEnd: string
  distributionKind: 'equal' | 'custom'
  distributionMismatch: boolean
  performance: BudgetPerformance
  series: Array<{ start: string; planMinor: number; actualMinor: number }>
}

export interface BudgetReport {
  onDate: string
  rows: BudgetReportRow[]
  totals: {
    expense: {
      budgetMinor: number
      actualMinor: number
      openCommitmentMinor: number
      remainingMinor: number
      forecastMinor: number | null
    }
    revenue: {
      budgetMinor: number
      actualMinor: number
      remainingMinor: number
      forecastMinor: number | null
    }
  }
  source: 'batch' | 'per_budget'
}

export interface BudgetRevisionRow {
  id: string
  version: number
  previous_version: number
  reason: string
  actor_id: string
  lines: Array<{ line_key: string; before_minor: number; after_minor: number }>
  approved_by: string | null
  created_at: string
}

export interface SaveBudgetInput extends Budget {
  /** The currency `amountMinor` is entered in; the server converts to AFN. */
  currency?: 'AFN' | 'USD' | 'PKR' | 'IRR'
  distributionWeightsBp?: number[] | null
  distributionMinor?: number[] | null
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
  /** The tightest decision across every approved budget the spend touches. */
  decision?: 'allow' | 'warn' | 'block' | 'require_approval'
  impacts?: Array<{
    budgetId: string
    availableMinor: number
    exceeds: boolean
    exceededByMinor: number
    decision: 'allow' | 'warn' | 'block' | 'require_approval'
  }>
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
  report: (onDate: string, filter: BudgetReportFilter) =>
    [...budgetKeys.all, 'report', onDate, filter] as const,
  revisions: (id: string) => [...budgetKeys.all, 'revisions', id] as const,
}

export interface BudgetReportFilter {
  type?: BudgetType | undefined
  status?: BudgetStatusCode | undefined
  branchId?: string | undefined
}

// ═══ Queries ═══

export function useBudgets() {
  const ready = useAuthReady()

  return useQuery({
    queryKey: budgetKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get('/operations/budgets')
      return asList<Budget>(data)
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
  const date = onDate ?? localDay()

  return useQuery({
    queryKey: budgetKeys.variance(date),
    queryFn: async () => {
      const { data } = await apiClient.get('/operations/budgets/variance', {
        params: { onDate: date },
      })
      return asList<VarianceRow>(data)
    },
    enabled: ready,
    staleTime: 60_000,
  })
}

/**
 * The budgets page: performance, totals and series in ONE request. The
 * figures are the server's; nothing here recomputes them.
 */
export function useBudgetReport(onDate: string, filter: BudgetReportFilter = {}) {
  const ready = useAuthReady()
  const allowed = useMyCapabilities().can('budget.read') === true

  return useQuery({
    queryKey: budgetKeys.report(onDate, filter),
    queryFn: async () => {
      const { data } = await apiClient.get('/operations/budgets/report', {
        params: { onDate, ...filter },
      })
      return data as BudgetReport
    },
    enabled: ready && allowed,
    staleTime: 60_000,
  })
}

export function useBudgetRevisions(id: string | null) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: budgetKeys.revisions(id ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get(`/operations/budgets/${id}/revisions`)
      return asList<BudgetRevisionRow>(data)
    },
    enabled: ready && !!id,
    staleTime: 60_000,
  })
}

// ═══ Mutations ═══

function useBudgetTransition(action: 'submit' | 'approve' | 'archive') {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // Spelled out per action so the route-contract test can match each URL.
      const url =
        action === 'submit'
          ? `/operations/budgets/${id}/submit`
          : action === 'approve'
            ? `/operations/budgets/${id}/approve`
            : `/operations/budgets/${id}/archive`
      const { data } = await apiClient.post(url)
      return data as Budget
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.all })
    },
  })
}

export const useSubmitBudget = () => useBudgetTransition('submit')
export const useApproveBudget = () => useBudgetTransition('approve')
export const useArchiveBudget = () => useBudgetTransition('archive')

export function useReviseBudget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string
      expectedVersion: number
      amountMinor: number
      distributionMinor?: number[] | null
      reason: string
    }) => {
      const { data } = await apiClient.post(`/operations/budgets/${id}/revise`, body)
      return data
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.all })
    },
  })
}

export function useSaveBudget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...body }: SaveBudgetInput) => {
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
