'use client'

// ============================================
// apps/admin/hooks/use-admin-monitor.ts
//
// V63 · M — reads for the operations › monitor tab and the TV wall.
// Unified Core Observability (21 Nov 2026) — core reads + the REAL stream
// consumer. While the stream is connected, polling is paused (one sampler
// serves everyone); on fallback the controlled 10 s polling resumes and the
// UI says so. History refetches on a minute cadence beside the live totals.
//
// ⚠️ `bytesOut` is `number | null`. `null` means at least one response in the
// window carried no content-length, so the total is unknown. It is never
// rendered as zero.
// ============================================

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, getToken, tokenReady } from '@hisabche/api'

import { MonitorStreamClient, type MonitorStreamStatus } from '../lib/monitor-stream'

export type MonitorRange = '1h' | '24h' | '7d' | '30d' | '90d'

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
  coreId?: string | null
  comparator: '>' | '<'
  threshold: number
  durationMinutes: number
  severity: 'warning' | 'critical'
  isEnabled: boolean
  cooldownMinutes?: number
}

export type MonitorAlertState = 'ok' | 'pending' | 'breaching' | 'unknown' | 'disabled'

export interface MonitorAlertEvaluationItem {
  rule: MonitorAlertRuleItem
  /** The concrete core this evaluation is about ('' for infrastructure). */
  coreId: string
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

// ─── Unified core observability types (mirror the backend contract) ─────────

export type CoreStatus = 'healthy' | 'warning' | 'critical' | 'unknown'

export interface PercentileEstimate {
  value: number
  /** True in the open-ended bucket: render «≥ value», never an exact claim. */
  atLeast: boolean
}

export interface PressureComponent {
  key: 'latency' | 'errors' | 'queue' | 'retryTimeout' | 'dependencyWait'
  value: number | null
  weight: number
  note: string | null
}

export interface CorePressureItem {
  id: string
  group: string
  owner: string
  slo: { p95TargetMs: number; errorBudgetPercent: number; queueCapacity?: number | undefined }
  status: CoreStatus
  pressure: number | null
  reason: string | null
  coverage: number
  components: PressureComponent[]
  operations: number
  callsPerMin: number | null
  successRate: number | null
  errorRate: number | null
  p50: PercentileEstimate | null
  p95: PercentileEstimate | null
  p99: PercentileEstimate | null
  maxMs: number | null
  inflightMax: number
  concurrencyMax: number
  queueDepth: number | null
  processingCount: number | null
  stuckCount: number | null
  retryCount: number | null
  timeouts: number
  dependencyWaitAvgMs: number | null
  lastSample: string | null
  trend: number | null
}

export interface CoreInstanceItem {
  instanceId: string
  processRole: string
  lastSeen: string
  online: boolean
  cpuPercent: number
  memoryPercent: number
  eventLoopP99Ms: number
  heapUsedBytes: number
  heapTotalBytes: number
  rssBytes: number | null
  inflightRequests: number
  syncSockets: number
}

export interface DbHistoryItem {
  minute: string
  connectionsActive: number | null
  connectionsIdle: number | null
  connectionsTotal: number | null
  connectionsMax: number | null
  waitingLocks: number | null
  cacheHitRatio: number | null
  longestTransactionSeconds: number | null
  databaseSizeBytes: number | null
}

export interface CoreSnapshot {
  generatedAt: string
  windowMinutes: number
  since: string
  cores: CorePressureItem[]
  counts: { healthy: number; warning: number; critical: number; unknown: number }
  instances: CoreInstanceItem[]
  db: DbHistoryItem | null
}

export interface CoreSeriesPoint {
  bucket: string
  operations: number
  errors: number
  clientErrors: number
  errorPercent: number | null
  avgMs: number | null
  p50: PercentileEstimate | null
  p95: PercentileEstimate | null
  p99: PercentileEstimate | null
  timeouts: number
  inflightMax: number
  queueDepth: number | null
  dependencyWaitAvgMs: number | null
}

export interface AlertEventItem {
  id: string
  ruleId: string
  coreId: string
  metric: string
  severity: 'warning' | 'critical'
  value: number | null
  threshold: number
  evidence: Record<string, unknown>
  raisedAt: string
  resolvedAt: string | null
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

/**
 * The live overview. `paused` is true while the stream is connected: the
 * stream already pushes these numbers, so polling would be duplicate load.
 * On fallback/disconnect the controlled 10 s polling resumes.
 */
export function useAdminMonitor(options: { paused?: boolean } = {}) {
  return useQuery<MonitorSnapshot>({
    queryKey: ['admin', 'monitor', 'overview'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/monitor/overview')
      return res.data
    },
    refetchInterval: options.paused ? false : 10_000,
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
    // F-05: history must age with the live totals beside it — one refetch a
    // minute, not a stale chart next to a live number.
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/** Every registered core — measured or UNKNOWN. Paused while streaming. */
export function useAdminMonitorCores(options: { paused?: boolean } = {}) {
  return useQuery<CoreSnapshot>({
    queryKey: ['admin', 'monitor', 'cores'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/monitor/cores')
      return res.data
    },
    refetchInterval: options.paused ? false : 10_000,
    staleTime: 5_000,
  })
}

export function useAdminCoreSeries(coreId: string | null, range: MonitorRange) {
  return useQuery<{
    coreId: string
    range: MonitorRange
    unit: 'minute' | 'hour'
    since: string
    points: CoreSeriesPoint[]
  }>({
    queryKey: ['admin', 'monitor', 'core-series', coreId, range],
    queryFn: async () => {
      const res = await apiClient.get(`/admin/monitor/cores/${coreId}/series`, {
        params: { range },
      })
      return res.data
    },
    enabled: coreId !== null,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useAdminAlertEvents() {
  return useQuery<{ events: AlertEventItem[] }>({
    queryKey: ['admin', 'monitor', 'alert-events'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/monitor/alert-events')
      return res.data
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/**
 * The ONE stream subscription of the monitor tab. Events land directly in the
 * React Query cache (no parallel state); alert transitions invalidate the
 * affected queries. Returns the connection status for the UI badge and the
 * `paused` flag that silences polling while connected.
 */
export function useAdminMonitorStream(): MonitorStreamStatus & { paused: boolean } {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<MonitorStreamStatus>({
    state: 'connecting',
    lastEventAt: null,
    attempt: 0,
  })
  const clientRef = useRef<MonitorStreamClient | null>(null)

  useEffect(() => {
    const base = String(apiClient.defaults.baseURL ?? '').replace(/\/$/, '')
    const client = new MonitorStreamClient({
      url: `${base}/admin/monitor/stream`,
      getToken,
      onStatus: setStatus,
      onEvent: ({ event, data }) => {
        if (event === 'snapshot') {
          queryClient.setQueryData(['admin', 'monitor', 'overview'], {
            overview: data.overview,
            vitals: data.vitals,
            alerts: data.alerts,
          })
          queryClient.setQueryData(['admin', 'monitor', 'cores'], {
            generatedAt: data.at,
            windowMinutes: 5,
            since: data.at,
            cores: data.cores,
            counts: data.counts,
            instances: data.instances,
            db: data.db,
          })
          return
        }
        if (
          event === 'core.metrics' ||
          event === 'instance.metrics' ||
          event === 'database.metrics'
        ) {
          queryClient.setQueryData<CoreSnapshot | undefined>(
            ['admin', 'monitor', 'cores'],
            (previous) => {
              if (!previous) return previous
              if (event === 'core.metrics') {
                return {
                  ...previous,
                  generatedAt: String(data.at ?? previous.generatedAt),
                  cores: (data.cores as CorePressureItem[]) ?? previous.cores,
                  counts: (data.counts as CoreSnapshot['counts']) ?? previous.counts,
                }
              }
              if (event === 'instance.metrics') {
                return {
                  ...previous,
                  instances: (data.instances as CoreInstanceItem[]) ?? previous.instances,
                }
              }
              return { ...previous, db: (data.db as DbHistoryItem | null) ?? previous.db }
            },
          )
          if (event === 'database.metrics' && data.vitals) {
            queryClient.setQueryData<MonitorSnapshot | undefined>(
              ['admin', 'monitor', 'overview'],
              (previous) =>
                previous ? { ...previous, vitals: data.vitals as MonitorVitalsItem } : previous,
            )
          }
          return
        }
        if (event === 'alert.raised' || event === 'alert.resolved') {
          void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor', 'alert-events'] })
          void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor', 'overview'] })
          return
        }
        if (event === 'stream.error') {
          void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor'] })
        }
        // heartbeat: the client's watchdog already tracks freshness.
      },
    })
    clientRef.current = client
    // The token provider hydrates asynchronously; connecting before it is
    // ready would burn a 401 attempt on every page load (the token-ready trap).
    let cancelled = false
    void tokenReady.then(() => {
      if (!cancelled) client.start()
    })
    return () => {
      cancelled = true
      client.stop()
      clientRef.current = null
    }
  }, [queryClient])

  return { ...status, paused: status.state === 'connected' }
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
