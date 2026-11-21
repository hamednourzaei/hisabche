// ============================================
// backend/src/services/monitoring/route-metrics.ts
//
// V63 · M-1/M-2/M-4 — cheap, aggregated-at-the-source traffic metrics.
// Unified Core Observability (21 Nov 2026) — the SAME collector now also
// buckets every observation by business core (core-registry.ts). There is
// still ONE collector, ONE flush authority, ONE sampler per process.
//
// WHAT IS COUNTED
//   one bucket per (route TEMPLATE, method, status class) per minute,
//   one bucket per (core, operation group) per minute,
//   one row per instance per minute, plus the SET SIZE of hashed user and
//   workspace ids seen in that minute. Once per closed minute the gauge
//   provider adds the job queue and database vitals (exact counts, no PII).
//
// WHAT IS NEVER COUNTED
//   the raw URL (ids and query strings are PII), a user id, an email, a
//   workspace id, a customer name. Users and workspaces are SHA-256 hashes only,
//   and the hash is the only thing that leaves this process.
//
// WHY A BUFFER
//   A database write per request would make the monitor the load it measures.
//   Observations accumulate in memory and one flush per minute writes one row
//   per bucket. The flush is idempotent (UPSERT on the minute+key) because a
//   restart mid-minute must not double-count.
// ============================================

import { createHash } from 'node:crypto'

import { supabase } from '../../db'
import { INSTANCE_LABEL } from '../instance-registry'
import { cursorWatcher } from '../sync-stream'
import { parseProcessRole, type ProcessRole } from '../../runtime/role'
import { bucketIndex, coreForRoute, operationGroupFor } from './core-registry'

export type StatusClass = '1xx' | '2xx' | '3xx' | '4xx' | '5xx'

export function statusClassOf(statusCode: number): StatusClass {
  if (statusCode >= 500) return '5xx'
  if (statusCode >= 400) return '4xx'
  if (statusCode >= 300) return '3xx'
  if (statusCode >= 200) return '2xx'
  return '1xx'
}

export interface RouteHit {
  /** THE FASTIFY TEMPLATE — `request.routeOptions.url`, never `request.url`. */
  route: string
  method: string
  statusCode: number
  durationMs: number
  /** `null` when the response carried no content-length (unknown, not zero). */
  bytesOut: number | null
  userId?: string | undefined
  workspaceId?: string | undefined
  /** Wall time with a Supabase call open (utils/supabase-fetch-metrics). Null = uninstrumented. */
  dependencyWaitMs?: number | null | undefined
  /** Global requests already in flight when this one started (concurrency sample). */
  inflightAtStart?: number | undefined
}

export interface RequestMetricRow {
  minute: string
  instance_id: string
  route: string
  method: string
  status_class: StatusClass
  count: number
  bytes_out: number | null
  duration_sum_ms: number
  duration_max_ms: number
  duration_buckets: number[]
}

/** One core × operation group × minute × instance. No ids, no urls, no PII. */
export interface CoreMetricRow {
  minute: string
  instance_id: string
  process_role: ProcessRole
  core_id: string
  operation_group: string
  operation_count: number
  success_count: number
  error_count: number
  client_error_count: number
  duration_sum_ms: number
  duration_max_ms: number
  duration_buckets: number[]
  inflight_max: number
  concurrency_max: number
  timeout_count: number
  /** Null when no request in the minute carried a measured dependency wait. */
  dependency_wait_total_ms: number | null
  /** How many operations contributed to the dependency wait total. */
  dependency_measured_count: number
}

/** Core-level gauges sampled once per closed minute (job queue today). */
export interface CoreGaugeRow {
  minute: string
  instance_id: string
  core_id: string
  queue_depth: number | null
  processing_count: number | null
  stuck_count: number | null
  retry_count: number | null
  queue_wait_total_ms: number | null
}

/** Database vitals sampled once per closed minute (admin_db_vitals RPC). */
export interface DbMetricRow {
  minute: string
  instance_id: string
  connections_active: number | null
  connections_idle: number | null
  connections_total: number | null
  connections_max: number | null
  waiting_locks: number | null
  cache_hit_ratio: number | null
  longest_transaction_seconds: number | null
  database_size_bytes: number | null
}

export interface ActiveUserRow {
  minute: string
  user_hash: string
}

export interface ActiveWorkspaceRow {
  minute: string
  workspace_hash: string
}

export interface InstanceMinuteRow {
  minute: string
  instance_id: string
  process_role: ProcessRole
  cpu_percent: number
  memory_percent: number
  event_loop_p99_ms: number
  heap_used_bytes: number
  heap_total_bytes: number
  rss_bytes: number
  inflight_requests: number
  sync_sockets: number
}

export interface InstanceSample {
  cpuPercent: number
  memoryPercent: number
  eventLoopP99Ms: number
  heapUsedBytes: number
  heapTotalBytes: number
  rssBytes: number
  inflightRequests: number
  syncSockets: number
}

/** What the gauge provider measured for one closed minute. Null = unavailable. */
export interface CoreGaugeSample {
  cores: Array<{
    coreId: string
    queueDepth: number | null
    processingCount: number | null
    stuckCount: number | null
    retryCount: number | null
    queueWaitTotalMs: number | null
  }>
  db: Omit<DbMetricRow, 'minute' | 'instance_id'> | null
}

export interface MetricsSink {
  writeRequestMetrics(rows: RequestMetricRow[]): Promise<void>
  writeActiveUsers(rows: ActiveUserRow[]): Promise<void>
  writeActiveWorkspaces(rows: ActiveWorkspaceRow[]): Promise<void>
  writeInstanceMetrics(row: InstanceMinuteRow): Promise<void>
  writeCoreMetrics(rows: CoreMetricRow[]): Promise<void>
  writeCoreGauges(rows: CoreGaugeRow[]): Promise<void>
  writeDbMetrics(row: DbMetricRow): Promise<void>
}

interface MutableBucket {
  count: number
  bytesOut: number | null
  durationSumMs: number
  durationMaxMs: number
  buckets: number[]
}

interface MutableCoreBucket {
  count: number
  successCount: number
  errorCount: number
  clientErrorCount: number
  durationSumMs: number
  durationMaxMs: number
  buckets: number[]
  inflightMax: number
  concurrencyMax: number
  timeoutCount: number
  dependencyWaitTotalMs: number
  dependencyMeasured: number
}

const MINUTE_MS = 60_000

function minuteStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS)
}

/** SHA-256 of an opaque id. A UUID is random; the hash is one-way and stable. */
export function hashIdentity(id: string): string {
  return createHash('sha256').update(id).digest('hex')
}

function addBytes(current: number | null, next: number | null): number | null {
  // A single unknown byte count makes the minute's bytes unknown: adding a
  // measured number to an unknown one would be a guess dressed as a total.
  if (current === null || next === null) return null
  return current + next
}

function freshCoreBucket(): MutableCoreBucket {
  return {
    count: 0,
    successCount: 0,
    errorCount: 0,
    clientErrorCount: 0,
    durationSumMs: 0,
    durationMaxMs: 0,
    buckets: [0, 0, 0, 0, 0, 0],
    inflightMax: 0,
    concurrencyMax: 0,
    timeoutCount: 0,
    dependencyWaitTotalMs: 0,
    dependencyMeasured: 0,
  }
}

export class RouteMetricsCollector {
  private readonly requests = new Map<string, Map<string, MutableBucket>>()
  private readonly cores = new Map<string, Map<string, MutableCoreBucket>>()
  private readonly users = new Map<string, Set<string>>()
  private readonly workspaces = new Map<string, Set<string>>()
  /** Live per-core in-flight operations of THIS process (begin/end paired). */
  private readonly coreInflight = new Map<string, number>()
  private readonly instanceId: string
  private readonly processRole: ProcessRole
  private readonly sink: MetricsSink
  private readonly now: () => Date
  private readonly sample: (() => InstanceSample) | null
  private readonly gauges: (() => Promise<CoreGaugeSample>) | null
  private lastFlushedMinute: string | null = null

  constructor(options: {
    sink: MetricsSink
    instanceId?: string
    processRole?: ProcessRole
    now?: () => Date
    sample?: (() => InstanceSample) | null
    gauges?: (() => Promise<CoreGaugeSample>) | null
  }) {
    this.sink = options.sink
    this.instanceId = options.instanceId ?? INSTANCE_LABEL
    this.processRole = options.processRole ?? parseProcessRole()
    this.now = options.now ?? (() => new Date())
    this.sample = options.sample === undefined ? null : options.sample
    this.gauges = options.gauges === undefined ? null : options.gauges
  }

  /**
   * A request of this core started. Paired with `endOperation` through the
   * ghost-safe release path (raw response 'close'), so a hijacked or aborted
   * request never leaves a core «in flight» forever.
   */
  beginOperation(coreId: string): void {
    const next = (this.coreInflight.get(coreId) ?? 0) + 1
    this.coreInflight.set(coreId, next)
    const minute = minuteStart(this.now()).toISOString()
    const bucket = this.coreBucket(minute, coreId, 'read')
    // inflightMax is a gauge of the moment, recorded on the minute it happens.
    // The group key here is only a carrier; the flush merges inflight across
    // groups into the core's max (see flushClosedMinutes).
    bucket.inflightMax = Math.max(bucket.inflightMax, next)
  }

  endOperation(coreId: string): void {
    const next = Math.max(0, (this.coreInflight.get(coreId) ?? 0) - 1)
    this.coreInflight.set(coreId, next)
  }

  /** Live per-core in-flight counts of this process (for the stream snapshot). */
  liveCoreInflight(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const [coreId, count] of this.coreInflight) {
      if (count > 0) out[coreId] = count
    }
    return out
  }

  private coreBucket(minute: string, coreId: string, group: string): MutableCoreBucket {
    let buckets = this.cores.get(minute)
    if (!buckets) {
      buckets = new Map<string, MutableCoreBucket>()
      this.cores.set(minute, buckets)
    }
    const key = `${coreId}\u0000${group}`
    const existing = buckets.get(key)
    if (existing) return existing
    const fresh = freshCoreBucket()
    buckets.set(key, fresh)
    return fresh
  }

  observe(hit: RouteHit): void {
    const minute = minuteStart(this.now()).toISOString()
    const key = `${hit.route}\u0000${hit.method}\u0000${statusClassOf(hit.statusCode)}`

    let buckets = this.requests.get(minute)
    if (!buckets) {
      buckets = new Map<string, MutableBucket>()
      this.requests.set(minute, buckets)
    }

    const existing = buckets.get(key)
    const bucket: MutableBucket = existing ?? {
      count: 0,
      bytesOut: 0,
      durationSumMs: 0,
      durationMaxMs: 0,
      buckets: [0, 0, 0, 0, 0, 0],
    }

    bucket.count += 1
    bucket.bytesOut = addBytes(bucket.bytesOut, hit.bytesOut)
    bucket.durationSumMs += Math.max(0, Math.round(hit.durationMs))
    bucket.durationMaxMs = Math.max(bucket.durationMaxMs, Math.round(hit.durationMs))
    bucket.buckets[bucketIndex(hit.durationMs)]! += 1
    buckets.set(key, bucket)

    // ── Core dimension: the SAME observation, attributed to exactly one core.
    const core = coreForRoute(hit.route)
    const group = operationGroupFor(hit.method, hit.route)
    const coreBucket = this.coreBucket(minute, core.id, group)
    const duration = Math.max(0, Math.round(hit.durationMs))
    coreBucket.count += 1
    if (hit.statusCode >= 500) coreBucket.errorCount += 1
    else if (hit.statusCode >= 400) coreBucket.clientErrorCount += 1
    else coreBucket.successCount += 1
    coreBucket.durationSumMs += duration
    coreBucket.durationMaxMs = Math.max(coreBucket.durationMaxMs, duration)
    coreBucket.buckets[bucketIndex(hit.durationMs)]! += 1
    if (hit.statusCode === 504 || hit.statusCode === 408) coreBucket.timeoutCount += 1
    if (typeof hit.inflightAtStart === 'number') {
      coreBucket.concurrencyMax = Math.max(coreBucket.concurrencyMax, hit.inflightAtStart + 1)
    }
    if (typeof hit.dependencyWaitMs === 'number' && Number.isFinite(hit.dependencyWaitMs)) {
      coreBucket.dependencyWaitTotalMs += Math.max(0, Math.round(hit.dependencyWaitMs))
      coreBucket.dependencyMeasured += 1
    }

    if (hit.userId) {
      const set = this.users.get(minute) ?? new Set<string>()
      set.add(hashIdentity(hit.userId))
      this.users.set(minute, set)
    }
    if (hit.workspaceId) {
      const set = this.workspaces.get(minute) ?? new Set<string>()
      set.add(hashIdentity(hit.workspaceId))
      this.workspaces.set(minute, set)
    }
  }

  /**
   * Flush every minute that has CLOSED. Returns the number of request rows
   * written. Called on a short timer; within one minute it does nothing the
   * second time, so «one flush per minute per instance» is a property of the
   * function, not of the caller's diligence.
   */
  async flushClosedMinutes(): Promise<number> {
    const currentMinute = minuteStart(this.now()).toISOString()
    const closed = [...this.requests.keys()].filter((minute) => minute < currentMinute)
    const closedCores = [...this.cores.keys()].filter((minute) => minute < currentMinute)
    const closedUsers = [...this.users.keys()].filter((minute) => minute < currentMinute)
    const closedWorkspaces = [...this.workspaces.keys()].filter((minute) => minute < currentMinute)

    const closedAll = new Set([...closed, ...closedCores, ...closedUsers, ...closedWorkspaces])
    if (closedAll.size === 0) return 0

    const requestRows: RequestMetricRow[] = []
    for (const minute of closed) {
      const buckets = this.requests.get(minute)
      if (!buckets) continue
      for (const [key, bucket] of buckets) {
        const [route, method, statusClass] = key.split('\u0000') as [string, string, StatusClass]
        requestRows.push({
          minute,
          instance_id: this.instanceId,
          route,
          method,
          status_class: statusClass,
          count: bucket.count,
          bytes_out: bucket.bytesOut,
          duration_sum_ms: bucket.durationSumMs,
          duration_max_ms: bucket.durationMaxMs,
          duration_buckets: bucket.buckets,
        })
      }
      this.requests.delete(minute)
    }

    const coreRows: CoreMetricRow[] = []
    for (const minute of closedCores) {
      const buckets = this.cores.get(minute)
      if (!buckets) continue
      // The live-inflight gauge was recorded on whichever group bucket saw the
      // begin; the core's inflight max is the max across its groups.
      const inflightByCore = new Map<string, number>()
      for (const [key, bucket] of buckets) {
        const [coreId] = key.split('\u0000') as [string, string]
        inflightByCore.set(coreId, Math.max(inflightByCore.get(coreId) ?? 0, bucket.inflightMax))
      }
      for (const [key, bucket] of buckets) {
        const [coreId, group] = key.split('\u0000') as [string, string]
        if (bucket.count === 0 && bucket.inflightMax === 0) continue
        coreRows.push({
          minute,
          instance_id: this.instanceId,
          process_role: this.processRole,
          core_id: coreId,
          operation_group: group,
          operation_count: bucket.count,
          success_count: bucket.successCount,
          error_count: bucket.errorCount,
          client_error_count: bucket.clientErrorCount,
          duration_sum_ms: bucket.durationSumMs,
          duration_max_ms: bucket.durationMaxMs,
          duration_buckets: bucket.buckets,
          inflight_max: inflightByCore.get(coreId) ?? 0,
          concurrency_max: bucket.concurrencyMax,
          timeout_count: bucket.timeoutCount,
          dependency_wait_total_ms:
            bucket.dependencyMeasured > 0 ? bucket.dependencyWaitTotalMs : null,
          dependency_measured_count: bucket.dependencyMeasured,
        })
      }
      this.cores.delete(minute)
    }

    const userRows: ActiveUserRow[] = []
    for (const minute of closedUsers) {
      for (const hash of this.users.get(minute) ?? []) {
        userRows.push({ minute, user_hash: hash })
      }
      this.users.delete(minute)
    }

    const workspaceRows: ActiveWorkspaceRow[] = []
    for (const minute of closedWorkspaces) {
      for (const hash of this.workspaces.get(minute) ?? []) {
        workspaceRows.push({ minute, workspace_hash: hash })
      }
      this.workspaces.delete(minute)
    }

    if (requestRows.length > 0) await this.sink.writeRequestMetrics(requestRows)
    if (userRows.length > 0) await this.sink.writeActiveUsers(userRows)
    if (workspaceRows.length > 0) await this.sink.writeActiveWorkspaces(workspaceRows)

    if (this.sample) {
      // One instance row per closed minute, even when no request arrived: an
      // idle instance still has CPU and memory worth seeing.
      for (const minute of closedAll) {
        const value = this.sample()
        await this.sink.writeInstanceMetrics({
          minute,
          instance_id: this.instanceId,
          process_role: this.processRole,
          cpu_percent: value.cpuPercent,
          memory_percent: value.memoryPercent,
          event_loop_p99_ms: value.eventLoopP99Ms,
          heap_used_bytes: value.heapUsedBytes,
          heap_total_bytes: value.heapTotalBytes,
          rss_bytes: value.rssBytes,
          inflight_requests: value.inflightRequests,
          sync_sockets: value.syncSockets,
        })
      }
    }

    // The core tables arrive with admin-core-monitoring-01 (PENDING HUMAN
    // CONFIRMATION). Until the migration runs, a missing schema must not take
    // the existing monitoring writes down with it: core rows are dropped for
    // that minute and the next flush tries again. No fake rows, ever.
    if (coreRows.length > 0) {
      try {
        await this.sink.writeCoreMetrics(coreRows)
      } catch {
        // schema not migrated yet — observation only, never fatal
      }
    }

    if (this.gauges) {
      // One gauge sample per flush — exact counts, never per request. A gauge
      // is a measurement of NOW: it is attributed only to the minute that just
      // closed. Older closed minutes stay missing (UNKNOWN gaps), never filled
      // with a later value dressed as history. A failed read is a missing row.
      const latestClosed = [...closedAll].sort().pop()
      if (latestClosed) {
        try {
          const sample = await this.gauges()
          const gaugeRows: CoreGaugeRow[] = sample.cores.map((gauge) => ({
            minute: latestClosed,
            instance_id: this.instanceId,
            core_id: gauge.coreId,
            queue_depth: gauge.queueDepth,
            processing_count: gauge.processingCount,
            stuck_count: gauge.stuckCount,
            retry_count: gauge.retryCount,
            queue_wait_total_ms: gauge.queueWaitTotalMs,
          }))
          if (gaugeRows.length > 0) await this.sink.writeCoreGauges(gaugeRows)
          if (sample.db) {
            await this.sink.writeDbMetrics({
              minute: latestClosed,
              instance_id: this.instanceId,
              ...sample.db,
            })
          }
        } catch {
          // The gauge is observation only; the next minute tries again.
        }
      }
    }

    this.lastFlushedMinute = currentMinute
    return requestRows.length
  }
}

/** The default sink: one batched UPSERT per table. */
export const supabaseMetricsSink: MetricsSink = {
  async writeRequestMetrics(rows) {
    const { error } = await supabase
      .from('request_metrics_minute')
      .upsert(rows, { onConflict: 'minute,instance_id,route,method,status_class' })
    if (error) throw error
  },
  async writeActiveUsers(rows) {
    const { error } = await supabase
      .from('active_users_minute')
      .upsert(rows, { onConflict: 'minute,user_hash', ignoreDuplicates: true })
    if (error) throw error
  },
  async writeActiveWorkspaces(rows) {
    const { error } = await supabase
      .from('active_workspaces_minute')
      .upsert(rows, { onConflict: 'minute,workspace_hash', ignoreDuplicates: true })
    if (error) throw error
  },
  async writeInstanceMetrics(row) {
    const { error } = await supabase
      .from('instance_metrics_minute')
      .upsert(row, { onConflict: 'minute,instance_id' })
    if (error) throw error
  },
  async writeCoreMetrics(rows) {
    const { error } = await supabase
      .from('core_metrics_minute')
      .upsert(rows, { onConflict: 'minute,instance_id,core_id,operation_group' })
    if (error) throw error
  },
  async writeCoreGauges(rows) {
    const { error } = await supabase
      .from('core_gauges_minute')
      .upsert(rows, { onConflict: 'minute,instance_id,core_id' })
    if (error) throw error
  },
  async writeDbMetrics(row) {
    const { error } = await supabase
      .from('db_metrics_minute')
      .upsert(row, { onConflict: 'minute,instance_id' })
    if (error) throw error
  },
}

/** The live instance sample, beside what the heartbeat already reports. */
export function currentInstanceSample(
  system: { cpuPercent: number; memoryPercent: number; inflightRequests: number },
  pressure: { eventLoopDelayMs: number; heapUsedBytes: number; rssBytes: number },
): InstanceSample {
  return {
    cpuPercent: system.cpuPercent,
    memoryPercent: system.memoryPercent,
    eventLoopP99Ms: pressure.eventLoopDelayMs,
    heapUsedBytes: pressure.heapUsedBytes,
    heapTotalBytes: process.memoryUsage().heapTotal,
    rssBytes: pressure.rssBytes,
    inflightRequests: system.inflightRequests,
    // Open Sync WebSockets are devices, not viewers — the wall shows them apart.
    syncSockets: cursorWatcher.socketCount,
  }
}
