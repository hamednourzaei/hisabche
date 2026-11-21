// ============================================
// backend/src/services/monitoring/monitoring.service.ts
//
// V63 · M-3/M-5/M-7 — the reads the monitor tab and the wall make.
//
// ⚠️ EVERY NUMBER HERE IS MEASURED OR NULL.
//   - totals come from SUMs inside Postgres (`admin_monitor_overview`), not from
//     a capped list;
//   - bandwidth is `null` when any row in the window had no content-length;
//   - a database limit that is not known is `NOT_CONFIGURED`, never a default;
//   - replication lag is `null` when there is no replica.
//
// Alerts are evaluated on a timer (`runMonitorAlertsTick`) and, without email
// side effects, when the screen asks. The state of a breach is kept in the
// shared cache so «for 5 minutes» means five real ticks.
// ============================================

import { supabase } from '../../db'
import { breakGlassEmail } from '../../middleware/platform-admin.middleware'
import { cacheService } from '../cache.service'
import { AdminSecurityService } from '../admin/admin-security.service'
import { enqueueEmail } from '../email-outbox'
import { CORES, coreById, type CoreDefinition } from './core-registry'
import {
  computePressure,
  estimatePercentile,
  type PercentileEstimate,
  type PressureComponent,
} from './core-pressure.domain'
import type { CoreStatus } from './core-registry'

export type MonitorRange = '1h' | '24h' | '7d' | '30d' | '90d'

export interface RangeWindow {
  since: Date
  unit: 'minute' | 'hour'
}

export function rangeWindow(range: MonitorRange, now: Date = new Date()): RangeWindow {
  const ms =
    range === '1h'
      ? 60 * 60 * 1000
      : range === '24h'
        ? 24 * 60 * 60 * 1000
        : range === '7d'
          ? 7 * 24 * 60 * 60 * 1000
          : range === '30d'
            ? 30 * 24 * 60 * 60 * 1000
            : 90 * 24 * 60 * 60 * 1000
  return {
    since: new Date(now.getTime() - ms),
    // A minute-resolution 24 h chart is 1 440 points drawn at 2 px each. The
    // hourly rollup is the same shape with a readable line.
    unit: range === '1h' ? 'minute' : 'hour',
  }
}

export interface MonitorRouteRow {
  route: string
  method: string
  count: number
  totalMs?: number | null
  maxMs?: number | null
  bytes?: number | null
}

export interface MonitorInstanceRow {
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

export interface MonitorOverview {
  generatedAt: string
  requests: number
  errors5xx: number
  bytesOut: number | null
  bytesUnknownRows: number
  onlineUsers: number
  onlineWorkspaces: number
  instances: MonitorInstanceRow[]
  topRoutesByTime: MonitorRouteRow[]
  topRoutesByBytes: MonitorRouteRow[]
  statusClasses: Array<{ statusClass: string; count: number }>
}

export interface MonitorSeriesPoint {
  bucket: string
  requests: number
  errors: number
  bytes: number | null
  avgMs: number | null
}

export interface DbVitals {
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
  statements: MonitorStatementRow[] | null
  statementsUnavailableReason: string | null
}

export interface MonitorStatementRow {
  calls: number
  total_ms: number
  mean_ms: number
  rows: number
  query: string
}

function recordOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function numberOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function intOf(value: unknown, fallback = 0): number {
  return Math.round(numberOf(value) ?? fallback)
}

function toInstanceRow(value: unknown): MonitorInstanceRow {
  const row = recordOf(value)
  return {
    instanceId: String(row.instance_id ?? ''),
    minute: String(row.minute ?? ''),
    cpuPercent: numberOf(row.cpu_percent) ?? 0,
    memoryPercent: numberOf(row.memory_percent) ?? 0,
    eventLoopP99Ms: numberOf(row.event_loop_p99_ms) ?? 0,
    heapUsedBytes: intOf(row.heap_used_bytes),
    heapTotalBytes: intOf(row.heap_total_bytes),
    inflightRequests: intOf(row.inflight_requests),
    syncSockets: intOf(row.sync_sockets),
  }
}

function toRouteRow(value: unknown, kind: 'time' | 'bytes'): MonitorRouteRow {
  const row = recordOf(value)
  return {
    route: String(row.route ?? '(unmatched)'),
    method: String(row.method ?? ''),
    count: intOf(row.count),
    ...(kind === 'time'
      ? { totalMs: numberOf(row.total_ms), maxMs: numberOf(row.max_ms) }
      : { bytes: numberOf(row.bytes) }),
  }
}

function toOverview(value: unknown): MonitorOverview {
  const row = recordOf(value)
  const instances = Array.isArray(row.instances) ? row.instances : []
  const byTime = Array.isArray(row.topRoutesByTime) ? row.topRoutesByTime : []
  const byBytes = Array.isArray(row.topRoutesByBytes) ? row.topRoutesByBytes : []
  const statuses = Array.isArray(row.statusClasses) ? row.statusClasses : []
  return {
    generatedAt: new Date().toISOString(),
    requests: intOf(row.requests),
    errors5xx: intOf(row.errors5xx),
    bytesOut: numberOf(row.bytesOut),
    bytesUnknownRows: intOf(row.bytesUnknownRows),
    onlineUsers: intOf(row.onlineUsers),
    onlineWorkspaces: intOf(row.onlineWorkspaces),
    instances: instances.map(toInstanceRow),
    topRoutesByTime: byTime.map((entry) => toRouteRow(entry, 'time')),
    topRoutesByBytes: byBytes.map((entry) => toRouteRow(entry, 'bytes')),
    statusClasses: statuses.map((entry) => {
      const status = recordOf(entry)
      return { statusClass: String(status.status_class ?? ''), count: intOf(status.count) }
    }),
  }
}

function rpcFailure(error: unknown): string {
  if (error !== null && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim() !== '') return message
  }
  return 'the monitoring query could not be read'
}

export const MonitoringService = {
  /** The live view: the last five minutes of traffic and the latest instance row. */
  async overview(now: Date = new Date()): Promise<MonitorOverview> {
    const since = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
    const { data, error } = await supabase.rpc('admin_monitor_overview', { p_since: since })
    if (error) throw new Error(rpcFailure(error))
    return toOverview(data)
  },

  async series(range: MonitorRange, now: Date = new Date()): Promise<MonitorSeriesPoint[]> {
    const window = rangeWindow(range, now)
    const { data, error } = await supabase.rpc('admin_monitor_series', {
      p_since: window.since.toISOString(),
      p_unit: window.unit,
    })
    if (error) throw new Error(rpcFailure(error))
    const rows = Array.isArray(data) ? data : []
    return rows.map((entry) => {
      const row = recordOf(entry)
      return {
        bucket: String(row.bucket ?? ''),
        requests: intOf(row.requests),
        errors: intOf(row.errors),
        bytes: numberOf(row.bytes),
        avgMs: numberOf(row.avg_ms),
      }
    })
  },

  /**
   * Database vitals. Missing `pg_stat_statements` is a REASON, not an error;
   * a failed RPC is reported as unavailable and never breaks the page.
   */
  async dbVitals(): Promise<DbVitals> {
    const { data, error } = await supabase.rpc('admin_db_vitals')
    if (error) {
      return {
        available: false,
        reason: rpcFailure(error),
        databaseSizeBytes: null,
        connections: null,
        cacheHitRatio: null,
        deadlocks: null,
        tempBytes: null,
        waitingLocks: null,
        longestTransactionSeconds: null,
        replicationLagSeconds: null,
        statements: null,
        statementsUnavailableReason: null,
      }
    }

    const row = recordOf(data)
    const database = recordOf(row.database)
    const connections = recordOf(row.connections)
    const cache = recordOf(row.cache)
    const locks = recordOf(row.locks)
    const replication = recordOf(row.replication)
    const statements = Array.isArray(row.statements) ? row.statements : null

    return {
      available: true,
      reason: null,
      databaseSizeBytes: numberOf(database.sizeBytes),
      connections:
        Object.keys(connections).length === 0
          ? null
          : {
              active: intOf(connections.active),
              idle: intOf(connections.idle),
              total: intOf(connections.total),
              max: intOf(connections.max),
            },
      cacheHitRatio: numberOf(cache.hitRatio),
      deadlocks: numberOf(row.deadlocks),
      tempBytes: numberOf(row.tempBytes),
      waitingLocks: numberOf(locks.waiting),
      longestTransactionSeconds: numberOf(locks.longestTransactionSeconds),
      replicationLagSeconds: numberOf(replication.lagSeconds),
      statements:
        statements === null
          ? null
          : statements.map((entry) => {
              const statement = recordOf(entry)
              return {
                calls: intOf(statement.calls),
                total_ms: numberOf(statement.total_ms) ?? 0,
                mean_ms: numberOf(statement.mean_ms) ?? 0,
                rows: intOf(statement.rows),
                query: String(statement.query ?? ''),
              }
            }),
      statementsUnavailableReason:
        typeof row.statementsUnavailableReason === 'string'
          ? row.statementsUnavailableReason
          : null,
    }
  },

  async alertRules(): Promise<AlertRule[]> {
    const { data, error } = await supabase
      .from('metric_alert_rules')
      .select(
        'id, metric, core_id, comparator, threshold, duration_minutes, severity, is_enabled, cooldown_minutes',
      )
      .order('metric')
    if (error) throw new Error(rpcFailure(error))
    return (data ?? []).map((entry: unknown) => {
      const row = recordOf(entry)
      return {
        id: String(row.id ?? ''),
        metric: String(row.metric ?? ''),
        coreId: typeof row.core_id === 'string' ? row.core_id : null,
        comparator: row.comparator === '<' ? '<' : '>',
        threshold: numberOf(row.threshold) ?? 0,
        durationMinutes: intOf(row.duration_minutes, 5),
        severity: row.severity === 'critical' ? 'critical' : 'warning',
        isEnabled: row.is_enabled !== false,
        cooldownMinutes: intOf(row.cooldown_minutes, 60),
      }
    })
  },

  async updateAlertRule(input: {
    id: string
    threshold: number
    durationMinutes: number
    isEnabled: boolean
    severity: 'warning' | 'critical'
  }): Promise<void> {
    const { error } = await supabase
      .from('metric_alert_rules')
      .update({
        threshold: input.threshold,
        duration_minutes: input.durationMinutes,
        is_enabled: input.isEnabled,
        severity: input.severity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
    if (error) throw new Error(rpcFailure(error))
  },

  /**
   * Evaluate every enabled rule. `notify` is false on a screen read: a GET must
   * not send an email or write an event. The scheduler passes true once per
   * minute. Infrastructure rules keep the streak cache; core rules additionally
   * persist raised/resolved events (dedup is a DB partial unique index).
   */
  async evaluateAlerts(
    options: { notify: boolean; now?: Date } = { notify: false },
  ): Promise<AlertEvaluation[]> {
    const now = options.now ?? new Date()
    const [rules, overview, vitals] = await Promise.all([
      this.alertRules(),
      this.overview(now),
      this.dbVitals(),
    ])

    const evaluations: AlertEvaluation[] = []
    const infraRules = rules.filter((rule) => rule.coreId === null)
    const coreRules = rules.filter((rule) => rule.coreId !== null)

    for (const rule of infraRules) {
      const value = alertValue(rule.metric, overview, vitals)
      if (!rule.isEnabled) {
        evaluations.push({
          rule,
          coreId: '',
          currentValue: value,
          state: 'disabled',
          breachedForMinutes: 0,
        })
        continue
      }
      if (value === null) {
        evaluations.push({
          rule,
          coreId: '',
          currentValue: null,
          state: 'unknown',
          breachedForMinutes: 0,
        })
        await streakClear(rule.id)
        continue
      }

      const breached = rule.comparator === '>' ? value > rule.threshold : value < rule.threshold
      if (!breached) {
        await streakClear(rule.id)
        evaluations.push({
          rule,
          coreId: '',
          currentValue: value,
          state: 'ok',
          breachedForMinutes: 0,
        })
        continue
      }

      const since = await streakSince(rule.id, now)
      const minutes = Math.floor((now.getTime() - since.getTime()) / 60_000)
      const state = minutes >= rule.durationMinutes ? 'breaching' : 'pending'
      evaluations.push({
        rule,
        coreId: '',
        currentValue: value,
        state,
        breachedForMinutes: minutes,
      })

      if (state === 'breaching' && options.notify) {
        await notifyBreach(rule, value, minutes, now)
      }
    }

    if (coreRules.length > 0) {
      // Before admin-core-monitoring-01 is applied the snapshot RPC is absent:
      // core rules degrade to unknown, infrastructure alerts keep working.
      let snapshot: CoreSnapshot
      try {
        snapshot = await this.coreSnapshot(now)
      } catch {
        for (const rule of coreRules) {
          evaluations.push({
            rule,
            coreId: rule.coreId ?? '',
            currentValue: null,
            state: 'unknown',
            breachedForMinutes: 0,
          })
        }
        return evaluations
      }
      // A specific-core rule overrides the wildcard for that core+metric.
      const specific = new Set(
        coreRules
          .filter((rule) => rule.coreId !== '*' && rule.coreId !== null)
          .map((rule) => `${rule.metric}\u0000${rule.coreId}`),
      )
      for (const rule of coreRules) {
        const targets =
          rule.coreId === '*'
            ? snapshot.cores.filter((core) => !specific.has(`${rule.metric}\u0000${core.id}`))
            : snapshot.cores.filter((core) => core.id === rule.coreId)
        for (const core of targets) {
          const value = coreMetricValue(rule.metric, core)
          const streakKey = `${rule.id}:${core.id}`
          if (!rule.isEnabled) {
            evaluations.push({
              rule,
              coreId: core.id,
              currentValue: value,
              state: 'disabled',
              breachedForMinutes: 0,
            })
            continue
          }
          if (value === null) {
            evaluations.push({
              rule,
              coreId: core.id,
              currentValue: null,
              state: 'unknown',
              breachedForMinutes: 0,
            })
            await streakClear(streakKey)
            if (options.notify) await resolveCoreEvent(rule, core.id, now)
            continue
          }
          const breached = rule.comparator === '>' ? value > rule.threshold : value < rule.threshold
          if (!breached) {
            await streakClear(streakKey)
            evaluations.push({
              rule,
              coreId: core.id,
              currentValue: value,
              state: 'ok',
              breachedForMinutes: 0,
            })
            if (options.notify) await resolveCoreEvent(rule, core.id, now)
            continue
          }
          const since = await streakSince(streakKey, now)
          const minutes = Math.floor((now.getTime() - since.getTime()) / 60_000)
          const state = minutes >= rule.durationMinutes ? 'breaching' : 'pending'
          evaluations.push({
            rule,
            coreId: core.id,
            currentValue: value,
            state,
            breachedForMinutes: minutes,
          })
          if (state === 'breaching' && options.notify) {
            await raiseCoreEvent(rule, core, value, minutes, now)
          }
        }
      }
    }
    return evaluations
  },

  // ─── Unified core observability (21 Nov 2026) ────────────────────────────

  /**
   * Every registered core, measured or UNKNOWN — a core is never dropped from
   * this list for lacking data. Pressure comes from pressure-v1 over the last
   * five minutes; the trend compares against the five minutes before that.
   */
  async coreSnapshot(now: Date = new Date()): Promise<CoreSnapshot> {
    const windowMinutes = 5
    const since = new Date(now.getTime() - windowMinutes * 60_000)
    const prevSince = new Date(since.getTime() - windowMinutes * 60_000)
    const [current, previous] = await Promise.all([
      supabase.rpc('admin_core_monitor_snapshot', {
        p_since: since.toISOString(),
        p_until: now.toISOString(),
      }),
      supabase.rpc('admin_core_monitor_snapshot', {
        p_since: prevSince.toISOString(),
        p_until: since.toISOString(),
      }),
    ])
    if (current.error) throw new Error(rpcFailure(current.error))
    // A failed previous-window read degrades the trend to null, not the page.
    const prevCores = previous.error
      ? new Map<string, CoreAggregate>()
      : aggregatesOf(previous.data)

    const row = recordOf(current.data)
    const aggregates = aggregatesOf(current.data)
    const gauges = gaugesOf(row.gauges)
    const instances = Array.isArray(row.instances) ? row.instances : []
    const db = row.db === null || row.db === undefined ? null : recordOf(row.db)

    const cores: CorePressureRow[] = CORES.map((definition) => {
      const aggregate = aggregates.get(definition.id) ?? null
      const gauge = gauges.get(definition.id) ?? null
      const measured = toCoreRow(definition, aggregate, gauge, windowMinutes)
      const prevAggregate = prevCores.get(definition.id) ?? null
      const prevPressure = prevAggregate
        ? computePressure(toPressureInput(definition, prevAggregate, gauge)).pressure
        : null
      return {
        ...measured,
        trend:
          measured.pressure !== null && prevPressure !== null
            ? measured.pressure - prevPressure
            : null,
      }
    })

    const counts = { healthy: 0, warning: 0, critical: 0, unknown: 0 }
    for (const core of cores) counts[core.status] += 1

    return {
      generatedAt: now.toISOString(),
      windowMinutes,
      since: since.toISOString(),
      cores,
      counts,
      instances: instances.map((entry) => toCoreInstance(entry, now)),
      db: db === null ? null : toDbHistory(db),
    }
  },

  /** Per-core history. An unknown core id is a 404, never an empty chart. */
  async coreSeries(
    coreId: string,
    range: MonitorRange,
    now: Date = new Date(),
  ): Promise<CoreSeriesPoint[]> {
    if (!coreById(coreId)) {
      const err = new Error(`Unknown core: ${coreId}`) as Error & { statusCode?: number }
      err.statusCode = 404
      throw err
    }
    const window = rangeWindow(range, now)
    const { data, error } = await supabase.rpc('admin_core_monitor_series', {
      p_core_id: coreId,
      p_since: window.since.toISOString(),
      p_unit: window.unit,
    })
    if (error) throw new Error(rpcFailure(error))
    const rows = Array.isArray(data) ? data : []
    return rows.map((entry) => {
      const point = recordOf(entry)
      const buckets = arrayOfNumbers(point.duration_buckets)
      const operations = intOf(point.operations)
      const errors = intOf(point.errors)
      return {
        bucket: String(point.bucket ?? ''),
        operations,
        errors,
        clientErrors: intOf(point.client_errors),
        errorPercent: operations > 0 ? (errors / operations) * 100 : null,
        avgMs: numberOf(point.avg_ms),
        p50: estimatePercentile(buckets, 50),
        p95: estimatePercentile(buckets, 95),
        p99: estimatePercentile(buckets, 99),
        timeouts: intOf(point.timeouts),
        inflightMax: intOf(point.inflight_max),
        queueDepth: numberOf(point.queue_depth),
        dependencyWaitAvgMs: numberOf(point.dep_wait_avg_ms),
      }
    })
  },

  /** Alert event history — raised AND resolved, newest first. */
  async alertEvents(limit = 50): Promise<AlertEventRow[]> {
    const { data, error } = await supabase
      .from('metric_alert_events')
      .select(
        'id, rule_id, core_id, metric, severity, value, threshold, evidence, raised_at, resolved_at',
      )
      .order('raised_at', { ascending: false })
      .limit(Math.min(Math.max(1, limit), 200))
    if (error) throw new Error(rpcFailure(error))
    return (data ?? []).map((entry: unknown) => {
      const row = recordOf(entry)
      return {
        id: String(row.id ?? ''),
        ruleId: String(row.rule_id ?? ''),
        coreId: String(row.core_id ?? ''),
        metric: String(row.metric ?? ''),
        severity: row.severity === 'critical' ? 'critical' : 'warning',
        value: numberOf(row.value),
        threshold: numberOf(row.threshold) ?? 0,
        evidence: recordOf(row.evidence),
        raisedAt: String(row.raised_at ?? ''),
        resolvedAt: typeof row.resolved_at === 'string' ? row.resolved_at : null,
      }
    })
  },
}

export interface AlertRule {
  id: string
  metric: string
  /** NULL = infrastructure rule; '*' = every core; a core id = override. */
  coreId: string | null
  comparator: '>' | '<'
  threshold: number
  durationMinutes: number
  severity: 'warning' | 'critical'
  isEnabled: boolean
  cooldownMinutes: number
}

export interface AlertEvaluation {
  rule: AlertRule
  /** The concrete core this evaluation is about ('' for infrastructure). */
  coreId: string
  currentValue: number | null
  state: 'ok' | 'pending' | 'breaching' | 'unknown' | 'disabled'
  breachedForMinutes: number
}

function alertValue(metric: string, overview: MonitorOverview, vitals: DbVitals): number | null {
  if (metric === 'cpu_percent') {
    return overview.instances.length === 0
      ? null
      : Math.max(...overview.instances.map((row) => row.cpuPercent))
  }
  if (metric === 'memory_percent') {
    return overview.instances.length === 0
      ? null
      : Math.max(...overview.instances.map((row) => row.memoryPercent))
  }
  if (metric === 'event_loop_p99_ms') {
    return overview.instances.length === 0
      ? null
      : Math.max(...overview.instances.map((row) => row.eventLoopP99Ms))
  }
  if (metric === 'db_connections_percent') {
    if (!vitals.connections || vitals.connections.max <= 0) return null
    return (vitals.connections.total / vitals.connections.max) * 100
  }
  if (metric === 'http_5xx_percent') {
    if (overview.requests <= 0) return null
    return (overview.errors5xx / overview.requests) * 100
  }
  if (metric === 'replication_lag_seconds') {
    return vitals.replicationLagSeconds
  }
  // A metric name the code does not understand is unknown, never «fine».
  return null
}

const STREAK_KEY = (ruleId: string) => `admin:alert:streak:${ruleId}`
const NOTIFIED_KEY = (ruleId: string, hourSlot: number) =>
  `admin:alert:notified:${ruleId}:${hourSlot}`

async function streakSince(ruleId: string, now: Date): Promise<Date> {
  const raw = await cacheService.get<number>(STREAK_KEY(ruleId))
  if (typeof raw === 'number' && Number.isFinite(raw)) return new Date(raw)
  await cacheService.set(STREAK_KEY(ruleId), now.getTime(), 24 * 60 * 60)
  return now
}

async function streakClear(ruleId: string): Promise<void> {
  await cacheService.del(STREAK_KEY(ruleId))
}

/** One email and one audit row per rule per hour, however often it is evaluated. */
async function notifyBreach(
  rule: AlertRule,
  value: number,
  minutes: number,
  now: Date,
): Promise<void> {
  const hourSlot = Math.floor(now.getTime() / 3_600_000)
  const dedupe = NOTIFIED_KEY(rule.id, hourSlot)
  if (await cacheService.exists(dedupe)) return
  await cacheService.set(dedupe, true, 2 * 60 * 60)

  await AdminSecurityService.logSecurityEvent({
    eventType: 'METRIC_ALERT_RAISED',
    details: {
      metric: rule.metric,
      comparator: rule.comparator,
      threshold: rule.threshold,
      value: Number(value.toFixed(2)),
      minutes,
      severity: rule.severity,
    },
  })

  const owner = breakGlassEmail()
  if (!owner) return

  const subject = `[Hisabche] ${rule.severity === 'critical' ? 'CRITICAL' : 'Warning'}: ${rule.metric}`
  const html =
    `<p><strong>${rule.metric}</strong> is ${value.toFixed(2)} ` +
    `(${rule.comparator} ${rule.threshold}) for at least ${minutes} minute(s).</p>` +
    `<p>Open Operations → Monitor to see the live values. This is a real measurement, ` +
    `not a projection.</p>`
  await enqueueEmail(owner, subject, html)
}

// ─── Unified core observability — types & helpers ────────────────────────────

interface CoreAggregate {
  operations: number
  success: number
  errors: number
  clientErrors: number
  durationSumMs: number
  durationMaxMs: number
  durationBuckets: number[]
  inflightMax: number
  concurrencyMax: number
  timeouts: number
  dependencyWaitTotalMs: number | null
  dependencyMeasuredCount: number
  lastMinute: string | null
}

interface CoreGauge {
  queueDepth: number | null
  processingCount: number | null
  stuckCount: number | null
  retryCount: number | null
  queueWaitTotalMs: number | null
}

export interface CorePressureRow {
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
  /** Pressure delta vs the previous window; null when either side is unknown. */
  trend: number | null
}

export interface CoreInstanceRow {
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

export interface DbHistoryRow {
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
  cores: CorePressureRow[]
  counts: { healthy: number; warning: number; critical: number; unknown: number }
  instances: CoreInstanceRow[]
  db: DbHistoryRow | null
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

export interface AlertEventRow {
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

function arrayOfNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) return [0, 0, 0, 0, 0, 0]
  const out = value.map((entry) => intOf(entry))
  while (out.length < 6) out.push(0)
  return out.slice(0, 6)
}

function aggregatesOf(data: unknown): Map<string, CoreAggregate> {
  const row = recordOf(data)
  const cores = Array.isArray(row.cores) ? row.cores : []
  const map = new Map<string, CoreAggregate>()
  for (const entry of cores) {
    const core = recordOf(entry)
    const id = String(core.core_id ?? '')
    if (!id) continue
    map.set(id, {
      operations: intOf(core.operations),
      success: intOf(core.success),
      errors: intOf(core.errors),
      clientErrors: intOf(core.client_errors),
      durationSumMs: intOf(core.duration_sum_ms),
      durationMaxMs: intOf(core.duration_max_ms),
      durationBuckets: arrayOfNumbers(core.duration_buckets),
      inflightMax: intOf(core.inflight_max),
      concurrencyMax: intOf(core.concurrency_max),
      timeouts: intOf(core.timeouts),
      dependencyWaitTotalMs: numberOf(core.dependency_wait_total_ms),
      dependencyMeasuredCount: intOf(core.dependency_measured_count),
      lastMinute: typeof core.last_minute === 'string' ? core.last_minute : null,
    })
  }
  return map
}

function gaugesOf(value: unknown): Map<string, CoreGauge> {
  const rows = Array.isArray(value) ? value : []
  const map = new Map<string, CoreGauge>()
  for (const entry of rows) {
    const gauge = recordOf(entry)
    const id = String(gauge.core_id ?? '')
    if (!id) continue
    map.set(id, {
      queueDepth: numberOf(gauge.queue_depth),
      processingCount: numberOf(gauge.processing_count),
      stuckCount: numberOf(gauge.stuck_count),
      retryCount: numberOf(gauge.retry_count),
      queueWaitTotalMs: numberOf(gauge.queue_wait_total_ms),
    })
  }
  return map
}

function toPressureInput(
  definition: CoreDefinition,
  aggregate: CoreAggregate,
  gauge: CoreGauge | null,
) {
  return {
    operationCount: aggregate.operations,
    errorCount: aggregate.errors,
    durationBuckets: aggregate.durationBuckets,
    queueDepth: gauge?.queueDepth ?? null,
    retryCount: gauge?.retryCount ?? null,
    timeoutCount: aggregate.timeouts,
    dependencyWaitTotalMs: aggregate.dependencyWaitTotalMs,
    dependencyMeasuredCount: aggregate.dependencyMeasuredCount,
    slo: definition.slo,
  }
}

function toCoreRow(
  definition: CoreDefinition,
  aggregate: CoreAggregate | null,
  gauge: CoreGauge | null,
  windowMinutes: number,
): Omit<CorePressureRow, 'trend'> {
  const base = {
    id: definition.id,
    group: definition.group,
    owner: definition.owner,
    slo: definition.slo,
    queueDepth: gauge?.queueDepth ?? null,
    processingCount: gauge?.processingCount ?? null,
    stuckCount: gauge?.stuckCount ?? null,
    retryCount: gauge?.retryCount ?? null,
  }
  if (!aggregate || aggregate.operations === 0) {
    // No traffic in the window: UNKNOWN with the reason, never «healthy at 0».
    const pressure = computePressure({
      operationCount: 0,
      errorCount: 0,
      durationBuckets: [0, 0, 0, 0, 0, 0],
      queueDepth: gauge?.queueDepth ?? null,
      retryCount: gauge?.retryCount ?? null,
      timeoutCount: 0,
      dependencyWaitTotalMs: null,
      dependencyMeasuredCount: 0,
      slo: definition.slo,
    })
    return {
      ...base,
      status: pressure.status,
      pressure: pressure.pressure,
      reason: pressure.reason,
      coverage: pressure.coverage,
      components: pressure.components,
      operations: 0,
      callsPerMin: null,
      successRate: null,
      errorRate: null,
      p50: null,
      p95: null,
      p99: null,
      maxMs: null,
      inflightMax: aggregate?.inflightMax ?? 0,
      concurrencyMax: aggregate?.concurrencyMax ?? 0,
      timeouts: 0,
      dependencyWaitAvgMs: null,
      lastSample: aggregate?.lastMinute ?? null,
    }
  }
  const pressure = computePressure(toPressureInput(definition, aggregate, gauge))
  const depAvg =
    aggregate.dependencyWaitTotalMs !== null && aggregate.dependencyMeasuredCount > 0
      ? aggregate.dependencyWaitTotalMs / aggregate.dependencyMeasuredCount
      : null
  return {
    ...base,
    status: pressure.status,
    pressure: pressure.pressure,
    reason: pressure.reason,
    coverage: pressure.coverage,
    components: pressure.components,
    operations: aggregate.operations,
    callsPerMin: aggregate.operations / windowMinutes,
    successRate: (aggregate.success / aggregate.operations) * 100,
    errorRate: (aggregate.errors / aggregate.operations) * 100,
    p50: estimatePercentile(aggregate.durationBuckets, 50),
    p95: estimatePercentile(aggregate.durationBuckets, 95),
    p99: estimatePercentile(aggregate.durationBuckets, 99),
    maxMs: aggregate.durationMaxMs,
    inflightMax: aggregate.inflightMax,
    concurrencyMax: aggregate.concurrencyMax,
    timeouts: aggregate.timeouts,
    dependencyWaitAvgMs: depAvg,
    lastSample: aggregate.lastMinute,
  }
}

/** An instance is online when its last flush is newer than 3 minutes. */
const INSTANCE_ONLINE_WINDOW_MS = 3 * 60_000

function toCoreInstance(value: unknown, now: Date): CoreInstanceRow {
  const row = recordOf(value)
  const lastSeen = String(row.last_seen ?? '')
  const seenAt = new Date(lastSeen).getTime()
  return {
    instanceId: String(row.instance_id ?? ''),
    processRole: String(row.process_role ?? 'all'),
    lastSeen,
    online: Number.isFinite(seenAt) && now.getTime() - seenAt < INSTANCE_ONLINE_WINDOW_MS,
    cpuPercent: numberOf(row.cpu_percent) ?? 0,
    memoryPercent: numberOf(row.memory_percent) ?? 0,
    eventLoopP99Ms: numberOf(row.event_loop_p99_ms) ?? 0,
    heapUsedBytes: intOf(row.heap_used_bytes),
    heapTotalBytes: intOf(row.heap_total_bytes),
    rssBytes: numberOf(row.rss_bytes),
    inflightRequests: intOf(row.inflight_requests),
    syncSockets: intOf(row.sync_sockets),
  }
}

function toDbHistory(row: Record<string, unknown>): DbHistoryRow {
  return {
    minute: String(row.minute ?? ''),
    connectionsActive: numberOf(row.connections_active),
    connectionsIdle: numberOf(row.connections_idle),
    connectionsTotal: numberOf(row.connections_total),
    connectionsMax: numberOf(row.connections_max),
    waitingLocks: numberOf(row.waiting_locks),
    cacheHitRatio: numberOf(row.cache_hit_ratio),
    longestTransactionSeconds: numberOf(row.longest_transaction_seconds),
    databaseSizeBytes: numberOf(row.database_size_bytes),
  }
}

function coreMetricValue(metric: string, core: CorePressureRow): number | null {
  if (metric === 'core_pressure') return core.pressure
  if (metric === 'core_p95_ms') return core.p95?.value ?? null
  if (metric === 'core_error_percent') return core.errorRate
  if (metric === 'core_queue_depth') return core.queueDepth
  // A metric name the code does not understand is unknown, never «fine».
  return null
}

/**
 * Raise (or keep) the ONE open event for this rule+core. The partial unique
 * index is the dedup backstop: a concurrent insert loses and is ignored.
 * Notification respects the rule cooldown via last_notified_at.
 */
async function raiseCoreEvent(
  rule: AlertRule,
  core: CorePressureRow,
  value: number,
  minutes: number,
  now: Date,
): Promise<void> {
  const { data: openData } = await supabase
    .from('metric_alert_events')
    .select('id, last_notified_at')
    .eq('rule_id', rule.id)
    .eq('core_id', core.id)
    .is('resolved_at', null)
    .maybeSingle()
  const open = openData ? recordOf(openData) : null

  // Sanitized evidence: which components are saturated — never a stack trace.
  const evidence = {
    pressure: core.pressure,
    components: core.components
      .filter((component) => component.value !== null && component.value >= 0.5)
      .map((component) => ({ key: component.key, value: component.value, note: component.note })),
    p95Ms: core.p95?.value ?? null,
    errorPercent: core.errorRate,
    queueDepth: core.queueDepth,
    minutes,
  }

  if (!open) {
    const { error } = await supabase.from('metric_alert_events').insert({
      rule_id: rule.id,
      core_id: core.id,
      metric: rule.metric,
      severity: rule.severity,
      value,
      threshold: rule.threshold,
      evidence,
      raised_at: now.toISOString(),
      last_notified_at: now.toISOString(),
    })
    if (error) return // unique violation = another evaluator raised it first
    await AdminSecurityService.logSecurityEvent({
      eventType: 'METRIC_ALERT_RAISED',
      details: {
        metric: rule.metric,
        coreId: core.id,
        threshold: rule.threshold,
        value: Number(value.toFixed(2)),
        minutes,
        severity: rule.severity,
      },
    })
    await notifyCoreBreach(rule, core, value, minutes)
    return
  }

  const lastNotified = open.last_notified_at ? new Date(String(open.last_notified_at)).getTime() : 0
  if (now.getTime() - lastNotified >= rule.cooldownMinutes * 60_000) {
    await supabase
      .from('metric_alert_events')
      .update({ value, evidence, last_notified_at: now.toISOString() })
      .eq('id', String(open.id))
    await notifyCoreBreach(rule, core, value, minutes)
  } else {
    await supabase.from('metric_alert_events').update({ value, evidence }).eq('id', String(open.id))
  }
}

/** Recovery closes the open event and audits it. No open event = nothing to do. */
async function resolveCoreEvent(rule: AlertRule, coreId: string, now: Date): Promise<void> {
  const { data: openData } = await supabase
    .from('metric_alert_events')
    .select('id')
    .eq('rule_id', rule.id)
    .eq('core_id', coreId)
    .is('resolved_at', null)
    .maybeSingle()
  if (!openData) return
  const open = recordOf(openData)
  await supabase
    .from('metric_alert_events')
    .update({ resolved_at: now.toISOString() })
    .eq('id', String(open.id))
  await AdminSecurityService.logSecurityEvent({
    eventType: 'METRIC_ALERT_RESOLVED',
    details: { metric: rule.metric, coreId },
  })
}

async function notifyCoreBreach(
  rule: AlertRule,
  core: CorePressureRow,
  value: number,
  minutes: number,
): Promise<void> {
  const owner = breakGlassEmail()
  if (!owner) return
  const subject = `[Hisabche] ${rule.severity === 'critical' ? 'CRITICAL' : 'Warning'}: ${core.id} ${rule.metric}`
  const html =
    `<p>Core <strong>${core.id}</strong> (${core.owner}): ${rule.metric} is ${value.toFixed(2)} ` +
    `(${rule.comparator} ${rule.threshold}) for at least ${minutes} minute(s).</p>` +
    `<p>Open Operations → Monitor → ${core.id} for the pressure breakdown and history.</p>`
  await enqueueEmail(owner, subject, html)
}
