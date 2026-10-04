// ============================================
// Business analysis — the read side of five engines (collections, customer
// risk, supplier risk, break-even, cohorts). Every figure is computed by the
// server from rows the business already has.
//
//   GET /analysis/collections            who to remind today
//   GET /analysis/customers/:id/risk     how one customer has paid
//   GET /analysis/suppliers              punctuality and concentration
//   GET /analysis/break-even?from&to&currency[&otherFixedCosts]
//   GET /analysis/cohorts                who came back after their first month
//   GET /analysis/working-capital?from&to&currency
//
// ⚠️ `null` in these answers means «not known», never zero: a score of null is
// «too little history to say», not «no risk».
// ============================================

import { useQuery } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export type ReminderTone = 'courtesy' | 'formal' | 'firm' | 'final'

export interface CollectionsWorklist {
  asOf: string
  /** Open sale invoices in total — tells «nothing to chase» from «nothing owed». */
  openInvoices: number
  /** Per currency — there is no single total across currencies. */
  outstandingByCurrency: Array<{ currency: string; outstanding: number; invoices: number }>
  actions: Array<{
    invoiceId: string
    invoiceNumber: string
    customerId: string | null
    customerName: string | null
    outstanding: number
    currency: string
    daysLate: number
    tone: ReminderTone
    channel: string
  }>
}

export interface CustomerRisk {
  customerId: string
  band: 'healthy' | 'watch' | 'at_risk' | 'unknown'
  score: number | null
  signals: Array<{
    key: 'RECENT_LATE' | 'TREND' | 'GROWING_DEBT' | 'BROKEN_PROMISE'
    weight: number
  }>
  facts: {
    invoices: number
    settled: number
    unsettled: number
    averageDaysLate: number | null
    recentDaysLate: number | null
    olderDaysLate: number | null
    outstandingMinor: number
  }
  reason: null | 'NEVER_BOUGHT' | 'TOO_FEW_SETTLED' | 'NO_SETTLED_INVOICES'
  /** How their buying has moved, in ONE currency (named). */
  health: {
    band: 'growing' | 'steady' | 'shrinking' | 'dormant' | 'unknown'
    trendPercent: number | null
    monthsObserved: number
    reason: null | 'NOT_ENOUGH_MONTHS' | 'NEVER_BOUGHT'
    currency: string | null
  }
  /** A label on facts — no points, nothing to redeem. */
  loyalty: {
    tier: 'new' | 'regular' | 'loyal' | 'champion' | 'unknown'
    activeMonths: number
    purchases: number
    daysSinceLastPurchase: number | null
  }
}

export interface SupplierAnalysis {
  asOf: string
  suppliers: Array<{
    supplierId: string
    name: string
    band: 'low' | 'moderate' | 'high' | 'unknown'
    score: number | null
    signals: Array<{
      key: 'LATE_DELIVERY' | 'PRICE_DRIFT' | 'INACTIVITY' | 'UNRECEIVED'
      weight: number
    }>
    evidence: {
      purchases: number
      received: number
      neverReceived: number
      averageDaysLate: number | null
    }
  }>
  concentration: Array<{
    kind: 'SUPPLIER_CONCENTRATION' | 'PRODUCT_SINGLE_SOURCE'
    subjectId: string
    subjectName: string
    sharePercent: number
  }>
  ordersWithoutPromisedDate: number
  orders: number
}

export interface BreakEvenAnalysis {
  from: string
  to: string
  currency: string
  fixedCostsTotal: number
  /** True when «other fixed costs» was not stated: the real figure is higher. */
  isLowerBound: boolean
  rows: Array<{
    productId: string | null
    name: string
    quantity: number
    revenue: number
    cost: number
    contribution: number
    contributionPercent: number | null
    breakEvenQuantity: number | null
    breakEvenReason: 'NO_REVENUE' | 'NO_CONTRIBUTION' | 'NO_FIXED_COSTS' | null
  }>
}

export interface CohortAnalysis {
  asOf: string
  cohorts: Array<{
    cohort: string
    size: number
    /** Per month since the first purchase; null = not observed yet. */
    retained: (number | null)[]
    churned: number
    averageValuePerCustomer: number | null
  }>
}

export interface WorkingCapitalAnalysis {
  from: string
  to: string
  currency: string
  daysInPeriod: number
  /** Null = cannot be computed for this period. Never zero. */
  dso: number | null
  dpo: number | null
  dio: number | null
  /** Negative is good: suppliers finance the business. */
  cashConversionCycle: number | null
  operatingCycle: number | null
  receivables: number
  payables: number
  inventoryAtCost: number
  /** Cash is not part of this figure. */
  netWorkingCapital: number
  revenue: number
  costOfGoodsSold: number
  purchases: number
  otherCurrencies: string[]
}

export const analysisKeys = {
  all: ['analysis'] as const,
  collections: () => [...analysisKeys.all, 'collections'] as const,
  customerRisk: (id: string) => [...analysisKeys.all, 'customer-risk', id] as const,
  suppliers: () => [...analysisKeys.all, 'suppliers'] as const,
  breakEven: (from: string, to: string, currency: string, other: number | null) =>
    [...analysisKeys.all, 'break-even', from, to, currency, other] as const,
  cohorts: () => [...analysisKeys.all, 'cohorts'] as const,
  workingCapital: (from: string, to: string, currency: string) =>
    [...analysisKeys.all, 'working-capital', from, to, currency] as const,
}

export function useCollectionsWorklist(options: { enabled?: boolean } = {}) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: analysisKeys.collections(),
    queryFn: async (): Promise<CollectionsWorklist> => {
      const { data } = await apiClient.get<CollectionsWorklist>('/analysis/collections')
      return {
        ...data,
        actions: asList<CollectionsWorklist['actions'][number]>(data?.actions),
        outstandingByCurrency: asList<CollectionsWorklist['outstandingByCurrency'][number]>(
          data?.outstandingByCurrency,
        ),
      }
    },
    enabled: authReady && options.enabled !== false,
    staleTime: 30_000,
  })
}

export function useCustomerRisk(customerId: string | null) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: analysisKeys.customerRisk(customerId ?? ''),
    queryFn: async (): Promise<CustomerRisk> => {
      const { data } = await apiClient.get<CustomerRisk>(`/analysis/customers/${customerId}/risk`)
      return { ...data, signals: asList<CustomerRisk['signals'][number]>(data?.signals) }
    },
    enabled: authReady && !!customerId,
    staleTime: 60_000,
  })
}

export function useSupplierAnalysis(options: { enabled?: boolean } = {}) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: analysisKeys.suppliers(),
    queryFn: async (): Promise<SupplierAnalysis> => {
      const { data } = await apiClient.get<SupplierAnalysis>('/analysis/suppliers')
      return {
        ...data,
        suppliers: asList<SupplierAnalysis['suppliers'][number]>(data?.suppliers),
        concentration: asList<SupplierAnalysis['concentration'][number]>(data?.concentration),
      }
    },
    enabled: authReady && options.enabled !== false,
    staleTime: 60_000,
  })
}

export function useBreakEven(input: {
  from: string
  to: string
  currency: string
  otherFixedCosts: number | null
  enabled?: boolean
}) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: analysisKeys.breakEven(input.from, input.to, input.currency, input.otherFixedCosts),
    queryFn: async (): Promise<BreakEvenAnalysis> => {
      const { data } = await apiClient.get<BreakEvenAnalysis>('/analysis/break-even', {
        params: {
          from: input.from,
          to: input.to,
          currency: input.currency,
          ...(input.otherFixedCosts !== null ? { otherFixedCosts: input.otherFixedCosts } : {}),
        },
      })
      return { ...data, rows: asList<BreakEvenAnalysis['rows'][number]>(data?.rows) }
    },
    enabled: authReady && input.enabled !== false && !!input.from && !!input.to,
    staleTime: 60_000,
  })
}

export function useWorkingCapital(input: { from: string; to: string; currency: string }) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: analysisKeys.workingCapital(input.from, input.to, input.currency),
    queryFn: async (): Promise<WorkingCapitalAnalysis> => {
      const { data } = await apiClient.get<WorkingCapitalAnalysis>('/analysis/working-capital', {
        params: { from: input.from, to: input.to, currency: input.currency },
      })
      return { ...data, otherCurrencies: asList<string>(data?.otherCurrencies) }
    },
    enabled: authReady && !!input.from && !!input.to && !!input.currency,
    staleTime: 60_000,
  })
}

export function useCohorts(options: { enabled?: boolean } = {}) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: analysisKeys.cohorts(),
    queryFn: async (): Promise<CohortAnalysis> => {
      const { data } = await apiClient.get<CohortAnalysis>('/analysis/cohorts')
      return { ...data, cohorts: asList<CohortAnalysis['cohorts'][number]>(data?.cohorts) }
    },
    enabled: authReady && options.enabled !== false,
    staleTime: 5 * 60_000,
  })
}
