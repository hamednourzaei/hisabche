// ============================================
// Product Hooks — TanStack Query
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import type {
  Product,
  CreateProduct,
  UpdateProduct,
  ProductFilters,
} from '@hisabche/validation'

// ============================================
// Query Keys
// ============================================
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: ProductFilters) => [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
}

// ============================================
// Hooks
// ============================================
export function useProducts(filters: ProductFilters = { page: 1, limit: 20, sortDirection: 'desc' }) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<{ products: Product[]; total: number }>('/products', {
        params: filters,
      })
      return data
    },
    staleTime: 1000 * 60 * 2,
  })
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: productKeys.detail(id!),
    queryFn: async () => {
      const { data } = await apiClient.get<Product>(`/products/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateProduct) => {
      const { data } = await apiClient.post<Product>('/products', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateProduct) => {
      const { data } = await apiClient.put<Product>(`/products/${id}`, input)
      return data
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: productKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/products/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}