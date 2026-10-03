// ============================================
// packages/api/src/hooks/market.ts
//
// The goods marketplace, from a business's side: its seller profile and its
// listings (backend/src/routes/market.routes.ts). The marketplace is OFF by
// default — `enabled` says so, and the screen says so with it.
//
// The public pages do NOT use these hooks: they are server components that
// fetch /api/public/market/… directly (apps/web/lib/market-api.ts). The types
// are shared from here.
//
// ⚠️ A listing's price is the seller's own statement, an integer in the
// currency's minor unit. Nothing here derives or converts a price.
// ============================================

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export interface MarketPublicSeller {
  slug: string
  name: string
  description: string
  city: string
  country: string
  contact: string
  verified: boolean
}

export type MarketAvailability = 'in_stock' | 'out_of_stock'

export interface MarketPublicListing {
  slug: string
  title: string
  description: string
  priceMinor: number
  currency: string
  availability: MarketAvailability
  quantity: number | null
  imageUrl: string | null
  seoTitle: string
  seoDescription: string
  updatedAt: string
  seller: Pick<MarketPublicSeller, 'slug' | 'name' | 'city' | 'country' | 'verified'>
}

export interface MarketPublicListingDetail extends Omit<MarketPublicListing, 'seller'> {
  images: Array<{ url: string; altText: string }>
  seller: MarketPublicSeller
}

export interface MarketPublicList {
  listings: MarketPublicListing[]
  total: number
}

export interface MarketSitemap {
  enabled: boolean
  sellers: Array<{ slug: string }>
  listings: Array<{ seller: string; slug: string; updatedAt: string }>
}

export interface MarketSellerProfile extends MarketPublicSeller {
  workspaceId: string
  status: 'active' | 'suspended'
  suspendedReason: string | null
}

export interface MarketSellerProfileInput {
  slug: string
  name: string
  description: string
  city: string
  country: string
  contact: string
}

export type MarketListingStatus = 'draft' | 'active' | 'paused'

export interface MarketListing {
  id: string
  productId: string
  slug: string
  title: string
  description: string
  priceMinor: number
  currency: string
  availability: MarketAvailability
  quantity: number | null
  isHidden: boolean
  status: MarketListingStatus
  /** Suspended by the platform: not public whatever `status` says. */
  suspended: boolean
  suspendedReason: string | null
  seoTitle: string
  seoDescription: string
  updatedAt: string
}

export type MarketListingInput = Omit<
  MarketListing,
  'id' | 'suspended' | 'suspendedReason' | 'updatedAt'
>

export interface MarketSellerOverview {
  /** The platform switch. False = the marketplace does not exist yet. */
  enabled: boolean
  profile: MarketSellerProfile | null
  listings: MarketListing[]
}

export const marketKeys = {
  all: ['market'] as const,
  seller: () => [...marketKeys.all, 'seller'] as const,
}

export function useMarketSeller() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: marketKeys.seller(),
    queryFn: async ({ signal }): Promise<MarketSellerOverview> => {
      const { data } = await apiClient.get('/market/seller', { signal })
      const body = (data ?? {}) as Partial<MarketSellerOverview>
      return {
        enabled: body.enabled === true,
        profile: body.profile ?? null,
        listings: asList<MarketListing>(body.listings),
      }
    },
    enabled: authReady,
    // 403 (not a manager) and 503 (not set up) are answers, not blips.
    retry: false,
  })
}

function useSellerInvalidation() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: marketKeys.seller() })
}

export function useSaveMarketSellerProfile() {
  const invalidate = useSellerInvalidation()
  return useMutation({
    mutationFn: async (input: MarketSellerProfileInput) => {
      const { data } = await apiClient.put('/market/seller', input)
      return data as MarketSellerProfile
    },
    onSuccess: invalidate,
  })
}

export function useSaveMarketListing() {
  const invalidate = useSellerInvalidation()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string | null; input: MarketListingInput }) => {
      const { data } = id
        ? await apiClient.put(`/market/listings/${id}`, input)
        : await apiClient.post('/market/listings', input)
      return data as MarketListing
    },
    onSuccess: invalidate,
  })
}

export function useDeleteMarketListing() {
  const invalidate = useSellerInvalidation()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/market/listings/${id}`)
    },
    onSuccess: invalidate,
  })
}
