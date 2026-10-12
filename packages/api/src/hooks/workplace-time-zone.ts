// ============================================
// Where the business is — the zone «today» is read in for its employees
// (backend/src/services/workplace-time-zone.ts).
//
//   GET /workplace/time-zone                    → { timeZone, configurable, branches }
//   PUT /workplace/time-zone                    { timeZone }          owner
//   PUT /workplace/branches/:id/time-zone       { timeZone | null }   owner
//
// `timeZone: null` = nobody has chosen one. There is no default anywhere:
// the screen says «not set», it does not show the device's zone as the answer.
// A branch with `timeZone: null` is in its business's zone.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { getActiveWorkspaceId } from '../lib/active-workspace'
import { useAuthReady } from './useAuthReady'

export interface WorkplaceTimeZones {
  timeZone: string | null
  /** False until the migration has run — nothing can be stored yet. */
  configurable: boolean
  branches: Array<{ id: string; name: string; timeZone: string | null }>
}

export const workplaceTimeZoneKeys = {
  all: () => ['workplace-time-zone', getActiveWorkspaceId() ?? ''] as const,
}

export function useWorkplaceTimeZones(enabled = true) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: workplaceTimeZoneKeys.all(),
    queryFn: async (): Promise<WorkplaceTimeZones> => {
      const { data } = await apiClient.get<WorkplaceTimeZones>('/workplace/time-zone')
      return {
        timeZone: data?.timeZone ?? null,
        configurable: data?.configurable === true,
        branches: asList<WorkplaceTimeZones['branches'][number]>(data?.branches),
      }
    },
    enabled: ready && enabled,
    staleTime: 5 * 60_000,
  })
}

export function useSetWorkspaceTimeZone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (timeZone: string) =>
      (await apiClient.put<{ timeZone: string }>('/workplace/time-zone', { timeZone })).data,
    // The zone decides what «today» is on every attendance link.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workplaceTimeZoneKeys.all() })
      queryClient.invalidateQueries({ queryKey: ['attendance-links'] })
    },
  })
}

export function useSetBranchTimeZone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { branchId: string; timeZone: string | null }) =>
      (
        await apiClient.put<{ id: string; timeZone: string | null }>(
          `/workplace/branches/${input.branchId}/time-zone`,
          { timeZone: input.timeZone },
        )
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workplaceTimeZoneKeys.all() })
      queryClient.invalidateQueries({ queryKey: ['attendance-links'] })
    },
  })
}
