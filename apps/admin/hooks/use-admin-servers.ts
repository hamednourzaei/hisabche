'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

/**
 * The servers page.
 *
 *   GET /admin/instances        { shared, instances } — heartbeats from Redis
 *   GET /admin/instances/scale  { configured, count, max } — Render's setting
 *   PUT /admin/instances/scale  { count }
 */
export interface ServerInstance {
  id: string
  cpuPercent: number
  memoryPercent: number
  /** Always null: Render web services have no GPU. */
  gpuPercent: null
  uptimeSeconds: number
  inflightRequests: number
  commit: string | null
  at: string
  isSelf?: boolean
}

export interface InstanceList {
  shared: boolean
  instances: ServerInstance[]
}

export interface ScaleState {
  configured: boolean
  count: number | null
  max: number
}

const keys = {
  instances: ['admin', 'servers', 'instances'] as const,
  scale: ['admin', 'servers', 'scale'] as const,
}

/** Refreshed every 3 s — the heartbeats themselves arrive every 5 s. */
export function useAdminInstances() {
  return useQuery({
    queryKey: keys.instances,
    queryFn: async ({ signal }): Promise<InstanceList> => {
      const { data } = await apiClient.get('/admin/instances', { signal })
      return data as InstanceList
    },
    refetchInterval: 3000,
  })
}

export function useAdminScale() {
  return useQuery({
    queryKey: keys.scale,
    queryFn: async ({ signal }): Promise<ScaleState> => {
      const { data } = await apiClient.get('/admin/instances/scale', { signal })
      return data as ScaleState
    },
  })
}

export function useSetAdminScale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (count: number) => {
      const { data } = await apiClient.put('/admin/instances/scale', { count })
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.scale })
    },
  })
}
