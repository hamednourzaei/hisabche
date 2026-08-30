// ============================================
// Fixed asset hooks — TanStack Query
//
// ---------------------------------------------------------------------------
// WHY THE SCHEDULE IS FETCHED, NOT COMPUTED HERE
//
// The whole depreciation schedule is precomputed and dated on the server, and
// this screen reads it. It never re-derives a monthly figure from cost and
// life: two clients rounding independently produce two different books, and a
// month missed while the shop was offline would simply vanish rather than be
// owed.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

// ═══ Types ═══

export type DepreciationMethod = 'straight_line' | 'declining' | 'declining_then_straight'

export interface FixedAsset {
  id: string
  name: string
  /** Minor units. Every money figure here is an integer. */
  costMinor: number
  salvageMinor: number
  method: DepreciationMethod
  periods: number
  periodMonths: number
  firstPeriodOn: string
  acquiredOn: string
  /** Non-null means the asset is gone and no further entry will post. */
  disposedOn: string | null
  assetAccountId: string | null
  expenseAccountId: string | null
  accumulatedAccountId: string | null
}

export interface ScheduleRow {
  period: number
  on_date: string
  amount_minor: number
  accumulated_minor: number
  book_value_minor: number
  /** Null until this period has actually been posted to the ledger. */
  posted_at: string | null
  /** Set when a disposal cancelled the rest of the schedule. */
  cancelled_at: string | null
  journal_entry_id: string | null
}

export interface CreateAssetInput {
  name: string
  costMinor: number
  salvageMinor?: number
  method: DepreciationMethod
  periods: number
  periodMonths?: number
  decliningFactor?: number
  firstPeriodOn: string
  prorataFrom?: string | null
  acquiredOn: string
  assetAccountId?: string | null
  expenseAccountId?: string | null
  accumulatedAccountId?: string | null
  sourceInvoiceId?: string | null
}

export interface DepreciationRunResult {
  posted: Array<{ assetId: string; period: number; amountMinor: number }>
  /** Assets that could not post, each with the reason said out loud. */
  skipped: Array<{ assetId: string; period: number; reason: string }>
}

export interface DisposalResult {
  costMinor: number
  accumulatedMinor: number
  netBookValueMinor: number
  proceedsMinor: number
  /** Positive is a gain, negative a loss — against BOOK VALUE, not cost. */
  gainOrLossMinor: number
  cancelledPeriods: number[]
}

export const assetKeys = {
  all: ['assets'] as const,
  list: () => [...assetKeys.all, 'list'] as const,
  schedule: (id: string) => [...assetKeys.all, 'schedule', id] as const,
}

// ═══ Queries ═══

export function useAssets() {
  const ready = useAuthReady()

  return useQuery({
    queryKey: assetKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get('/finance/assets')
      return data as FixedAsset[]
    },
    enabled: ready,
    // A register of assets changes when somebody buys or sells one, which is
    // rare. Nothing here is worth refetching on every focus.
    staleTime: 5 * 60_000,
  })
}

export function useAssetSchedule(assetId: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: assetKeys.schedule(assetId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/finance/assets/${assetId}/schedule`)
      return data as ScheduleRow[]
    },
    enabled: ready && Boolean(assetId),
    staleTime: 5 * 60_000,
  })
}

// ═══ Mutations ═══

export function useCreateAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateAssetInput) => {
      const { data } = await apiClient.post('/finance/assets', input)
      return data as FixedAsset
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all })
    },
  })
}

/**
 * Post every depreciation entry that is due.
 *
 * Retried, and safe to retry: each entry is keyed by (asset, period), so a
 * second run posts nothing. A shop that was closed for six weeks gets the six
 * entries it owes rather than one catch-up lump.
 */
export function usePostDepreciation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { asOf?: string } = {}) => {
      const { data } = await apiClient.post('/finance/assets/depreciation/run', input)
      return data as DepreciationRunResult
    },
    retry: 2,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all })
    },
  })
}

/**
 * Sell or scrap an asset.
 *
 * NOT retried. Disposal cancels the remaining schedule and posts a gain or
 * loss; if it fails, the person deciding should see that rather than have it
 * quietly re-attempted.
 */
export function useDisposeAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      assetId,
      ...body
    }: {
      assetId: string
      onDate: string
      proceedsMinor: number
    }) => {
      const { data } = await apiClient.post(`/finance/assets/${assetId}/dispose`, body)
      return data as DisposalResult
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all })
    },
  })
}
