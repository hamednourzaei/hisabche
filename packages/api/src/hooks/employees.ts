// ============================================
// packages/api/src/hooks/employees.ts
// ============================================
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export const employeeKeys = {
  all: ['employees'] as const,
  list: (params: { page?: number; limit?: number }) =>
    [...employeeKeys.all, 'list', params] as const,
  detail: (id: string) => [...employeeKeys.all, 'detail', id] as const,
}

export function useEmployees(params: { page?: number; limit?: number } = {}) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get('/employees', { params })
      return data
    },
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useEmployee(id: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get(`/employees/${id}`)
      return data
    },
    enabled: authReady && !!id,
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { data } = await apiClient.post('/employees', values)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  })
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.patch(`/employees/${id}`, values)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/employees/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  })
}

export function useExpenseClaims(status?: string) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: [...employeeKeys.all, 'expense-claims', status] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Record<string, unknown>[] }>('/expense-claims', {
        params: status ? { status } : undefined,
      })
      return asList(data?.data, '/expense-claims')
    },
    enabled: ready,
  })
}

export function useCreateExpenseClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post('/expense-claims', input)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  })
}

export function useApproveExpenseClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/expense-claims/${id}/approve`, {})
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  })
}

export function useRejectExpenseClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await apiClient.post(`/expense-claims/${id}/reject`, { reason })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  })
}

export function useReimburseExpenseClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, currency }: { id: string; currency: string }) => {
      const { data } = await apiClient.post(`/expense-claims/${id}/reimburse`, { currency })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  })
}
