'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

export interface FeatureFlagItem {
  id: string
  key: string
  name: string
  description: string | null
  is_enabled: boolean
  rollout_percentage: number
  platforms: string[]
  countries: string[]
  is_beta: boolean
  created_at: string
  updated_at: string
}

export interface SystemHealthProbe {
  component: string
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'NO_PROBE'
  latencyMs: number | null
  details?: string | undefined
}

export interface BackgroundJobItem {
  id: string
  job_type: 'IMPORT' | 'EXPORT' | 'MIGRATION' | 'CLEANUP' | 'DUNNING'
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  workspace_id: string | null
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  error_message: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface AdminAnnouncementItem {
  id: string
  title: string
  message: string
  level: 'INFO' | 'WARNING' | 'CRITICAL' | 'MAINTENANCE'
  target_plans: string[]
  target_editions: string[]
  target_platforms: string[]
  target_locales: string[]
  is_active: boolean
  starts_at: string
  ends_at: string | null
  created_at: string
}

export function useAdminFeatureFlags() {
  return useQuery<{ flags: FeatureFlagItem[] }>({
    queryKey: ['admin', 'ops', 'flags'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/ops/flags')
      return res.data
    },
    staleTime: 30 * 1000,
  })
}

export function useUpsertFeatureFlag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      flag,
      stepUpTimestamp,
    }: {
      flag: Partial<FeatureFlagItem> & { key: string; name: string }
      stepUpTimestamp: string
    }) => {
      const payload = {
        key: flag.key,
        name: flag.name,
        description: flag.description ?? undefined,
        isEnabled: flag.is_enabled ?? undefined,
        rolloutPercentage: flag.rollout_percentage ?? undefined,
        platforms: flag.platforms ?? undefined,
        countries: flag.countries ?? undefined,
        isBeta: flag.is_beta ?? undefined,
      }
      const res = await apiClient.post('/admin/ops/flags', payload, {
        headers: {
          'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
        },
      })
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ops', 'flags'] })
    },
  })
}

export function useAdminSystemHealth() {
  return useQuery<{ probes: SystemHealthProbe[] }>({
    queryKey: ['admin', 'ops', 'health'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/ops/health')
      return res.data
    },
    refetchInterval: 10 * 1000,
  })
}

export function useAdminBackgroundJobs() {
  return useQuery<{ jobs: BackgroundJobItem[] }>({
    queryKey: ['admin', 'ops', 'jobs'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/ops/jobs')
      return res.data
    },
    staleTime: 10 * 1000,
  })
}

export function useRetryBackgroundJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ jobId, stepUpTimestamp }: { jobId: string; stepUpTimestamp: string }) => {
      const res = await apiClient.post(
        `/admin/ops/jobs/${jobId}/retry`,
        {},
        {
          headers: {
            'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
          },
        },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ops', 'jobs'] })
    },
  })
}

export function useAdminAnnouncements() {
  return useQuery<{ announcements: AdminAnnouncementItem[] }>({
    queryKey: ['admin', 'ops', 'announcements'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/ops/announcements')
      return res.data
    },
    staleTime: 30 * 1000,
  })
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      announcement,
      stepUpTimestamp,
    }: {
      announcement: Omit<AdminAnnouncementItem, 'id' | 'created_at'>
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post('/admin/ops/announcements', announcement, {
        headers: {
          'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
        },
      })
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ops', 'announcements'] })
    },
  })
}

export function useExportAdminCsv() {
  return useMutation({
    mutationFn: async ({
      table,
      stepUpTimestamp,
    }: {
      table: 'audit_logs' | 'billing_ledger_entries' | 'admin_security_events' | 'offline_licenses'
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post(
        '/admin/ops/export-csv',
        { table },
        {
          headers: {
            'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
          },
        },
      )
      return res.data
    },
  })
}
