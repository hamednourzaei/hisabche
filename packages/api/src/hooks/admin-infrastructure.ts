// ============================================
// packages/api/src/hooks/admin-infrastructure.ts
//
// Admin Infrastructure & Nginx Control Hooks.
// Queries and mutations for Nginx reverse proxy routing,
// edge rate limiting, cache bypass mode, and maintenance mode.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  InfrastructureSettings,
  UpdateInfrastructureSettingsInput,
} from '@hisabche/validation'

import apiClient from '../lib/client'

export const INFRASTRUCTURE_SETTINGS_QUERY_KEY = ['admin', 'infrastructure', 'settings'] as const

export function useInfrastructureSettings() {
  return useQuery<InfrastructureSettings>({
    queryKey: INFRASTRUCTURE_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<InfrastructureSettings>(
        '/api/admin/infrastructure/settings',
      )
      return response.data
    },
    staleTime: 30_000,
  })
}

export function useUpdateInfrastructureSettings() {
  const queryClient = useQueryClient()

  return useMutation<InfrastructureSettings, Error, UpdateInfrastructureSettingsInput>({
    mutationFn: async (patch: UpdateInfrastructureSettingsInput) => {
      const response = await apiClient.put<InfrastructureSettings>(
        '/api/admin/infrastructure/settings',
        patch,
      )
      return response.data
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(INFRASTRUCTURE_SETTINGS_QUERY_KEY, updated)
      void queryClient.invalidateQueries({ queryKey: INFRASTRUCTURE_SETTINGS_QUERY_KEY })
    },
  })
}
