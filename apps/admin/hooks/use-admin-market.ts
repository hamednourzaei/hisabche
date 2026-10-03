'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, asList, type MarketListing, type MarketSellerProfile } from '@hisabche/api'

/**
 * The goods marketplace, from the platform side.
 *
 * Endpoints (backend/src/routes/market.routes.ts, all behind platformAdminGuard):
 *
 *   GET  /admin/market                           -> { enabled }
 *   PUT  /admin/market/enabled                   { enabled }
 *   GET  /admin/market/sellers?q=                -> { sellers }
 *   POST /admin/market/sellers/:id/status        { status, reason? }   (:id = workspace id)
 *   POST /admin/market/sellers/:id/verified      { verified }
 *   GET  /admin/market/listings?workspaceId=     -> { listings }
 *   POST /admin/market/listings/:id/suspended    { suspended, reason? }
 *
 * The marketplace is OFF until the switch here is turned on. Suspending needs
 * a reason — the seller reads it.
 */

export type AdminMarketListing = MarketListing & { workspaceId: string }

export const adminMarketKeys = {
  all: ['admin', 'market'] as const,
  state: () => [...adminMarketKeys.all, 'state'] as const,
  sellers: (q: string) => [...adminMarketKeys.all, 'sellers', q] as const,
  listings: (workspaceId: string) => [...adminMarketKeys.all, 'listings', workspaceId] as const,
}

export function useAdminMarketState() {
  return useQuery({
    queryKey: adminMarketKeys.state(),
    queryFn: async (): Promise<{ enabled: boolean }> => {
      const response = await apiClient.get('/admin/market')
      return { enabled: response.data?.enabled === true }
    },
    retry: false,
  })
}

function useInvalidateMarket() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: adminMarketKeys.all })
}

export function useSetMarketEnabled() {
  const invalidate = useInvalidateMarket()
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiClient.put('/admin/market/enabled', { enabled })
    },
    onSuccess: invalidate,
  })
}

export function useAdminMarketSellers(q: string) {
  const query = q.trim()
  return useQuery({
    queryKey: adminMarketKeys.sellers(query),
    queryFn: async (): Promise<MarketSellerProfile[]> => {
      const response = await apiClient.get('/admin/market/sellers', { params: { q: query } })
      return asList<MarketSellerProfile>(response.data?.sellers)
    },
    retry: false,
  })
}

export function useSetSellerStatus() {
  const invalidate = useInvalidateMarket()
  return useMutation({
    mutationFn: async (input: {
      workspaceId: string
      status: 'active' | 'suspended'
      reason: string
    }) => {
      await apiClient.post(`/admin/market/sellers/${input.workspaceId}/status`, {
        status: input.status,
        ...(input.reason.trim() ? { reason: input.reason.trim() } : {}),
      })
    },
    onSuccess: invalidate,
  })
}

export function useSetSellerVerified() {
  const invalidate = useInvalidateMarket()
  return useMutation({
    mutationFn: async (input: { workspaceId: string; verified: boolean }) => {
      await apiClient.post(`/admin/market/sellers/${input.workspaceId}/verified`, {
        verified: input.verified,
      })
    },
    onSuccess: invalidate,
  })
}

export function useAdminMarketListings(workspaceId: string | null) {
  return useQuery({
    queryKey: adminMarketKeys.listings(workspaceId ?? ''),
    queryFn: async (): Promise<AdminMarketListing[]> => {
      const response = await apiClient.get('/admin/market/listings', { params: { workspaceId } })
      return asList<AdminMarketListing>(response.data?.listings)
    },
    enabled: workspaceId !== null,
    retry: false,
  })
}

export function useSetListingSuspended() {
  const invalidate = useInvalidateMarket()
  return useMutation({
    mutationFn: async (input: { id: string; suspended: boolean; reason: string }) => {
      await apiClient.post(`/admin/market/listings/${input.id}/suspended`, {
        suspended: input.suspended,
        ...(input.reason.trim() ? { reason: input.reason.trim() } : {}),
      })
    },
    onSuccess: invalidate,
  })
}
