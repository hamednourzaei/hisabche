// ============================================
// backend/src/__tests__/monitoring-route-metrics.test.ts
//
// V63 · M-2 — the traffic collector.
//
//  1. a duration lands in the right histogram bucket;
//  2. the key is the Fastify ROUTE TEMPLATE, never the raw URL;
//  3. only CLOSED minutes flush, and a minute flushes once;
//  4. a user id leaves this process only as a SHA-256 hash;
//  5. one response with no content-length makes the minute's bytes UNKNOWN
//     (null), never a made-up zero.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  DURATION_BUCKETS_MS,
  RouteMetricsCollector,
  bucketIndex,
  hashIdentity,
  statusClassOf,
  type ActiveUserRow,
  type ActiveWorkspaceRow,
  type InstanceMinuteRow,
  type MetricsSink,
  type RequestMetricRow,
} from '../services/monitoring/route-metrics'

class RecordingSink implements MetricsSink {
  requests: RequestMetricRow[] = []
  users: ActiveUserRow[] = []
  workspaces: ActiveWorkspaceRow[] = []
  instances: InstanceMinuteRow[] = []

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
}

function collectorAt(clock: { now: Date }) {
  const sink = new RecordingSink()
  const collector = new RouteMetricsCollector({
    sink,
    instanceId: 'i-test',
    now: () => clock.now,
    sample: () => ({
      cpuPercent: 12,
      memoryPercent: 34,
      eventLoopP99Ms: 5,
      heapUsedBytes: 100,
      heapTotalBytes: 200,
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

describe('the Fastify hook', () => {
  it('passes the route template, not request.url', () => {
    const source = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
    expect(source).toContain("route: request.routeOptions.url ?? '(unmatched)'")
    expect(source).not.toContain('route: request.url')
    expect(source).toContain('routeMetrics.flushClosedMinutes()')
  })
})
