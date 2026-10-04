// ============================================
// Loans (#125) and investments (#126) — registers beside the books.
//
//   GET   /financing/facilities
//   POST  /financing/facilities
//   PATCH /financing/facilities/:id/active   { isActive }
//   GET   /financing/holdings
//   POST  /financing/holdings
//   PATCH /financing/holdings/:id            { marketValue + valuedOn } | { isActive }
//
// Nothing here posts a journal entry. Totals are per currency.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export type FacilityKind = 'loan' | 'receivable_facility'

export interface LoanFacility {
  id: string
  kind: FacilityKind
  counterparty: string
  principal: number
  currency: string
  annualRatePercent: number
  startDate: string
  endDate: string | null
  chargesPerYear: number
  isActive: boolean
  /** Simple interest from the start date to today. A calculation, not an entry. */
  accruedInterest: number
  accruedDays: number
  /** Null when the loan has no end date to spread it over. */
  instalment: { perInstalment: number; total: number; count: number } | null
}

export interface LoanFacilities {
  asOf: string
  facilities: LoanFacility[]
  totals: Array<{
    currency: string
    kind: FacilityKind
    principal: number
    accruedInterest: number
  }>
}

export interface LoanFacilityInput {
  kind: FacilityKind
  counterparty: string
  principal: number
  currency: string
  annualRatePercent: number
  startDate: string
  endDate: string | null
  chargesPerYear: 1 | 2 | 4 | 12
}

export interface InvestmentHolding {
  id: string
  label: string
  cost: number
  marketValue: number
  currency: string
  valuedOn: string
  isActive: boolean
}

export interface InvestmentHoldings {
  holdings: InvestmentHolding[]
  summaries: Array<{
    currency: string
    cost: number
    marketValue: number
    unrealisedGain: number
    unrealisedGainPercent: number | null
    basis: 'VALUATION_DIFFERENCE_ONLY'
  }>
}

export const financingKeys = {
  all: ['financing'] as const,
  facilities: () => [...financingKeys.all, 'facilities'] as const,
  holdings: () => [...financingKeys.all, 'holdings'] as const,
}

export function useLoanFacilities() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: financingKeys.facilities(),
    queryFn: async (): Promise<LoanFacilities> => {
      const { data } = await apiClient.get<LoanFacilities>('/financing/facilities')
      return {
        ...data,
        facilities: asList<LoanFacility>(data?.facilities),
        totals: asList<LoanFacilities['totals'][number]>(data?.totals),
      }
    },
    enabled: ready,
    staleTime: 60_000,
  })
}

export function useCreateLoanFacility() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: LoanFacilityInput) =>
      (await apiClient.post<LoanFacility>('/financing/facilities', input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financingKeys.facilities() }),
  })
}

export function useSetLoanFacilityActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) =>
      (
        await apiClient.patch<LoanFacility>(`/financing/facilities/${input.id}/active`, {
          isActive: input.isActive,
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financingKeys.facilities() }),
  })
}

export function useInvestmentHoldings() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: financingKeys.holdings(),
    queryFn: async (): Promise<InvestmentHoldings> => {
      const { data } = await apiClient.get<InvestmentHoldings>('/financing/holdings')
      return {
        ...data,
        holdings: asList<InvestmentHolding>(data?.holdings),
        summaries: asList<InvestmentHoldings['summaries'][number]>(data?.summaries),
      }
    },
    enabled: ready,
    staleTime: 60_000,
  })
}

export function useCreateInvestmentHolding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      label: string
      cost: number
      marketValue: number
      currency: string
      valuedOn: string
    }) => (await apiClient.post<InvestmentHolding>('/financing/holdings', input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financingKeys.holdings() }),
  })
}

export function useUpdateInvestmentHolding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      marketValue?: number | undefined
      valuedOn?: string | undefined
      isActive?: boolean | undefined
    }) => {
      const { id, ...body } = input
      return (await apiClient.patch<InvestmentHolding>(`/financing/holdings/${id}`, body)).data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financingKeys.holdings() }),
  })
}
