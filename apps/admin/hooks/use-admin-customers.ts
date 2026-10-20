'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

export interface Workspace360Data {
  workspace: {
    id: string
    name: string
    created_at: string
    is_active?: boolean
  }
  members: Array<{
    id: string
    user_id: string
    role: string
    created_at: string
    email?: string | null
  }>
  subscriptions: Array<Record<string, unknown>>
  devices: Array<Record<string, unknown>>
  licences: Array<Record<string, unknown>>
  notes: Array<{
    id: string
    admin_email: string
    note: string
    tags: string[]
    created_at: string
  }>
  supportSessions: Array<{
    id: string
    admin_email: string
    reason: string
    expires_at: string
    is_revoked: boolean
    created_at: string
  }>
  dataRequests: Array<{
    id: string
    request_type: string
    status: string
    sla_due_at: string
    legal_hold: boolean
    created_at: string
  }>
}

export interface TrialAbuseSignalItem {
  id: string
  signal_type: 'SAME_PHONE' | 'SAME_DEVICE' | 'SAME_IP_RANGE' | 'SAME_CARD_HASH'
  fingerprint: string
  workspace_count: number
  workspace_ids: string[]
  first_seen_at: string
  last_seen_at: string
  details: Record<string, unknown>
}

export function useWorkspace360(workspaceId: string | null) {
  return useQuery<Workspace360Data>({
    queryKey: ['admin', 'workspaces', workspaceId, '360'],
    queryFn: async () => {
      if (!workspaceId) throw new Error('workspaceId is required')
      const res = await apiClient.get(`/admin/workspaces/${workspaceId}/360`)
      return res.data
    },
    enabled: Boolean(workspaceId),
    staleTime: 30 * 1000,
  })
}

export function useManageUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      action,
      stepUpTimestamp,
    }: {
      userId: string
      action: 'suspend' | 'reactivate' | 'revoke_sessions' | 'reset_mfa' | 'force_signout'
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post(
        `/admin/users/${userId}/action`,
        { action },
        {
          headers: {
            'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
          },
        },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useCreateSupportSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      workspaceId,
      reason,
      durationMinutes,
      stepUpTimestamp,
    }: {
      workspaceId: string
      reason: string
      durationMinutes?: number
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post(
        `/admin/workspaces/${workspaceId}/support-sessions`,
        { reason, durationMinutes },
        {
          headers: {
            'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
          },
        },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] })
    },
  })
}

export function useAddWorkspaceNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      workspaceId,
      note,
      tags,
    }: {
      workspaceId: string
      note: string
      tags?: string[]
    }) => {
      const res = await apiClient.post(`/admin/workspaces/${workspaceId}/notes`, { note, tags })
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] })
    },
  })
}

export function useTrialAbuseSignals() {
  return useQuery<{ signals: TrialAbuseSignalItem[] }>({
    queryKey: ['admin', 'trial-abuse'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/trial-abuse')
      return res.data
    },
    staleTime: 60 * 1000,
  })
}

export function useAdminDataRequests(workspaceId?: string) {
  return useQuery<{ requests: Workspace360Data['dataRequests'] }>({
    queryKey: ['admin', 'data-requests', workspaceId],
    queryFn: async () => {
      const res = await apiClient.get('/admin/data-requests', { params: { workspaceId } })
      return res.data
    },
    staleTime: 30 * 1000,
  })
}
