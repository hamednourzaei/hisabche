// ============================================
// backend/src/services/monitoring/route-metrics.ts
//
// V63 · M-1/M-2/M-4 — cheap, aggregated-at-the-source traffic metrics.
//
// WHAT IS COUNTED
//   one bucket per (route TEMPLATE, method, status class) per minute, plus one
//   row per instance per minute, plus the SET SIZE of hashed user and workspace
//   ids seen in that minute.
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

export type StatusClass = '1xx' | '2xx' | '3xx' | '4xx' | '5xx'

/** Fixed histogram: <50, <100, <250, <500, <1000, >=1000 ms. */
export const DURATION_BUCKETS_MS = [50, 100, 250, 500, 1000] as const

export function statusClassOf(statusCode: number): StatusClass {
  if (statusCode >= 500) return '5xx'
  if (statusCode >= 400) return '4xx'
  if (statusCode >= 300) return '3xx'
  if (statusCode >= 200) return '2xx'
  return '1xx'
}

/** Index into the six-slot histogram. */
export function bucketIndex(durationMs: number): number {
  for (let index = 0; index < DURATION_BUCKETS_MS.length; index += 1) {
    if (durationMs < DURATION_BUCKETS_MS[index]!) return index
  }
  return DURATION_BUCKETS_MS.length
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
  cpu_percent: number
  memory_percent: number
  event_loop_p99_ms: number
  heap_used_bytes: number
  heap_total_bytes: number
  inflight_requests: number
  sync_sockets: number
}

export interface InstanceSample {
  cpuPercent: number
  memoryPercent: number
  eventLoopP99Ms: number
  heapUsedBytes: number
  heapTotalBytes: number
  inflightRequests: number
  syncSockets: number
}

export interface MetricsSink {
  writeRequestMetrics(rows: RequestMetricRow[]): Promise<void>
  writeActiveUsers(rows: ActiveUserRow[]): Promise<void>
  writeActiveWorkspaces(rows: ActiveWorkspaceRow[]): Promise<void>
  writeInstanceMetrics(row: InstanceMinuteRow): Promise<void>
}

interface MutableBucket {
  count: number
  bytesOut: number | null
  durationSumMs: number
  durationMaxMs: number
  buckets: number[]
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

export class RouteMetricsCollector {
  private readonly requests = new Map<string, Map<string, MutableBucket>>()
  private readonly users = new Map<string, Set<string>>()
  private readonly workspaces = new Map<string, Set<string>>()
  private readonly instanceId: string
  private readonly sink: MetricsSink
  private readonly now: () => Date
  private readonly sample: (() => InstanceSample) | null
  private lastFlushedMinute: string | null = null

  constructor(options: {
    sink: MetricsSink
    instanceId?: string
    now?: () => Date
    sample?: (() => InstanceSample) | null
  }) {
    this.sink = options.sink
    this.instanceId = options.instanceId ?? INSTANCE_LABEL
    this.now = options.now ?? (() => new Date())
    this.sample = options.sample === undefined ? null : options.sample
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
    const closedUsers = [...this.users.keys()].filter((minute) => minute < currentMinute)
    const closedWorkspaces = [...this.workspaces.keys()].filter((minute) => minute < currentMinute)

    const closedAll = new Set([...closed, ...closedUsers, ...closedWorkspaces])
    if (closedAll.size === 0) return 0
    if (this.lastFlushedMinute === currentMinute && closedAll.size === 0) return 0

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
          cpu_percent: value.cpuPercent,
          memory_percent: value.memoryPercent,
          event_loop_p99_ms: value.eventLoopP99Ms,
          heap_used_bytes: value.heapUsedBytes,
          heap_total_bytes: value.heapTotalBytes,
          inflight_requests: value.inflightRequests,
          sync_sockets: value.syncSockets,
        })
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
}

/** The live instance sample, beside what the heartbeat already reports. */
export function currentInstanceSample(
  system: { cpuPercent: number; memoryPercent: number; inflightRequests: number },
  pressure: { eventLoopDelayMs: number; heapUsedBytes: number },
): InstanceSample {
  return {
    cpuPercent: system.cpuPercent,
    memoryPercent: system.memoryPercent,
    eventLoopP99Ms: pressure.eventLoopDelayMs,
    heapUsedBytes: pressure.heapUsedBytes,
    heapTotalBytes: process.memoryUsage().heapTotal,
    inflightRequests: system.inflightRequests,
    // Open Sync WebSockets are devices, not viewers — the wall shows them apart.
    syncSockets: cursorWatcher.socketCount,
  }
}
