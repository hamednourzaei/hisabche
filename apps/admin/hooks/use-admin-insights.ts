'use client'

// ============================================
// apps/admin/hooks/use-admin-insights.ts
//
// V63 — hooks for the admin items that were ⛔ in the 113 table. One hook per
// route in `backend/src/routes/admin-insights.routes.ts`; the types mirror
// `admin-insights.service.ts` (keep them in step).
//
// `null` in these shapes always means «not known», never zero — the screens
// show «—» and say why.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

export type InsightStatus = 'ok' | 'not_configured'

// ─── #49 ───────────────────────────────────────────────────────────────

export interface FailedLoginBucketItem {
  key: string
  attempts: number
  lastAt: string
  spread: number
  flagged: boolean
}

export interface FailedLoginReportItem {
  status: InsightStatus
  windowHours: number
  total: number | null
  truncated: boolean
  summary: {
    total: number
    byIp: FailedLoginBucketItem[]
    byAccount: FailedLoginBucketItem[]
    flaggedIps: number
    flaggedAccounts: number
  } | null
}

export function useAdminFailedLogins(hours: number) {
  return useQuery<FailedLoginReportItem>({
    queryKey: ['admin', 'insights', 'failed-logins', hours],
    queryFn: async () =>
      (await apiClient.get('/admin/security/failed-logins', { params: { hours } })).data,
    staleTime: 30 * 1000,
  })
}

// ─── #58 ───────────────────────────────────────────────────────────────

export type CertificateStateItem = 'ok' | 'warning' | 'critical' | 'expired' | 'unreachable'

export interface CertificateReportItem {
  status: InsightStatus
  checkedAt: string
  hosts: Array<{
    host: string
    state: CertificateStateItem
    daysLeft: number | null
    validTo: string | null
    issuer: string | null
    error: string | null
  }>
}

export function useAdminCertificates() {
  return useQuery<CertificateReportItem>({
    queryKey: ['admin', 'insights', 'certificates'],
    queryFn: async () => (await apiClient.get('/admin/security/certificates')).data,
    staleTime: 10 * 60 * 1000,
  })
}

export function useRecheckCertificates() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<CertificateReportItem> =>
      (await apiClient.get('/admin/security/certificates', { params: { refresh: '1' } })).data,
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'insights', 'certificates'], data)
    },
  })
}

// ─── #68 ───────────────────────────────────────────────────────────────

export interface MaintenanceStateItem {
  enabled: boolean
  reason: string | null
  changedAt: string | null
  readable: boolean
  readAt: string | null
}

export function useAdminMaintenance() {
  return useQuery<MaintenanceStateItem>({
    queryKey: ['admin', 'insights', 'maintenance'],
    queryFn: async () => (await apiClient.get('/admin/ops/maintenance')).data,
    staleTime: 10 * 1000,
  })
}

export function useSetMaintenance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      enabled,
      reason,
      stepUpTimestamp,
    }: {
      enabled: boolean
      reason: string
      stepUpTimestamp: string
    }): Promise<MaintenanceStateItem> =>
      (
        await apiClient.put(
          '/admin/ops/maintenance',
          { enabled, reason },
          { headers: { 'X-Admin-Step-Up-Timestamp': stepUpTimestamp } },
        )
      ).data,
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'insights', 'maintenance'], data)
    },
  })
}

// ─── #69 ───────────────────────────────────────────────────────────────

export interface MigrationStatusItem {
  file: string
  verify: string
  probe: string | null
  state: 'applied' | 'not_applied' | 'unknown'
}

export function useAdminMigrationStatus() {
  return useQuery<{ migrations: MigrationStatusItem[] }>({
    queryKey: ['admin', 'insights', 'migrations'],
    queryFn: async () => (await apiClient.get('/admin/ops/migrations')).data,
    staleTime: 60 * 1000,
  })
}

// ─── #79 ───────────────────────────────────────────────────────────────

export interface EmailDeliveryReportItem {
  status: InsightStatus
  byStatus: { pending: number; sending: number; sent: number; failed: number } | null
  sentLast24h: number | null
  oldestPendingAt: string | null
  recentFailures: Array<{
    id: string
    to: string
    subject: string
    attempts: number
    lastError: string | null
    createdAt: string
  }>
}

export function useAdminEmailDelivery() {
  return useQuery<EmailDeliveryReportItem>({
    queryKey: ['admin', 'insights', 'email-delivery'],
    queryFn: async () => (await apiClient.get('/admin/ops/email-delivery')).data,
    staleTime: 30 * 1000,
  })
}

// ─── #10 / #12 ─────────────────────────────────────────────────────────

export interface GatewayAnalyticsItem {
  status: InsightStatus
  windowDays: number
  stripe: {
    succeeded: number
    failed: number
    ratePercent: number | null
    status: 'ok' | 'no_events'
  } | null
  events: Array<{ id: string; type: string; processedAt: string | null }>
}

export function useAdminGatewayAnalytics(days: number) {
  return useQuery<GatewayAnalyticsItem>({
    queryKey: ['admin', 'insights', 'gateway-analytics', days],
    queryFn: async () =>
      (await apiClient.get('/admin/gateways/analytics', { params: { days } })).data,
    staleTime: 60 * 1000,
  })
}

// ─── #84 ───────────────────────────────────────────────────────────────

export interface UsageMetricItem {
  value: number | null
  status: 'ok' | 'not_configured' | 'not_measured'
}

export interface WorkspaceUsageItem {
  workspaceId: string
  windowDays: number
  members: UsageMetricItem
  activeDevices: UsageMetricItem
  invoices: UsageMetricItem
  aiQueries: UsageMetricItem
  apiRequests: UsageMetricItem
  activeApiKeys: UsageMetricItem
  storageBytes: UsageMetricItem
}

export function useAdminWorkspaceUsage(workspaceId: string | null) {
  return useQuery<WorkspaceUsageItem>({
    queryKey: ['admin', 'insights', 'workspace-usage', workspaceId],
    queryFn: async () => (await apiClient.get(`/admin/workspaces/${workspaceId}/usage`)).data,
    enabled: Boolean(workspaceId),
    staleTime: 60 * 1000,
  })
}

// ─── #89 ───────────────────────────────────────────────────────────────

export interface UserActivityItem {
  id: string
  workspaceId: string | null
  action: string
  entityType: string
  entityId: string | null
  ipAddress: string | null
  createdAt: string
}

export function useAdminUserActivity(userId: string | null, before: string | null) {
  return useQuery<{ items: UserActivityItem[]; nextBefore: string | null }>({
    queryKey: ['admin', 'insights', 'user-activity', userId, before],
    queryFn: async () =>
      (
        await apiClient.get(`/admin/users/${userId}/activity`, {
          params: before ? { before } : {},
        })
      ).data,
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
  })
}

// ─── #94 ───────────────────────────────────────────────────────────────

export interface SignupFunnelItem {
  windowDays: number
  truncated: boolean
  cohortTotal: number
  steps: Array<{
    id: 'signed_up' | 'created_business' | 'paid'
    count: number
    ofFirstPercent: number | null
    ofPreviousPercent: number | null
  }>
}

export function useAdminSignupFunnel(days: number) {
  return useQuery<SignupFunnelItem>({
    queryKey: ['admin', 'insights', 'signup-funnel', days],
    queryFn: async () =>
      (await apiClient.get('/admin/reports/signup-funnel', { params: { days } })).data,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── #103 ──────────────────────────────────────────────────────────────

export interface RevenueForecastItem {
  status: InsightStatus
  currency: 'IRR'
  history: Array<{ month: string; netMinor: number }>
  forecast: {
    status: 'ok' | 'insufficient_data'
    basisMonths: number
    averageMinor: number | null
    next: Array<{ month: string; projectedMinor: number | null }>
  } | null
}

export function useAdminRevenueForecast() {
  return useQuery<RevenueForecastItem>({
    queryKey: ['admin', 'insights', 'revenue-forecast'],
    queryFn: async () => (await apiClient.get('/admin/reports/revenue-forecast')).data,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── #113 ──────────────────────────────────────────────────────────────

export interface ApiUsageBucketItem {
  key: string
  requests: number
  clientErrors: number
  serverErrors: number
  p95Ms: number
}

export interface ApiUsageReportItem {
  status: InsightStatus
  windowDays: number
  total: number | null
  truncated: boolean
  summary: {
    total: number
    byKey: Array<ApiUsageBucketItem & { workspaceId: string }>
    byRoute: ApiUsageBucketItem[]
  } | null
  keyNames: Record<string, { name: string; prefix: string }>
}

export function useAdminApiUsage(days: number) {
  return useQuery<ApiUsageReportItem>({
    queryKey: ['admin', 'insights', 'api-usage', days],
    queryFn: async () =>
      (await apiClient.get('/admin/developers/api-usage', { params: { days } })).data,
    staleTime: 60 * 1000,
  })
}
