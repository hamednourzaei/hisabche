// ============================================
// packages/api/src/hooks/agriculture.ts
//
// Livestock Groups hooks (cloud + offline local-engine parity).
// Crop cycle hooks live in `universal-core.ts` and are re-used from there.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient, { localRequest } from '../lib/client'
import { executionSiteFor } from '../lib/execution-site'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export interface LivestockGroupRow {
  id: string
  category: string
  head_count?: number
  headCount?: number
  birth_or_acquisition_date?: string
  birthOrAcquisitionDate?: string
  location_barn?: string | null
  locationBarn?: string | null
  status?: string
}

export const agricultureKeys = {
  all: ['agriculture'] as const,
  livestock: () => [...agricultureKeys.all, 'livestock'] as const,
}

export function useLivestockGroups() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: agricultureKeys.livestock(),
    queryFn: async () => {
      if (executionSiteFor('invoice.create') === 'device') {
        const res = await localRequest<{ data?: LivestockGroupRow[] }>(
          'GET',
          '/local-ops/livestock-groups',
        )
        return asList<LivestockGroupRow>(res?.data ?? res)
      }
      const { data } = await apiClient.get<{ data?: LivestockGroupRow[] }>('/agriculture/livestock')
      return asList<LivestockGroupRow>(data?.data ?? data)
    },
    enabled: ready,
    staleTime: 30_000,
  })
}

export function useRecordLivestockGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      category: string
      headCount: number
      birthOrAcquisitionDate: string
      locationBarn?: string | undefined
    }) => {
      if (executionSiteFor('invoice.create') === 'device') {
        return localRequest<{ data: LivestockGroupRow }>(
          'POST',
          '/local-ops/livestock-groups',
          input,
        )
      }
      const { data } = await apiClient.post<{ data: LivestockGroupRow }>(
        '/agriculture/livestock',
        input,
      )
      return data.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: agricultureKeys.livestock() }),
  })
}
