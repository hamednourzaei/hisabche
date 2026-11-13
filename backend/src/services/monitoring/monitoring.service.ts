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

export type MonitorRange = '1h' | '24h' | '7d' | '90d'

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
      .select('id, metric, comparator, threshold, duration_minutes, severity, is_enabled')
      .order('metric')
    if (error) throw new Error(rpcFailure(error))
    return (data ?? []).map((entry: unknown) => {
      const row = recordOf(entry)
      return {
        id: String(row.id ?? ''),
        metric: String(row.metric ?? ''),
        comparator: row.comparator === '<' ? '<' : '>',
        threshold: numberOf(row.threshold) ?? 0,
        durationMinutes: intOf(row.duration_minutes, 5),
        severity: row.severity === 'critical' ? 'critical' : 'warning',
        isEnabled: row.is_enabled !== false,
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
   * not send an email. The scheduler passes true once per minute.
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
    for (const rule of rules) {
      const value = alertValue(rule.metric, overview, vitals)
      if (!rule.isEnabled) {
        evaluations.push({ rule, currentValue: value, state: 'disabled', breachedForMinutes: 0 })
        continue
      }
      if (value === null) {
        evaluations.push({ rule, currentValue: null, state: 'unknown', breachedForMinutes: 0 })
        await streakClear(rule.id)
        continue
      }

      const breached = rule.comparator === '>' ? value > rule.threshold : value < rule.threshold
      if (!breached) {
        await streakClear(rule.id)
        evaluations.push({ rule, currentValue: value, state: 'ok', breachedForMinutes: 0 })
        continue
      }

      const since = await streakSince(rule.id, now)
      const minutes = Math.floor((now.getTime() - since.getTime()) / 60_000)
      const state = minutes >= rule.durationMinutes ? 'breaching' : 'pending'
      evaluations.push({ rule, currentValue: value, state, breachedForMinutes: minutes })

      if (state === 'breaching' && options.notify) {
        await notifyBreach(rule, value, minutes, now)
      }
    }
    return evaluations
  },
}

export interface AlertRule {
  id: string
  metric: string
  comparator: '>' | '<'
  threshold: number
  durationMinutes: number
  severity: 'warning' | 'critical'
  isEnabled: boolean
}

export interface AlertEvaluation {
  rule: AlertRule
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
