// ============================================
// packages/api/src/hooks/dashboard-kpis.ts
//
// The KPIs the signed-in person added to their dashboard in this workspace
// (user-dashboard-kpis-01). Kept on the server — the backend is only a step,
// the database holds the choice — so it follows the person to every device.
// `configured: false` until the migration runs: the «+» card then says so.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DashboardKpiId } from '@hisabche/validation'

import { apiClient } from '../lib/client'
import { useAuthReady } from './useAuthReady'

export interface DashboardKpisRecord {
  configured: boolean
  kpis: DashboardKpiId[]
}

export const dashboardKpiKeys = {
  all: ['dashboard-kpis'] as const,
}

export function useDashboardKpis() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: dashboardKpiKeys.all,
    queryFn: async (): Promise<DashboardKpisRecord> => {
      const { data } = await apiClient.get<Partial<DashboardKpisRecord>>('/me/dashboard-kpis')
      return {
        configured: data?.configured === true,
        kpis: Array.isArray(data?.kpis) ? data.kpis : [],
      }
    },
    enabled: authReady,
  })
}

export function useSaveDashboardKpis() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (kpis: DashboardKpiId[]) => {
      const { data } = await apiClient.put<DashboardKpisRecord>('/me/dashboard-kpis', { kpis })
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData<DashboardKpisRecord>(dashboardKpiKeys.all, {
        configured: true,
        kpis: Array.isArray(data?.kpis) ? data.kpis : [],
      })
    },
  })
}
