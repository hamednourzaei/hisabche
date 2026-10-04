// ============================================
// Price lists (#19).
//
//   GET   /price-lists
//   GET   /price-lists/:id
//   GET   /price-lists/for-customer/:customerId
//   POST  /price-lists
//   PATCH /price-lists/:id/active            { isActive }
//   PUT   /price-lists/:id/items             { items }
//   PUT   /price-lists/customers/:customerId { priceListId | null }
//
// A price list sets the price a product is SUGGESTED at for the customers on
// it. A list, and a price on it, is retired — never deleted.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CustomerPriceList,
  PriceListInput,
  PriceListItemsInput,
  SavedPriceList,
} from '@hisabche/validation'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export interface PriceListDetail extends SavedPriceList {
  items: {
    productId: string
    name: string
    unit: string | null
    /** The product's own sell price, to read the list price against. */
    ownPrice: number
    unitPrice: number
  }[]
  customers: { id: string; name: string }[]
}

export const priceListKeys = {
  all: ['price-lists'] as const,
  list: () => [...priceListKeys.all, 'list'] as const,
  detail: (id: string) => [...priceListKeys.all, 'detail', id] as const,
  forCustomer: (customerId: string) => [...priceListKeys.all, 'customer', customerId] as const,
}

export function usePriceLists(options: { enabled?: boolean } = {}) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: priceListKeys.list(),
    queryFn: async (): Promise<SavedPriceList[]> => {
      const { data } = await apiClient.get<{ priceLists: SavedPriceList[] }>('/price-lists')
      return asList<SavedPriceList>(data?.priceLists)
    },
    enabled: ready && options.enabled !== false,
    staleTime: 60_000,
  })
}

export function usePriceList(id: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: priceListKeys.detail(id ?? ''),
    queryFn: async (): Promise<PriceListDetail> => {
      const { data } = await apiClient.get<PriceListDetail>(`/price-lists/${id}`)
      return { ...data, items: asList(data?.items), customers: asList(data?.customers) }
    },
    enabled: ready && !!id,
  })
}

/** The list a customer buys on, with its prices; `null` when they are on none. */
export function useCustomerPriceList(
  customerId: string | null,
  options: { enabled?: boolean } = {},
) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: priceListKeys.forCustomer(customerId ?? ''),
    queryFn: async (): Promise<CustomerPriceList | null> => {
      const { data } = await apiClient.get<{ priceList: CustomerPriceList | null }>(
        `/price-lists/for-customer/${customerId}`,
      )
      const list = data?.priceList ?? null
      return list ? { ...list, prices: asList(list.prices) } : null
    },
    enabled: ready && !!customerId && options.enabled !== false,
    staleTime: 60_000,
  })
}

export function useSavePriceList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (list: PriceListInput) =>
      (await apiClient.post<SavedPriceList>('/price-lists', list)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: priceListKeys.all }),
  })
}

export function useSetPriceListActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) =>
      (
        await apiClient.patch<SavedPriceList>(`/price-lists/${input.id}/active`, {
          isActive: input.isActive,
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: priceListKeys.all }),
  })
}

export function useSetPriceListItems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; items: PriceListItemsInput['items'] }) =>
      (
        await apiClient.put<PriceListDetail>(`/price-lists/${input.id}/items`, {
          items: input.items,
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: priceListKeys.all }),
  })
}

export function useAssignPriceList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { customerId: string; priceListId: string | null }) =>
      (
        await apiClient.put<{ customerId: string; priceListId: string | null }>(
          `/price-lists/customers/${input.customerId}`,
          { priceListId: input.priceListId },
        )
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: priceListKeys.all }),
  })
}
