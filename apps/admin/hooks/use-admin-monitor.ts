'use client'

// ============================================
// apps/admin/hooks/use-admin-monitor.ts
//
// V63 · M — reads for the operations › monitor tab and the TV wall.
//
// ⚠️ `bytesOut` is `number | null`. `null` means at least one response in the
// window carried no content-length, so the total is unknown. It is never
// rendered as zero.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

export type MonitorRange = '1h' | '24h' | '7d' | '90d'

export interface MonitorRouteItem {
  route: string
  method: string
  count: number
  totalMs?: number | null
  maxMs?: number | null
  bytes?: number | null
}

export interface MonitorInstanceItem {
  instanceId: string
  minute: string
  cpuPercent: number
  memoryPercent: number
  eventLoopP99Ms: number
  heapUsedBytes: number
  heapTotalBytes: number
  inflightRequests: number
  syncSockets: number
}

export interface MonitorOverviewItem {
  generatedAt: string
  requests: number
  errors5xx: number
  bytesOut: number | null
  bytesUnknownRows: number
  onlineUsers: number
  onlineWorkspaces: number
  instances: MonitorInstanceItem[]
  topRoutesByTime: MonitorRouteItem[]
  topRoutesByBytes: MonitorRouteItem[]
  statusClasses: Array<{ statusClass: string; count: number }>
}

export interface MonitorStatementItem {
  calls: number
  total_ms: number
  mean_ms: number
  rows: number
  query: string
}

export interface MonitorVitalsItem {
  available: boolean
  reason: string | null
  databaseSizeBytes: number | null
  connections: { active: number; idle: number; total: number; max: number } | null
  cacheHitRatio: number | null
  deadlocks: number | null
  tempBytes: number | null
  waitingLocks: number | null
  longestTransactionSeconds: number | null
  replicationLagSeconds: number | null
  statements: MonitorStatementItem[] | null
  statementsUnavailableReason: string | null
}

export interface MonitorAlertRuleItem {
  id: string
  metric: string
  comparator: '>' | '<'
  threshold: number
  durationMinutes: number
  severity: 'warning' | 'critical'
  isEnabled: boolean
}

export type MonitorAlertState = 'ok' | 'pending' | 'breaching' | 'unknown' | 'disabled'

export interface MonitorAlertEvaluationItem {
  rule: MonitorAlertRuleItem
  currentValue: number | null
  state: MonitorAlertState
  breachedForMinutes: number
}

export interface MonitorSnapshot {
  overview: MonitorOverviewItem
  vitals: MonitorVitalsItem
  alerts: MonitorAlertEvaluationItem[]
}

export interface MonitorSeriesPoint {
  bucket: string
  requests: number
  errors: number
  bytes: number | null
  avgMs: number | null
}

export interface WallTokenItem {
  id: string
  label: string
  ipCidr: string | null
  expiresAt: string
  revokedAt: string | null
  createdBy: string | null
  createdAt: string
  lastUsedAt: string | null
  state: 'active' | 'expired' | 'revoked'
}

export function useAdminMonitor() {
  return useQuery<MonitorSnapshot>({
    queryKey: ['admin', 'monitor', 'overview'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/monitor/overview')
      return res.data
    },
    // A monitor that polls itself must stay cheap; ten seconds is one page of
    // the sampler, not one query per viewer.
    refetchInterval: 10_000,
    staleTime: 5_000,
  })
}

export function useAdminMonitorSeries(range: MonitorRange) {
  return useQuery<{
    range: MonitorRange
    unit: 'minute' | 'hour'
    since: string
    points: MonitorSeriesPoint[]
  }>({
    queryKey: ['admin', 'monitor', 'series', range],
    queryFn: async () => {
      const res = await apiClient.get('/admin/monitor/series', { params: { range } })
      return res.data
    },
    staleTime: 60_000,
  })
}

export function useUpdateMonitorAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      threshold: number
      durationMinutes: number
      isEnabled: boolean
      severity: 'warning' | 'critical'
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.put(
        `/admin/monitor/alerts/${input.id}`,
        {
          threshold: input.threshold,
          durationMinutes: input.durationMinutes,
          isEnabled: input.isEnabled,
          severity: input.severity,
        },
        { headers: { 'X-Admin-Step-Up-Timestamp': input.stepUpTimestamp } },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor'] })
    },
  })
}

export function useAdminWallTokens() {
  return useQuery<{ tokens: WallTokenItem[] }>({
    queryKey: ['admin', 'monitor', 'wall-tokens'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/monitor/wall-tokens')
      return res.data
    },
    staleTime: 60 * 1000,
  })
}

export function useCreateWallToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      label: string
      expiresAt: string
      ipCidr?: string | undefined
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post(
        '/admin/monitor/wall-tokens',
        { label: input.label, expiresAt: input.expiresAt, ipCidr: input.ipCidr },
        { headers: { 'X-Admin-Step-Up-Timestamp': input.stepUpTimestamp } },
      )
      return res.data as { token: string; item: WallTokenItem }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor', 'wall-tokens'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'security-events'] })
    },
  })
}

export function useRevokeWallToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; stepUpTimestamp: string }) => {
      const res = await apiClient.delete(`/admin/monitor/wall-tokens/${input.id}`, {
        headers: { 'X-Admin-Step-Up-Timestamp': input.stepUpTimestamp },
      })
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor', 'wall-tokens'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'security-events'] })
    },
  })
}
