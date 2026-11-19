// ============================================
// packages/api/src/hooks/rolls.ts
//
// WP-04 — hooks for the offline roll register. These go through localRequest
// (the device transport door), not apiClient: a shop cuts, consumes and returns
// a roll without signal. The server route is the sync authority; no fake server
// path is introduced here.
// ============================================
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { localRequest } from '../lib/client'

export const rollKeys = {
  all: ['rolls'] as const,
  list: () => [...rollKeys.all, 'list'] as const,
  detail: (id: string) => [...rollKeys.all, 'detail', id] as const,
  report: () => [...rollKeys.all, 'report'] as const,
}

export interface LocalRoll {
  id: string
  roll_number: string
  initial_length: number
  remaining_length: number
  unit: string
  location: string | null
  cost_minor: number
  custom_conversion_factor: number | null
}

export interface RollCost {
  consumedCostMinor: number
  remainingCostMinor: number
}

export interface RollReportRow extends LocalRoll {
  consumedLength: number
  cost: RollCost | null
}

export function useLocalRolls() {
  return useQuery({
    queryKey: rollKeys.list(),
    queryFn: async () =>
      (await localRequest<{ data?: LocalRoll[] }>('GET', '/local-rolls'))?.data ?? [],
  })
}

export function useLocalRoll(id: string | null) {
  return useQuery({
    queryKey: rollKeys.detail(id ?? ''),
    queryFn: async () =>
      (await localRequest<{ data: LocalRoll }>('GET', `/local-rolls/${id}`))!.data,
    enabled: Boolean(id),
  })
}

export function useRollReport() {
  return useQuery({
    queryKey: rollKeys.report(),
    queryFn: async () =>
      (await localRequest<{ data?: RollReportRow[] }>('GET', '/local-rolls/report'))?.data ?? [],
  })
}

export function useConsumeRoll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      length: number
      fromUnit?: string
      clientRequestId?: string
    }) =>
      (await localRequest<Record<string, unknown>>(
        'POST',
        `/local-rolls/${input.id}/consume`,
        input,
      ))!,
    onSuccess: () => qc.invalidateQueries({ queryKey: rollKeys.all }),
  })
}

export function useCutRoll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      cutLength: number
      wasteLength: number
      clientRequestId?: string
    }) =>
      (await localRequest<Record<string, unknown>>('POST', `/local-rolls/${input.id}/cut`, input))!,
    onSuccess: () => qc.invalidateQueries({ queryKey: rollKeys.all }),
  })
}

export function useReturnRoll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; length: number; clientRequestId?: string }) =>
      (await localRequest<Record<string, unknown>>(
        'POST',
        `/local-rolls/${input.id}/return`,
        input,
      ))!,
    onSuccess: () => qc.invalidateQueries({ queryKey: rollKeys.all }),
  })
}
