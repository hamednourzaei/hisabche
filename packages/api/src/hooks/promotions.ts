// ============================================
// Promotions (#114–#117).
//
//   GET   /promotions[?active=1]
//   POST  /promotions
//   PATCH /promotions/:id/active   { isActive }
//
// A promotion lowers the SUGGESTED price of a sale line when a product is
// picked. It is retired (`isActive: false`), never deleted.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PromotionInput, SavedPromotion } from '@hisabche/validation'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export const promotionKeys = {
  all: ['promotions'] as const,
  list: (activeOnly: boolean) => [...promotionKeys.all, activeOnly ? 'active' : 'every'] as const,
}

export function usePromotions(options: { activeOnly?: boolean; enabled?: boolean } = {}) {
  const ready = useAuthReady()
  const activeOnly = options.activeOnly === true
  return useQuery({
    queryKey: promotionKeys.list(activeOnly),
    queryFn: async (): Promise<SavedPromotion[]> => {
      const { data } = await apiClient.get<{ promotions: SavedPromotion[] }>('/promotions', {
        params: activeOnly ? { active: '1' } : {},
      })
      return asList<SavedPromotion>(data?.promotions)
    },
    enabled: ready && options.enabled !== false,
    staleTime: 60_000,
  })
}

export function useSavePromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (promotion: PromotionInput) =>
      (await apiClient.post<SavedPromotion>('/promotions', promotion)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: promotionKeys.all }),
  })
}

export function useSetPromotionActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) =>
      (
        await apiClient.patch<SavedPromotion>(`/promotions/${input.id}/active`, {
          isActive: input.isActive,
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: promotionKeys.all }),
  })
}
