// ============================================
// packages/api/src/hooks/inventory-reservations.ts
//
// V58 · P0-1 — the client side of stock reservations / ATP.
//
// A RESERVATION IS A PROMISE. «این ۵ عدد برای این فاکتور کنار گذاشته شده» —
// real stock is bound, so every write here is gated on the server by
// `product.write` and carried out by the Postgres functions in
// docs/stock-reservations-01-migration.sql (atomic, idempotent on the
// caller's key, workspace-bound). This file carries shapes and calls only.
//
// ATP = on hand − active, unexpired reservations. A hold is never free.
// Settle moves NO stock: the sale that honours the promise decrements
// warehouse_stock through its own existing path.
// ============================================

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export type ReservationStatus = 'active' | 'settled' | 'released' | 'expired'

export interface StockReservation {
  id: string
  warehouseId: string
  productId: string
  variantId: string | null
  quantity: number
  status: ReservationStatus
  referenceType: string | null
  referenceId: string | null
  expiresAt: string | null
  createdAt: string
  settledQuantity: number | null
  releasedQuantity: number | null
}

export interface AvailableToPromise {
  onHand: number
  reserved: number
  available: number
}

export const reservationKeys = {
  all: ['inventory-reservations'] as const,
  list: (status?: string) =>
    [...reservationKeys.all, 'list', status ?? 'all'] as const,
  available: (warehouseId: string, productId: string) =>
    [...reservationKeys.all, 'available', warehouseId, productId] as const,
}

/** What is free to promise right now for one warehouse + product. */
export function useAvailableToPromise(warehouseId: string | null | undefined, productId: string | null | undefined) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: reservationKeys.available(warehouseId ?? '', productId ?? ''),
    queryFn: async (): Promise<AvailableToPromise> => {
      const { data } = await apiClient.get<Partial<AvailableToPromise>>(
        '/inventory/reservations/available',
        { params: { warehouseId, productId } },
      )
      return {
        onHand: Number(data?.onHand) || 0,
        reserved: Number(data?.reserved) || 0,
        available: Number(data?.available) || 0,
      }
    },
    enabled: authReady && !!warehouseId && !!productId,
    staleTime: 15_000,
  })
}

export interface ReservationListOptions {
  status?: ReservationStatus | undefined
  warehouseId?: string | undefined
  productId?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export function useReservations(options: ReservationListOptions = {}) {
  const authReady = useAuthReady()
  const { status, warehouseId, productId, limit = 50, offset = 0 } = options

  return useQuery({
    queryKey: [...reservationKeys.list(status), warehouseId ?? '', productId ?? '', limit, offset] as const,
    queryFn: async (): Promise<{ reservations: StockReservation[]; total: number }> => {
      const { data } = await apiClient.get<{
        reservations: unknown
        total?: number
      }>('/inventory/reservations', {
        params: { status, warehouseId, productId, limit, offset },
      })
      return {
        reservations: asList<StockReservation>(data?.reservations),
        total: Number(data?.total) || 0,
      }
    },
    enabled: authReady,
    staleTime: 15_000,
  })
}

export interface ReserveStockInput {
  warehouseId: string
  productId: string
  variantId?: string | null | undefined
  quantity: number
  referenceType?: string | null | undefined
  referenceId?: string | null | undefined
  /** The caller's own idempotency key (a client-generated UUID). */
  idempotencyKey: string
  expiresAt?: string | null | undefined
  notes?: string | null | undefined
}

export interface ReserveStockResult {
  status: 'reserved' | 'already_reserved'
  reservationId: string
  quantity: number
  reservationStatus: string
}

/** Reserve. Idempotent on `idempotencyKey` — a retry returns the hold already made. */
export function useReserveStock() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: ReserveStockInput): Promise<ReserveStockResult> => {
      const { data } = await apiClient.post('/inventory/reservations', input)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reservationKeys.all })
    },
  })
}

/**
 * Release a hold — whole, or a part. Never deletes: the row, the actor and
 * the timestamp stay, so the story of the promise is answerable later.
 */
export function useReleaseReservation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      reservationId: string
      quantity?: number | null | undefined
      notes?: string | null | undefined
    }) => {
      const { data } = await apiClient.post('/inventory/reservations/release', input)
      return data as Record<string, unknown>
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reservationKeys.all })
    },
  })
}

/** Settle — the promise was honoured (partial allowed). Moves no stock. */
export function useSettleReservation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      reservationId: string
      quantity?: number | null | undefined
      notes?: string | null | undefined
    }) => {
      const { data } = await apiClient.post('/inventory/reservations/settle', input)
      return data as Record<string, unknown>
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reservationKeys.all })
    },
  })
}
