'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

export interface RolePermissionItem {
  role: string
  permissions: readonly string[]
}

export interface AdminAccountItem {
  id: string
  userId: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminSessionItem {
  id: string
  userId: string
  adminEmail: string
  ip: string | null
  userAgent: string | null
  createdAt: string
  lastSignInAt: string | null
}

export interface AdminSecurityEventItem {
  id: string
  eventType: string
  adminEmail: string | null
  ipAddress: string | null
  userAgent: string | null
  details: Record<string, unknown>
  createdAt: string
}

export interface AdminAuditLogItem {
  id: string
  workspace_id: string | null
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  ip_address: string | null
  reason: string | null
  request_id: string | null
  correlation_id: string | null
  created_at: string
}

export function useAdminRoles() {
  return useQuery<{ roles: RolePermissionItem[]; allPermissions: readonly string[] }>({
    queryKey: ['admin', 'roles'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/roles')
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminAccounts() {
  return useQuery<{ accounts: AdminAccountItem[] }>({
    queryKey: ['admin', 'accounts'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/accounts')
      return res.data
    },
    staleTime: 60 * 1000,
  })
}

export function useAdminSessions() {
  return useQuery<{ sessions: AdminSessionItem[] }>({
    queryKey: ['admin', 'sessions'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/sessions')
      return res.data
    },
    staleTime: 30 * 1000,
  })
}

export function useRevokeAdminSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      stepUpTimestamp,
    }: {
      userId: string
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post(
        `/admin/sessions/${userId}/revoke`,
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
      void queryClient.invalidateQueries({ queryKey: ['admin', 'sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'security-events'] })
    },
  })
}

export function useAdminSecurityEvents(
  filters: {
    eventType?: string | undefined
    adminEmail?: string | undefined
    limit?: number | undefined
    offset?: number | undefined
  } = {},
) {
  return useQuery<{ events: AdminSecurityEventItem[]; total: number }>({
    queryKey: ['admin', 'security-events', filters],
    queryFn: async () => {
      const res = await apiClient.get('/admin/security-events', { params: filters })
      return res.data
    },
    staleTime: 15 * 1000,
  })
}

export function useAdminAuditLogs(
  filters: {
    entityType?: string | undefined
    action?: string | undefined
    search?: string | undefined
    limit?: number | undefined
    offset?: number | undefined
  } = {},
) {
  return useQuery<{ logs: AdminAuditLogItem[]; total: number }>({
    queryKey: ['admin', 'audit-logs', filters],
    queryFn: async () => {
      const res = await apiClient.get('/admin/audit-logs', { params: filters })
      return res.data
    },
    staleTime: 15 * 1000,
  })
}

export function useAdminStepUp() {
  return useMutation({
    // The code is verified by Supabase in the dialog (mfa.challengeAndVerify);
    // the server then reads that check from the refreshed token. No code travels here.
    mutationFn: async () => {
      const res = await apiClient.post('/admin/security/step-up', {})
      return res.data as { stepUpTimestamp: string; expiresInSeconds: number }
    },
  })
}
