// ============================================
// backend/src/__tests__/monitoring-route-metrics.test.ts
//
// V63 · M-2 — the traffic collector.
// Unified Core Observability (21 Nov 2026) — the same collector now also
// buckets by core; the original guarantees are unchanged and still asserted.
//
//  1. a duration lands in the right histogram bucket;
//  2. the key is the Fastify ROUTE TEMPLATE, never the raw URL;
//  3. only CLOSED minutes flush, and a minute flushes once;
//  4. a user id leaves this process only as a SHA-256 hash;
//  5. one response with no content-length makes the minute's bytes UNKNOWN
//     (null), never a made-up zero;
//  6. every observation is attributed to exactly one core and one bounded
//     operation group, with success/error split and dependency wait honest.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { DURATION_BUCKETS_MS, bucketIndex } from '../services/monitoring/core-registry'
import {
  RouteMetricsCollector,
  hashIdentity,
  statusClassOf,
  type ActiveUserRow,
  type ActiveWorkspaceRow,
  type CoreGaugeRow,
  type CoreMetricRow,
  type DbMetricRow,
  type InstanceMinuteRow,
  type MetricsSink,
  type RequestMetricRow,
} from '../services/monitoring/route-metrics'

class RecordingSink implements MetricsSink {
  requests: RequestMetricRow[] = []
  users: ActiveUserRow[] = []
  workspaces: ActiveWorkspaceRow[] = []
  instances: InstanceMinuteRow[] = []
  cores: CoreMetricRow[] = []
  gauges: CoreGaugeRow[] = []
  db: DbMetricRow[] = []

  async writeRequestMetrics(rows: RequestMetricRow[]): Promise<void> {
    this.requests.push(...rows)
  }
  async writeActiveUsers(rows: ActiveUserRow[]): Promise<void> {
    this.users.push(...rows)
  }
  async writeActiveWorkspaces(rows: ActiveWorkspaceRow[]): Promise<void> {
    this.workspaces.push(...rows)
  }
  async writeInstanceMetrics(row: InstanceMinuteRow): Promise<void> {
    this.instances.push(row)
  }
  async writeCoreMetrics(rows: CoreMetricRow[]): Promise<void> {
    this.cores.push(...rows)
  }
  async writeCoreGauges(rows: CoreGaugeRow[]): Promise<void> {
    this.gauges.push(...rows)
  }
  async writeDbMetrics(row: DbMetricRow): Promise<void> {
    this.db.push(row)
  }
}

function collectorAt(clock: { now: Date }) {
  const sink = new RecordingSink()
  const collector = new RouteMetricsCollector({
    sink,
    instanceId: 'i-test',
    processRole: 'api',
    now: () => clock.now,
    sample: () => ({
      cpuPercent: 12,
      memoryPercent: 34,
      eventLoopP99Ms: 5,
      heapUsedBytes: 100,
      heapTotalBytes: 200,
      rssBytes: 300,
      inflightRequests: 1,
      syncSockets: 2,
    }),
  })
  return { sink, collector }
}

describe('statusClassOf / bucketIndex', () => {
  it('maps a status code to its class', () => {
    expect(statusClassOf(101)).toBe('1xx')
    expect(statusClassOf(204)).toBe('2xx')
    expect(statusClassOf(304)).toBe('3xx')
    expect(statusClassOf(404)).toBe('4xx')
    expect(statusClassOf(503)).toBe('5xx')
  })

  it('puts each duration in the first bucket it is under', () => {
    // Five thresholds ⇒ six slots (0..5); the last slot is «≥ 1000 ms».
    expect(DURATION_BUCKETS_MS.length + 1).toBe(6)
    expect(bucketIndex(0)).toBe(0)
    expect(bucketIndex(49)).toBe(0)
    expect(bucketIndex(DURATION_BUCKETS_MS[0])).toBe(1)
    expect(bucketIndex(999)).toBe(4)
    expect(bucketIndex(5_000)).toBe(5)
  })
})

describe('RouteMetricsCollector', () => {
  it('keys on the twin (route, method, status class) and keeps the template', async () => {
    const clock = { now: new Date('2026-01-01T10:00:05.000Z') }
    const { sink, collector } = collectorAt(clock)

    // ⚠️ The collector is only ever given the template. This is the same value
    // the Fastify hook passes (`request.routeOptions.url`), and it carries no id.
    collector.observe({
      route: '/api/invoices/:id',
      method: 'GET',
      statusCode: 200,
      durationMs: 40,
      bytesOut: 120,
    })
    collector.observe({
      route: '/api/invoices/:id',
      method: 'GET',
      statusCode: 500,
      durationMs: 600,
      bytesOut: 80,
    })

    clock.now = new Date('2026-01-01T10:01:01.000Z')
    await collector.flushClosedMinutes()

    expect(sink.requests).toHaveLength(2)
    const ok = sink.requests.find((row) => row.status_class === '2xx')
    const bad = sink.requests.find((row) => row.status_class === '5xx')
    expect(ok).toMatchObject({ route: '/api/invoices/:id', count: 1, bytes_out: 120 })
    expect(ok?.duration_buckets).toEqual([1, 0, 0, 0, 0, 0])
    // 600 ms is ≥ 500 and < 1000 — the fifth slot, not the overflow slot.
    expect(bad?.duration_buckets).toEqual([0, 0, 0, 0, 1, 0])
  })

  it('flushes only closed minutes, and a minute flushes once', async () => {
    const clock = { now: new Date('2026-01-01T10:00:10.000Z') }
    const { sink, collector } = collectorAt(clock)

    collector.observe({
      route: '/api/products',
      method: 'GET',
      statusCode: 200,
      durationMs: 10,
      bytesOut: 5,
    })

    // Still inside the minute: nothing is written.
    expect(await collector.flushClosedMinutes()).toBe(0)
    expect(sink.requests).toHaveLength(0)

    // The minute closed.
    clock.now = new Date('2026-01-01T10:01:02.000Z')
    expect(await collector.flushClosedMinutes()).toBe(1)
    expect(sink.requests).toHaveLength(1)
    // Its instance row was written too.
    expect(sink.instances).toHaveLength(1)

    // A second call in the same minute writes nothing more.
    expect(await collector.flushClosedMinutes()).toBe(0)
    expect(sink.requests).toHaveLength(1)
    expect(sink.instances).toHaveLength(1)
  })

  it('never lets a raw user or workspace id reach the sink', async () => {
    const clock = { now: new Date('2026-01-01T10:00:10.000Z') }
    const { sink, collector } = collectorAt(clock)
    const userId = '11111111-1111-4111-8111-111111111111'
    const workspaceId = '22222222-2222-4222-8222-222222222222'

    collector.observe({
      route: '/api/invoices',
      method: 'GET',
      statusCode: 200,
      durationMs: 10,
      bytesOut: 5,
      userId,
      workspaceId,
    })
    // The same user twice in one minute is one distinct hash.
    collector.observe({
      route: '/api/invoices',
      method: 'GET',
      statusCode: 200,
      durationMs: 30,
      bytesOut: 5,
      userId,
      workspaceId,
    })

    clock.now = new Date('2026-01-01T10:01:00.000Z')
    await collector.flushClosedMinutes()

    expect(sink.users).toHaveLength(1)
    expect(sink.workspaces).toHaveLength(1)
    expect(sink.users[0]?.user_hash).toBe(hashIdentity(userId))
    expect(sink.workspaces[0]?.workspace_hash).toBe(hashIdentity(workspaceId))
    const serialised = JSON.stringify({ users: sink.users, workspaces: sink.workspaces })
    expect(serialised).not.toContain(userId)
    expect(serialised).not.toContain(workspaceId)
    expect(hashIdentity(userId)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('records unknown bytes as null, never as zero', async () => {
    const clock = { now: new Date('2026-01-01T10:00:10.000Z') }
    const { sink, collector } = collectorAt(clock)

    collector.observe({
      route: '/api/report',
      method: 'GET',
      statusCode: 200,
      durationMs: 10,
      bytesOut: 500,
    })
    collector.observe({
      route: '/api/report',
      method: 'GET',
      statusCode: 200,
      durationMs: 10,
      bytesOut: null,
    })

    clock.now = new Date('2026-01-01T10:01:00.000Z')
    await collector.flushClosedMinutes()

    expect(sink.requests).toHaveLength(1)
    expect(sink.requests[0]?.bytes_out).toBeNull()
    expect(sink.requests[0]?.count).toBe(2)
  })
})

describe('the core dimension (one collector, no second authority)', () => {
  it('attributes each observation to exactly one core and a bounded group', async () => {
    const clock = { now: new Date('2026-01-01T10:00:10.000Z') }
    const { sink, collector } = collectorAt(clock)

    collector.observe({
      route: '/api/invoices/:id',
      method: 'GET',
      statusCode: 200,
      durationMs: 40,
      bytesOut: 10,
    })
    collector.observe({
      route: '/api/invoices',
      method: 'POST',
      statusCode: 201,
      durationMs: 120,
      bytesOut: 10,
    })
    collector.observe({
      route: '/api/invoices/:id/return',
      method: 'POST',
      statusCode: 500,
      durationMs: 900,
      bytesOut: null,
    })
    collector.observe({
      route: '/api/payments/:id/confirm',
      method: 'POST',
      statusCode: 200,
      durationMs: 60,
      bytesOut: 10,
    })

    clock.now = new Date('2026-01-01T10:01:01.000Z')
    await collector.flushClosedMinutes()

    // sales: read(1) + create(1) + action(1); payments: action(1).
    const salesRead = sink.cores.find((r) => r.core_id === 'sales' && r.operation_group === 'read')
    const salesCreate = sink.cores.find(
      (r) => r.core_id === 'sales' && r.operation_group === 'create',
    )
    const salesAction = sink.cores.find(
      (r) => r.core_id === 'sales' && r.operation_group === 'action',
    )
    const paymentsAction = sink.cores.find(
      (r) => r.core_id === 'payments' && r.operation_group === 'action',
    )
    expect(salesRead).toMatchObject({ operation_count: 1, success_count: 1, error_count: 0 })
    expect(salesCreate).toMatchObject({ operation_count: 1, success_count: 1 })
    expect(salesAction).toMatchObject({ operation_count: 1, error_count: 1, success_count: 0 })
    expect(paymentsAction).toMatchObject({ operation_count: 1, success_count: 1 })
    // The route rows still exist beside the core rows — one observation, two
    // projections, never two observations.
    expect(sink.requests).toHaveLength(4)
    const totalCoreOps = sink.cores.reduce((sum, row) => sum + row.operation_count, 0)
    expect(totalCoreOps).toBe(4)
    // No core row carries a route, an id or a url.
    const serialised = JSON.stringify(sink.cores)
    expect(serialised).not.toContain('/api/')
    expect(serialised).not.toContain(':id')
  })

  it('splits 4xx from 5xx and counts timeouts only for 504/408', async () => {
    const clock = { now: new Date('2026-01-01T10:00:10.000Z') }
    const { sink, collector } = collectorAt(clock)
    for (const statusCode of [404, 500, 504, 408]) {
      collector.observe({
        route: '/api/products',
        method: 'GET',
        statusCode,
        durationMs: 10,
        bytesOut: 1,
      })
    }
    clock.now = new Date('2026-01-01T10:01:01.000Z')
    await collector.flushClosedMinutes()
    const row = sink.cores.find((r) => r.core_id === 'inventory')
    // 404 and 408 are client errors; 500 and 504 are server errors; both
    // 504 and 408 are timeouts.
    expect(row).toMatchObject({
      operation_count: 4,
      client_error_count: 2,
      error_count: 2,
      success_count: 0,
      timeout_count: 2,
    })
  })

  it('keeps dependency wait null when nothing measured it, and sums when measured', async () => {
    const clock = { now: new Date('2026-01-01T10:00:10.000Z') }
    const { sink, collector } = collectorAt(clock)
    collector.observe({
      route: '/api/customers',
      method: 'GET',
      statusCode: 200,
      durationMs: 50,
      bytesOut: 1,
    })
    collector.observe({
      route: '/api/customers',
      method: 'GET',
      statusCode: 200,
      durationMs: 80,
      bytesOut: 1,
      dependencyWaitMs: 30,
      inflightAtStart: 2,
    })
    clock.now = new Date('2026-01-01T10:01:01.000Z')
    await collector.flushClosedMinutes()
    const row = sink.cores.find((r) => r.core_id === 'crm')
    expect(row?.dependency_wait_total_ms).toBe(30)
    expect(row?.dependency_measured_count).toBe(1)
    expect(row?.concurrency_max).toBe(3)

    // A minute with no measured wait stays null — never zero.
    const clock2 = { now: new Date('2026-01-01T10:02:10.000Z') }
    const second = collectorAt(clock2)
    second.collector.observe({
      route: '/api/customers',
      method: 'GET',
      statusCode: 200,
      durationMs: 50,
      bytesOut: 1,
    })
    clock2.now = new Date('2026-01-01T10:03:01.000Z')
    await second.collector.flushClosedMinutes()
    expect(second.sink.cores[0]?.dependency_wait_total_ms).toBeNull()
    expect(second.sink.cores[0]?.dependency_measured_count).toBe(0)
  })

  it('tracks live per-core inflight with paired begin/end, floored at zero', () => {
    const clock = { now: new Date('2026-01-01T10:00:10.000Z') }
    const { collector } = collectorAt(clock)
    collector.beginOperation('sales')
    collector.beginOperation('sales')
    collector.beginOperation('payments')
    expect(collector.liveCoreInflight()).toEqual({ sales: 2, payments: 1 })
    collector.endOperation('sales')
    collector.endOperation('sales')
    collector.endOperation('sales') // one extra end never goes negative
    expect(collector.liveCoreInflight()).toEqual({ payments: 1 })
  })

  it('writes gauges once per flush, attributed only to the latest closed minute', async () => {
    const clock = { now: new Date('2026-01-01T10:00:10.000Z') }
    const sink = new RecordingSink()
    let gaugeCalls = 0
    const collector = new RouteMetricsCollector({
      sink,
      instanceId: 'i-test',
      processRole: 'all',
      now: () => clock.now,
      gauges: async () => {
        gaugeCalls += 1
        return {
          cores: [
            {
              coreId: 'jobs',
              queueDepth: 4,
              processingCount: 1,
              stuckCount: 0,
              retryCount: 2,
              queueWaitTotalMs: null,
            },
          ],
          db: {
            connections_active: 3,
            connections_idle: 2,
            connections_total: 5,
            connections_max: 100,
            waiting_locks: 0,
            cache_hit_ratio: 0.99,
            longest_transaction_seconds: 1.2,
            database_size_bytes: 1000,
          },
        }
      },
    })
    collector.observe({
      route: '/api/products',
      method: 'GET',
      statusCode: 200,
      durationMs: 10,
      bytesOut: 1,
    })
    // Two minutes pass but only the observed minute has buckets: the gauge is
    // sampled ONCE and attributed to the latest closed minute WITH data —
    // minutes that never existed stay missing, never filled with a later value.
    clock.now = new Date('2026-01-01T10:03:01.000Z')
    await collector.flushClosedMinutes()
    expect(gaugeCalls).toBe(1)
    expect(sink.gauges).toHaveLength(1)
    expect(sink.gauges[0]?.minute).toBe('2026-01-01T10:00:00.000Z')
    expect(sink.gauges[0]).toMatchObject({ core_id: 'jobs', queue_depth: 4, retry_count: 2 })
    expect(sink.db).toHaveLength(1)
    expect(sink.db[0]?.connections_total).toBe(5)
  })
})

describe('the Fastify hook', () => {
  it('passes the route template, not request.url', () => {
    const source = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
    expect(source).toContain("route: request.routeOptions.url ?? '(unmatched)'")
    expect(source).not.toContain('route: request.url')
    expect(source).toContain('routeMetrics.flushClosedMinutes()')
  })
})
