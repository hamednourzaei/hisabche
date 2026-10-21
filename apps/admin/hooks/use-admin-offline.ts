'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

export interface OfflineLicenceRecord {
  id: string
  license_id: string
  workspace_id: string
  status: 'active' | 'revoked' | 'banned'
  plan: string
  issued_at: string
  expires_at: string
  banned_at: string | null
  ban_reason: string | null
  created_at: string
}

export interface OfflineDeviceRecord {
  id: string
  device_id: string
  workspace_id: string
  device_seat: 'computer' | 'mobile'
  label: string | null
  is_active: boolean
  last_seen_at: string | null
  created_at: string
}

export interface OfflineLogRecord {
  id: string
  license_id: string
  workspace_id: string
  event: string
  device_seat: string | null
  device_id: string | null
  ip_address: string | null
  reason: string | null
  evidence: Record<string, unknown> | null
  created_at: string
}

export interface OfflineReviewRecord {
  id: string
  license_id: string
  workspace_id: string
  signal_type: string
  details: Record<string, unknown>
  status: 'pending' | 'banned' | 'dismissed'
  created_at: string
}

export function useAdminOfflineLicences(workspaceId?: string) {
  return useQuery<{ licences: OfflineLicenceRecord[] }>({
    queryKey: ['admin', 'offline', 'licences', workspaceId],
    queryFn: async () => {
      const res = await apiClient.get('/admin/offline/licences', { params: { workspaceId } })
      return res.data
    },
    staleTime: 15 * 1000,
  })
}

export function useRevokeOfflineLicence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      licenseId,
      workspaceId,
      stepUpTimestamp,
    }: {
      licenseId: string
      workspaceId: string
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post(
        `/admin/offline/licences/${licenseId}/revoke`,
        { workspaceId },
        {
          headers: {
            'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
          },
        },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offline', 'licences'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offline', 'fleet-health'] })
    },
  })
}

export function useAdminOfflineDevices(workspaceId?: string) {
  return useQuery<{ devices: OfflineDeviceRecord[] }>({
    queryKey: ['admin', 'offline', 'devices', workspaceId],
    queryFn: async () => {
      const res = await apiClient.get('/admin/offline/devices', { params: { workspaceId } })
      return res.data
    },
    staleTime: 15 * 1000,
  })
}

export function useReleaseOfflineDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      deviceId,
      workspaceId,
      stepUpTimestamp,
    }: {
      deviceId: string
      workspaceId: string
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post(
        `/admin/offline/devices/${deviceId}/release`,
        { workspaceId },
        {
          headers: {
            'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
          },
        },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offline', 'devices'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offline', 'fleet-health'] })
    },
  })
}

export function useAdminOfflineLogs(
  filters: {
    workspaceId?: string
    licenseId?: string
    event?: string
    fromDate?: string
    toDate?: string
  } = {},
) {
  return useQuery<{ logs: OfflineLogRecord[] }>({
    queryKey: ['admin', 'offline', 'logs', filters],
    queryFn: async () => {
      const res = await apiClient.get('/admin/offline/logs', { params: filters })
      return res.data
    },
    staleTime: 10 * 1000,
  })
}

export function useAdminOfflineBans() {
  return useQuery<{ bans: OfflineLicenceRecord[] }>({
    queryKey: ['admin', 'offline', 'bans'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/offline/bans')
      return res.data
    },
    staleTime: 15 * 1000,
  })
}

export function useLiftOfflineBan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      licenseId,
      workspaceId,
      reason,
      stepUpTimestamp,
    }: {
      licenseId: string
      workspaceId: string
      reason: string
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post(
        `/admin/offline/bans/${licenseId}/lift`,
        { workspaceId, reason },
        {
          headers: {
            'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
          },
        },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offline', 'bans'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offline', 'licences'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offline', 'fleet-health'] })
    },
  })
}

export function useAdminOfflineReviews(workspaceId?: string) {
  return useQuery<{ reviews: OfflineReviewRecord[] }>({
    queryKey: ['admin', 'offline', 'reviews', workspaceId],
    queryFn: async () => {
      const res = await apiClient.get('/admin/offline/reviews', { params: { workspaceId } })
      return res.data
    },
    staleTime: 15 * 1000,
  })
}

export function useDecideOfflineReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      reviewId,
      verdict,
      reason,
      workspaceId,
      licenseId,
      stepUpTimestamp,
    }: {
      reviewId: string
      verdict: 'ban' | 'not_abuse'
      reason: string
      workspaceId: string
      licenseId: string
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post(
        `/admin/offline/reviews/${reviewId}/decide`,
        { verdict, reason, workspaceId, licenseId },
        {
          headers: {
            'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
          },
        },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offline', 'reviews'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offline', 'bans'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offline', 'licences'] })
    },
  })
}

export function useAdminOfflineFleetHealth() {
  return useQuery<{
    health: {
      activeLicences: number
      bannedLicences: number
      activeDevices: number
      keyId: string
      signingConfigured: boolean
    }
  }>({
    queryKey: ['admin', 'offline', 'fleet-health'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/offline/fleet-health')
      return res.data
    },
    staleTime: 30 * 1000,
  })
}

/** Issue a licence for one device. The code it returns is shown once. */
export function useIssueOfflineLicence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      deviceId,
      label,
      periodDays,
      stepUpTimestamp,
    }: {
      deviceId: string
      label?: string | undefined
      periodDays: number
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post<{ code: string; expiresAt: string }>(
        '/admin/offline/licences',
        { deviceId, periodDays, ...(label ? { label } : {}) },
        { headers: { 'X-Admin-Step-Up-Timestamp': stepUpTimestamp } },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offline', 'licences'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offline', 'devices'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'offline', 'fleet-health'] })
    },
  })
}
