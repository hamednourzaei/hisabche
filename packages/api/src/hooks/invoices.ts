// ============================================
// Invoice Hooks — TanStack Query
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import type {
  Invoice,
  CreateInvoice,
  UpdateInvoice,
  InvoiceFilters,
} from '@hisabche/validation'

// ============================================
// Query Keys
// ============================================
export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: InvoiceFilters) => [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
}

// ============================================
// Hooks
// ============================================
export function useInvoices(filters: InvoiceFilters = { page: 1, limit: 20, sortDirection: 'desc' }) {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<{ invoices: Invoice[]; total: number }>('/invoices', {
        params: filters,
      })
      return data
    },
    staleTime: 1000 * 60 * 2,
    placeholderData: (previousData) => previousData,
  })
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: invoiceKeys.detail(id!),
    queryFn: async () => {
      const { data } = await apiClient.get<Invoice>(`/invoices/${id}`)
      return data
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateInvoice) => {
      const { data } = await apiClient.post<Invoice>('/invoices', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() })
    },
  })
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateInvoice) => {
      const { data } = await apiClient.patch<Invoice>(`/invoices/${id}`, input)
      return data
    },
    onMutate: async (vars) => {
      const { id, ...updatedFields } = vars
      await queryClient.cancelQueries({ queryKey: invoiceKeys.detail(id) })
      const previousInvoice = queryClient.getQueryData<Invoice>(invoiceKeys.detail(id))

      if (previousInvoice) {
        queryClient.setQueryData<Invoice>(invoiceKeys.detail(id), {
          ...previousInvoice,
          ...updatedFields,
        } as Invoice)
      }

      return { previousInvoice }
    },
    onError: (_err, vars, context) => {
      if (context?.previousInvoice) {
        queryClient.setQueryData(invoiceKeys.detail(vars.id), context.previousInvoice)
      }
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(vars.id) })
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() })
    },
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/invoices/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() })
    },
  })
}
