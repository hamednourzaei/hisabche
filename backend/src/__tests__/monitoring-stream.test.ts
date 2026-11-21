// ============================================
// backend/src/__tests__/monitoring-stream.test.ts
//
// The authenticated admin monitor stream + core reads (mission §6, §8):
//
//  1. anonymous and non-admin requests are refused (401 / 403);
//  2. GET /cores lists EVERY registered core — unmeasured ones are UNKNOWN
//     with a reason, never dropped and never «healthy at 0»;
//  3. offline instances stay visible with lastSeen;
//  4. an unknown core id is a 404; 30d is a valid range;
//  5. the SSE stream sends an initial versioned snapshot, then periodic
//     core.metrics + heartbeat from ONE shared sampler;
//  6. disconnecting cleans the subscriber up (no ghost connections);
//  7. the connection cap answers 503 STREAM_LIMIT.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb } from './helpers/fake-supabase'
import { CORES } from '../services/monitoring/core-registry'

process.env.ADMIN_ALLOWED_EMAILS = 'super@hisabche.com'

const db = new FakeDatabase()

const SUPER_ADMIN = {
  id: '22222222-2222-4222-8222-222222222222',
  token: 'token-super-admin',
  email: 'super@hisabche.com',
}
const SHOPKEEPER = {
  id: '11111111-1111-4111-8111-111111111111',
  token: 'token-shopkeeper',
  email: 'shopkeeper@example.com',
}

const users = new Map<string, { id: string; email: string }>([
  [SUPER_ADMIN.token, { id: SUPER_ADMIN.id, email: SUPER_ADMIN.email }],
  [SHOPKEEPER.token, { id: SHOPKEEPER.id, email: SHOPKEEPER.email }],
])

vi.mock('../db', () => createFakeDb(db, users))

let app: FastifyInstance
let base = ''
let adminStreamSubscriberCount: () => number

const asAdmin = () => ({ authorization: `Bearer ${SUPER_ADMIN.token}` })

/** One measured core (sales), one gauge (jobs), one live + one dead instance. */
function coreSnapshotPayload() {
  const now = new Date()
  const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000).toISOString()
  const deadSeen = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  return {
    since: new Date(now.getTime() - 5 * 60_000).toISOString(),
    cores: [
      {
        core_id: 'sales',
        operations: 100,
        success: 99,
        errors: 1,
        client_errors: 0,
        duration_sum_ms: 5000,
        duration_max_ms: 90,
        duration_buckets: [0, 100, 0, 0, 0, 0],
        inflight_max: 4,
        concurrency_max: 6,
        timeouts: 0,
        dependency_wait_total_ms: 1000,
        dependency_measured_count: 50,
        last_minute: minute,
      },
    ],
    gauges: [
      {
        core_id: 'jobs',
        minute,
        queue_depth: 12,
        processing_count: 2,
        stuck_count: 1,
        retry_count: 3,
        queue_wait_total_ms: null,
      },
    ],
    instances: [
      {
        instance_id: 'i-live',
        last_seen: minute,
        process_role: 'api',
        cpu_percent: 10,
        memory_percent: 20,
        event_loop_p99_ms: 5,
        heap_used_bytes: 100,
        heap_total_bytes: 200,
        rss_bytes: 300,
        inflight_requests: 1,
        sync_sockets: 0,
      },
      {
        instance_id: 'i-dead',
        last_seen: deadSeen,
        process_role: 'worker',
        cpu_percent: 5,
        memory_percent: 10,
        event_loop_p99_ms: 2,
        heap_used_bytes: 50,
        heap_total_bytes: 100,
        rss_bytes: 150,
        inflight_requests: 0,
        sync_sockets: 0,
      },
    ],
    db: null,
  }
}

beforeAll(async () => {
  db.seed('admin_accounts', [
    {
      id: 'acc-1',
      user_id: SUPER_ADMIN.id,
      email: SUPER_ADMIN.email,
      role: 'SUPER',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ])
  db.seed('metric_alert_rules', [])
  db.seed('metric_alert_events', [])
  db.rpc('admin_core_monitor_snapshot', () => coreSnapshotPayload())
  db.rpc('admin_monitor_overview', () => ({
    since: new Date().toISOString(),
    requests: 100,
    errors5xx: 1,
    bytesOut: null,
    bytesUnknownRows: 0,
    onlineUsers: 0,
    onlineWorkspaces: 0,
    statusClasses: [],
    topRoutesByTime: [],
    topRoutesByBytes: [],
    instances: [],
  }))
  db.rpc('admin_db_vitals', () => ({
    database: { sizeBytes: 1000 },
    connections: { active: 1, idle: 1, total: 2, max: 100 },
    cache: { hitRatio: 0.99 },
    locks: { waiting: 0, longestTransactionSeconds: 0 },
    replication: { lagSeconds: null },
    deadlocks: 0,
    tempBytes: 0,
    statements: null,
    statementsUnavailableReason: 'pg_stat_statements is not installed',
  }))
  db.rpc('admin_monitor_series', () => [])
  db.rpc('admin_core_monitor_series', () => [
    {
      bucket: new Date().toISOString(),
      operations: 100,
      errors: 1,
      client_errors: 0,
      avg_ms: 50,
      duration_buckets: [0, 100, 0, 0, 0, 0],
      timeouts: 0,
      inflight_max: 4,
      queue_depth: null,
      dep_wait_avg_ms: 20,
    },
  ])

  const { buildServer } = await import('../index')
  app = await buildServer({ testRuntime: true })
  const routes = await import('../routes/admin-monitor.routes')
  adminStreamSubscriberCount = routes.adminStreamSubscriberCount
  await app.listen({ port: 0, host: '127.0.0.1' })
  const address = app.server.address()
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
}, 60_000)

afterAll(async () => {
  await app?.close()
})

describe('core reads', () => {
  it('refuses anonymous and non-admin callers', async () => {
    const anonymous = await app.inject({ method: 'GET', url: '/api/admin/monitor/cores' })
    expect(anonymous.statusCode).toBe(401)
    const shopkeeper = await app.inject({
      method: 'GET',
      url: '/api/admin/monitor/cores',
      headers: { authorization: `Bearer ${SHOPKEEPER.token}` },
    })
    expect(shopkeeper.statusCode).toBe(403)
  })

  it('lists every registered core; unmeasured cores are UNKNOWN with a reason', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/monitor/cores',
      headers: asAdmin(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      cores: Array<{
        id: string
        status: string
        pressure: number | null
        reason: string | null
        queueDepth: number | null
      }>
      counts: { healthy: number; unknown: number }
      instances: Array<{ instanceId: string; online: boolean; processRole: string }>
    }
    expect(body.cores).toHaveLength(CORES.length)
    const sales = body.cores.find((core) => core.id === 'sales')
    expect(sales?.status).not.toBe('unknown')
    expect(sales?.pressure).not.toBeNull()
    const ai = body.cores.find((core) => core.id === 'ai')
    expect(ai?.status).toBe('unknown')
    expect(ai?.pressure).toBeNull()
    expect(ai?.reason).toBeTruthy()
    // sales is measured by traffic; jobs is measured by its queue gauge even
    // without HTTP traffic (worker operations are not route observations).
    expect(body.counts.unknown).toBe(CORES.length - 2)
    const jobs = body.cores.find((core) => core.id === 'jobs')
    expect(jobs?.pressure).not.toBeNull()
    expect(jobs?.queueDepth).toBe(12)

    const dead = body.instances.find((instance) => instance.instanceId === 'i-dead')
    expect(dead?.online).toBe(false)
    expect(dead?.processRole).toBe('worker')
    const live = body.instances.find((instance) => instance.instanceId === 'i-live')
    expect(live?.online).toBe(true)
  })

  it('an unknown core id is a 404, and 30d is a valid hourly range', async () => {
    const missing = await app.inject({
      method: 'GET',
      url: '/api/admin/monitor/cores/not-a-core/series',
      headers: asAdmin(),
    })
    expect(missing.statusCode).toBe(404)

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/monitor/cores/sales/series?range=30d',
      headers: asAdmin(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { unit: string; points: Array<{ p95: { value: number } | null }> }
    expect(body.unit).toBe('hour')
    expect(body.points[0]?.p95?.value).toBe(100)
  })

  it('exports the whole core log as CSV and JSON for a chosen range', async () => {
    const anonymous = await app.inject({
      method: 'GET',
      url: '/api/admin/monitor/cores/export',
    })
    expect(anonymous.statusCode).toBe(401)

    const shopkeeper = await app.inject({
      method: 'GET',
      url: '/api/admin/monitor/cores/export',
      headers: { authorization: `Bearer ${SHOPKEEPER.token}` },
    })
    expect(shopkeeper.statusCode).toBe(403)

    const csv = await app.inject({
      method: 'GET',
      url: '/api/admin/monitor/cores/export?format=csv&range=24h',
      headers: asAdmin(),
    })
    expect(csv.statusCode).toBe(200)
    expect(String(csv.headers['content-type'])).toContain('text/csv')
    expect(String(csv.headers['content-disposition'])).toContain('hisabche-cores-24h-')
    expect(csv.body.charCodeAt(0)).toBe(0xfeff)
    expect(csv.body).toContain('row_type,generated_at,range,unit,bucket,core_id')
    // Every registered core is present — measured or UNKNOWN.
    expect(csv.body).toContain(',sales,')
    expect(csv.body).toContain(',ai,')

    const json = await app.inject({
      method: 'GET',
      url: '/api/admin/monitor/cores/export?format=json&range=7d',
      headers: asAdmin(),
    })
    expect(json.statusCode).toBe(200)
    const body = json.json() as {
      schema: string
      range: string
      cores: unknown[]
      series: Record<string, unknown[]>
      alertEvents: unknown[]
      alertEventsError: string | null
    }
    expect(body.schema).toBe('hisabche.core-export.v1')
    expect(body.range).toBe('7d')
    expect(body.cores).toHaveLength(CORES.length)
    expect(body.series.sales).toHaveLength(1)
    expect(body.alertEvents).toEqual([])
    expect(body.alertEventsError).toBeNull()
  }, 30_000)
})

describe('the admin SSE stream', () => {
  it('requires admin authentication — a wall token is not a credential', async () => {
    const anonymous = await app.inject({ method: 'GET', url: '/api/admin/monitor/stream' })
    expect(anonymous.statusCode).toBe(401)
  })

  it('sends a versioned initial snapshot, then periodic events from one sampler', async () => {
    const controller = new AbortController()
    const res = await fetch(`${base}/api/admin/monitor/stream`, {
      headers: asAdmin(),
      signal: controller.signal,
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    // Initial snapshot arrives immediately.
    const first = await reader.read()
    buffer += decoder.decode(first.value, { stream: true })
    expect(buffer).toContain('event: snapshot')
    expect(buffer).toContain('"v":1')
    expect(buffer).toContain('"cores"')

    // The shared sampler ticks every 10 s; the heartbeat lands on tick 2.
    const deadline = Date.now() + 35_000
    while (Date.now() < deadline && !buffer.includes('event: heartbeat')) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })
    }
    expect(buffer).toContain('event: core.metrics')
    expect(buffer).toContain('event: instance.metrics')
    expect(buffer).toContain('event: database.metrics')
    expect(buffer).toContain('event: heartbeat')

    controller.abort()
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(adminStreamSubscriberCount()).toBe(0)
  }, 50_000)

  it('caps concurrent connections with 503 STREAM_LIMIT and cleans up', async () => {
    const controllers: AbortController[] = []
    const readers: Array<ReadableStreamDefaultReader<Uint8Array>> = []
    try {
      for (let index = 0; index < 20; index += 1) {
        const controller = new AbortController()
        controllers.push(controller)
        const res = await fetch(`${base}/api/admin/monitor/stream`, {
          headers: asAdmin(),
          signal: controller.signal,
        })
        expect(res.status).toBe(200)
        const reader = res.body!.getReader()
        readers.push(reader)
        await reader.read() // initial snapshot
      }
      expect(adminStreamSubscriberCount()).toBe(20)

      const overflow = await fetch(`${base}/api/admin/monitor/stream`, { headers: asAdmin() })
      expect(overflow.status).toBe(503)
      expect(await overflow.json()).toMatchObject({ code: 'STREAM_LIMIT' })
    } finally {
      for (const controller of controllers) controller.abort()
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    expect(adminStreamSubscriberCount()).toBe(0)
  }, 60_000)
})
