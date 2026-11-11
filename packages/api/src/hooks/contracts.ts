import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ContractCreateInput } from '@hisabche/validation'
import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export function useContracts() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: ['contracts'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: unknown[] }>('/contracts')
      return asList<Record<string, unknown>>(data?.data, '/contracts')
    },
    enabled: ready,
  })
}

export function useCreateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ContractCreateInput) =>
      (await apiClient.post('/contracts', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}

export function useBillContractPeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      periodKey,
      dueDate,
    }: {
      id: string
      periodKey: string
      dueDate: string
    }) => (await apiClient.post(`/contracts/${id}/bill`, { periodKey, dueDate })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useTerminateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/contracts/${id}/terminate`, {})).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}

export function useFlagContractSlaBreach() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      reason,
      elapsedHours,
    }: {
      id: string
      reason: string
      elapsedHours: number
    }) => (await apiClient.post(`/contracts/${id}/sla-breach`, { reason, elapsedHours })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}

export function useReturnLeaseAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      conditionCode,
      notes,
    }: {
      id: string
      conditionCode: string
      notes?: string | undefined
    }) => (await apiClient.post(`/contracts/${id}/lease-return`, { conditionCode, notes })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}
