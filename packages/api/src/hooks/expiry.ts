// ============================================
// Batch, serial and expiry hooks — TanStack Query
//
// ---------------------------------------------------------------------------
// AN EXPIRED BATCH IS A REFUSAL, NOT A WARNING
//
// `usePlanIssue` returns the batches an issue WOULD draw from and consumes
// nothing. Batches that have expired appear in `blockedByExpiry` — they are
// not offered as a choice an operator can override in the UI. Medicine sold
// past its date is not a data-quality problem.
//
// Shortfall is reported as a shortfall. It is never clamped to zero: stock the
// shop does not have must read as missing, not as fulfilled.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { asList } from '../lib/as-list'

// ═══ Types ═══

export type ExpiryState = 'no_expiry' | 'fresh' | 'near_expiry' | 'expired'
export type AllocationStrategy = 'fifo' | 'fefo' | 'manual'
export type SerialStatus = 'in_stock' | 'sold' | 'returned' | 'scrapped'

export interface StockBatch {
  id: string
  productId: string
  batchNumber: string
  /** Null when this batch does not expire. */
  expiryDate: string | null
  manufacturedDate?: string | null
  receivedQty: number
  remainingQty: number
  /** The cost layer these goods arrived on — identity tied to money. */
  costLayerId: string | null
  warehouseId?: string | null
  receivedOn: string
}

export interface SerialUnit {
  id: string
  productId: string
  serialNumber: string
  status: SerialStatus
  batchId?: string | null
  costLayerId: string | null
  /** What this exact unit cost. Not an average. */
  unitCostMinor: number
  warehouseId?: string | null
  receivedOn: string
}

export interface ExpiryBucket {
  state: ExpiryState
  batches: Array<{
    batchId: string
    batchNumber: string
    productId: string
    quantity: number
    expiryDate: string | null
    /** Negative means already past. */
    daysRemaining: number | null
  }>
  totalQuantity: number
}

export interface ExpiryReport {
  asOf: string
  /** Expired first: the only group whose deadline has already passed. */
  buckets: ExpiryBucket[]
  /** Minor units the balance sheet counts and the shop can no longer sell. */
  expiredValueMinor: number
}

export interface AllocationPlan {
  allocations: Array<{
    batchId: string
    batchNumber: string
    quantity: number
    expiryDate: string | null
    costLayerId: string | null
  }>
  /** What no usable batch could cover. Never clamped to zero. */
  shortfall: number
  strategy: AllocationStrategy
  blockedByExpiry: Array<{ batchId: string; batchNumber: string; quantity: number }>
}

export const expiryKeys = {
  all: ['traceability'] as const,
  batches: (productId?: string) => [...expiryKeys.all, 'batches', productId ?? 'all'] as const,
  serials: (productId?: string, status?: string) =>
    [...expiryKeys.all, 'serials', productId ?? 'all', status ?? 'all'] as const,
  report: (asOf: string, nearExpiryDays: number) =>
    [...expiryKeys.all, 'expiry', asOf, nearExpiryDays] as const,
  trail: (consumerType: string, consumerId: string) =>
    [...expiryKeys.all, 'trail', consumerType, consumerId] as const,
}

// ═══ Queries ═══

export function useBatches(productId?: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: expiryKeys.batches(productId),
    queryFn: async () => {
      const { data } = await apiClient.get('/operations/batches', {
        params: productId ? { productId } : {},
      })
      return asList<StockBatch>(data)
    },
    enabled: ready,
    staleTime: 30_000,
  })
}

export function useSerials(productId?: string, status?: SerialStatus) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: expiryKeys.serials(productId, status),
    queryFn: async () => {
      const { data } = await apiClient.get('/operations/serials', {
        params: { ...(productId ? { productId } : {}), ...(status ? { status } : {}) },
      })
      return asList<SerialUnit>(data)
    },
    enabled: ready,
    staleTime: 30_000,
  })
}

/** What is expiring, grouped so a shopkeeper can act on it today. */
export function useExpiryReport(asOf?: string, nearExpiryDays = 30) {
  const ready = useAuthReady()
  const date = asOf ?? new Date().toISOString().slice(0, 10)

  return useQuery({
    queryKey: expiryKeys.report(date, nearExpiryDays),
    queryFn: async () => {
      const { data } = await apiClient.get('/operations/expiry', {
        params: { asOf: date, nearExpiryDays },
      })
      return data as ExpiryReport
    },
    enabled: ready,
    staleTime: 60_000,
  })
}

/** The trail from a document back to the exact physical goods. */
export function useLotTrail(consumerType: string, consumerId: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: expiryKeys.trail(consumerType, consumerId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/operations/lot-trail/${consumerType}/${consumerId}`)
      return data
    },
    enabled: ready && Boolean(consumerType) && Boolean(consumerId),
    staleTime: 5 * 60_000,
  })
}

// ═══ Mutations ═══

/**
 * Which batches an issue would take. FEFO by default.
 *
 * A mutation because it takes a body, not because it writes: it consumes
 * nothing. Never cached — a plan built against stock as it was five minutes
 * ago is a plan against stock that may already be sold.
 */
export function usePlanIssue() {
  return useMutation({
    mutationFn: async (input: {
      productId: string
      quantity: number
      strategy?: AllocationStrategy
      asOf?: string
      manual?: Array<{ batchId: string; quantity: number }>
    }) => {
      const { data } = await apiClient.post('/operations/batches/plan-issue', input)
      return data as AllocationPlan
    },
    retry: false,
  })
}

export function useReceiveBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      productId: string
      batchNumber: string
      quantity: number
      expiryDate?: string | null
      manufacturedDate?: string | null
      costLayerId?: string | null
      warehouseId?: string | null
      receivedOn?: string
    }) => {
      const { data } = await apiClient.post('/operations/batches', input)
      return data as StockBatch
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expiryKeys.all })
    },
  })
}

export function useReceiveSerials() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      productId: string
      serialNumbers: string[]
      unitCostMinor: number
      batchId?: string | null
      costLayerId?: string | null
      warehouseId?: string | null
    }) => {
      const { data } = await apiClient.post('/operations/serials', input)
      return asList<SerialUnit>(data)
    },
    // A serial number is unique by definition, so a duplicated retry is
    // rejected by the database rather than silently doubling stock. Still not
    // retried: the operator should see which numbers were refused.
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expiryKeys.all })
    },
  })
}
