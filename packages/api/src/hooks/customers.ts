// ============================================
// Customer Hooks — TanStack Query
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import type {
  Customer,
  CreateCustomer,
  UpdateCustomer,
  CustomerFilters,
} from '@hisabche/validation'

// ============================================
// Query Keys
// ============================================

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters: CustomerFilters) => [...customerKeys.lists(), filters] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
}

// ============================================
// Hooks
// ============================================

export function useCustomers(filters: CustomerFilters = { page: 1, limit: 20, sortDirection: 'desc' }) {
  return useQuery({
    queryKey: customerKeys.list(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<{ customers: Customer[]; total: number }>('/customers', {
        params: filters,
      })
      return data
    },
    staleTime: 60_000,
    placeholderData: (previousData: any) => previousData,
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: customerKeys.detail(id!),
    queryFn: async () => {
      const { data } = await apiClient.get<Customer>(`/customers/${id}`)
      return data
    },
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateCustomer) => {
      const { data } = await apiClient.post<Customer>('/customers', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCustomer) => {
      const { data } = await apiClient.patch<Customer>(`/customers/${id}`, input)
      return data
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}