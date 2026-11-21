// ============================================
// backend/src/routes/admin-monitor.routes.ts
//
// V63 · M-3 … M-7 — the monitor tab, the TV wall, and its token.
// Unified Core Observability (21 Nov 2026) — the core dimension + a real
// authenticated SSE stream with a real frontend consumer (use-admin-monitor).
//
//   GET    /api/admin/monitor/overview        live totals + db vitals + alerts
//   GET    /api/admin/monitor/series          history (1h / 24h / 7d / 30d / 90d)
//   GET    /api/admin/monitor/cores           every core, pressure + UNKNOWN
//   GET    /api/admin/monitor/cores/:id/series  per-core history
//   GET    /api/admin/monitor/alert-events    raised/resolved alert history
//   GET    /api/admin/monitor/stream          SSE behind operations.monitor.read
//   PUT    /api/admin/monitor/alerts/:id      threshold, duration, on/off
//   GET    /api/admin/monitor/wall-tokens     metadata only — never a token
//   POST   /api/admin/monitor/wall-tokens     create (step-up), value shown once
//   DELETE /api/admin/monitor/wall-tokens/:id revoke (step-up)
//
//   GET    /api/wall/overview                 aggregate counts only (x-wall-token)
//
// ⚠️ Stream history. The OLD admin/wall SSE streams were removed on 12 Nov
// because they had no consumer. The stream returns ONLY because this mission
// ships the endpoint AND the frontend consumer AND connection management
// together (mission §6). One shared sampler timer serves every subscriber —
// never one timer per viewer (job-authority-guard classifies this file as the
// legitimate SSE sampler location). The credential is the normal Authorization
// header via fetch-based SSE; a token in the query string is forbidden.
//
// ⚠️ The /api/wall/* routes are PUBLIC BY DESIGN and are not admin routes. The
// credential they accept is a wall token, which reaches nothing else. That is
// why they live outside /api/admin/ and why the S-1 chain does not apply to
// them; the tests assert they cannot be used against an admin route.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { adminRoute } from '../middleware/admin-rbac.middleware'
import {
  MonitoringService,
  rangeWindow,
  type AlertEvaluation,
  type CoreSnapshot,
  type MonitorRange,
} from '../services/monitoring/monitoring.service'
import { WallTokenService } from '../services/monitoring/wall-token.service'

const RANGES = ['1h', '24h', '7d', '30d', '90d'] as const

const seriesQuery = z.object({
  range: z.enum(RANGES).default('1h'),
})

const alertBody = z.object({
  threshold: z.number().finite(),
  durationMinutes: z.number().int().min(1).max(1440),
  isEnabled: z.boolean(),
  severity: z.enum(['warning', 'critical']),
})

const wallTokenBody = z.object({
  label: z.string().min(1).max(80),
  expiresAt: z.string().datetime(),
  ipCidr: z.string().max(64).optional(),
})

const SNAPSHOT_TTL_MS = 10_000

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof z.ZodError) {
    return reply.code(400).send({
      error: err.errors[0]?.message ?? 'Validation failed',
      code: 'VALIDATION_FAILED',
    })
  }
  const e = err as { statusCode?: number; code?: string; message?: string } | undefined
  const status = typeof e?.statusCode === 'number' ? e.statusCode : 500
  const message = status < 500 && e?.message ? e.message : 'Internal server error'
  return reply.code(status).send({ error: message, code: e?.code ?? 'ERROR' })
}

/** The wall's only credential: the `x-wall-token` header (never a cookie, never the URL). */
function wallTokenFrom(request: FastifyRequest): string | null {
  const header = request.headers['x-wall-token']
  return typeof header === 'string' && header.length >= 20 ? header : null
}

async function sampleSnapshot(): Promise<unknown> {
  const [overview, vitals, alerts] = await Promise.all([
    MonitoringService.overview(),
    MonitoringService.dbVitals(),
    MonitoringService.evaluateAlerts({ notify: false }),
  ])
  return { overview, vitals, alerts }
}

/**
 * One sample per 10 s for every viewer (admins and walls alike): the first
 * request in a window samples, the rest — and concurrent ones — share it.
 * A failed sample is not cached (the next request tries again).
 */
let shared: { at: number; value: Promise<unknown> } | null = null
async function sharedSnapshot(): Promise<unknown> {
  const now = Date.now()
  if (shared && now - shared.at < SNAPSHOT_TTL_MS) return shared.value
  const value = sampleSnapshot()
  shared = { at: now, value }
  value.catch(() => {
    if (shared?.value === value) shared = null
  })
  return value
}

/** The core snapshot shares the same 10 s single-flight contract. */
let sharedCores: { at: number; value: Promise<CoreSnapshot> } | null = null
async function sharedCoreSnapshot(): Promise<CoreSnapshot> {
  const now = Date.now()
  if (sharedCores && now - sharedCores.at < SNAPSHOT_TTL_MS) return sharedCores.value
  const value = MonitoringService.coreSnapshot()
  sharedCores = { at: now, value }
  value.catch(() => {
    if (sharedCores?.value === value) sharedCores = null
  })
  return value
}

// ─── The authenticated admin stream ──────────────────────────────────────────
// ONE timer for every subscriber. Started by the first connection, cleared
// when the last one leaves. A slow consumer is disconnected (latest-wins
// backpressure); its client reconnects with backoff and gets a fresh snapshot.

const MAX_ADMIN_STREAMS = 20
const STREAM_TICK_MS = 10_000

interface StreamSubscriber {
  request: FastifyRequest
  reply: FastifyReply
  /** Consecutive ticks that ended with a full socket buffer (backpressure). */
  stalledTicks: number
}

const streamSubscribers = new Set<StreamSubscriber>()
let streamTimer: NodeJS.Timeout | null = null
let streamTick = 0
let lastBreaching = new Set<string>()

function sseWrite(
  subscriber: StreamSubscriber,
  event: string,
  data: Record<string, unknown>,
): boolean {
  const raw = subscriber.reply.raw
  if (raw.destroyed || raw.writableEnded) return false
  // write() === false means the kernel buffer is full: a slow viewer must not
  // stall the sampler or grow memory without bound. Disconnect; it reconnects.
  return raw.write(`event: ${event}\ndata: ${JSON.stringify({ v: 1, ...data })}\n\n`)
}

function removeSubscriber(subscriber: StreamSubscriber): void {
  if (!streamSubscribers.delete(subscriber)) return
  // End the dropped connection so its client reconnects with a fresh snapshot
  // instead of waiting on a socket nobody writes to anymore.
  const raw = subscriber.reply.raw
  if (!raw.destroyed && !raw.writableEnded) raw.end()
  if (streamSubscribers.size === 0 && streamTimer) {
    clearInterval(streamTimer)
    streamTimer = null
    lastBreaching = new Set()
  }
}

function alertKey(evaluation: AlertEvaluation): string {
  return `${evaluation.rule.id}\u0000${evaluation.coreId}`
}

async function streamSample(): Promise<void> {
  streamTick += 1
  let snapshot: { overview: unknown; vitals: unknown; alerts: AlertEvaluation[] }
  let cores: CoreSnapshot
  try {
    const [base, coreSnapshot] = await Promise.all([sharedSnapshot(), sharedCoreSnapshot()])
    snapshot = base as typeof snapshot
    cores = coreSnapshot
  } catch {
    for (const subscriber of [...streamSubscribers]) {
      if (!sseWrite(subscriber, 'stream.error', { message: 'sample unavailable' })) {
        removeSubscriber(subscriber)
      }
    }
    return
  }

  // Alert transitions are derived from the SAME evaluations the screen shows —
  // observation only, no side effects (the scheduler owns notification).
  const breaching = new Set(
    snapshot.alerts.filter((entry) => entry.state === 'breaching').map(alertKey),
  )
  const raised: Array<{ ruleId: string; coreId: string; metric: string; severity: string }> = []
  const resolved: Array<{ ruleId: string; coreId: string; metric: string }> = []
  for (const entry of snapshot.alerts) {
    const key = alertKey(entry)
    if (entry.state === 'breaching' && !lastBreaching.has(key)) {
      raised.push({
        ruleId: entry.rule.id,
        coreId: entry.coreId,
        metric: entry.rule.metric,
        severity: entry.rule.severity,
      })
    }
  }
  for (const key of lastBreaching) {
    if (!breaching.has(key)) {
      const [ruleId, coreId] = key.split('\u0000') as [string, string]
      const rule = snapshot.alerts.find((entry) => entry.rule.id === ruleId)
      resolved.push({ ruleId, coreId, metric: rule?.rule.metric ?? '' })
    }
  }
  lastBreaching = breaching

  for (const subscriber of [...streamSubscribers]) {
    // A write() === false only means the kernel buffer is full RIGHT NOW — a
    // 20 KB payload exceeds the 16 KB high-water mark even for a healthy local
    // client. Disconnect only a consumer that is STILL stalled two ticks later
    // (20 s); latest-wins, its client reconnects and gets a fresh snapshot.
    if (subscriber.stalledTicks >= 2) {
      removeSubscriber(subscriber)
      continue
    }
    let ok = sseWrite(subscriber, 'core.metrics', {
      at: cores.generatedAt,
      cores: cores.cores,
      counts: cores.counts,
    })
    ok = sseWrite(subscriber, 'instance.metrics', { instances: cores.instances }) && ok
    ok = sseWrite(subscriber, 'database.metrics', { db: cores.db, vitals: snapshot.vitals }) && ok
    for (const event of raised) ok = sseWrite(subscriber, 'alert.raised', event) && ok
    for (const event of resolved) ok = sseWrite(subscriber, 'alert.resolved', event) && ok
    // A heartbeat every other tick keeps proxies from closing an idle stream
    // and gives the client a stale-data clock even when nothing changed.
    if (streamTick % 2 === 0)
      ok = sseWrite(subscriber, 'heartbeat', { at: new Date().toISOString() }) && ok
    subscriber.stalledTicks = ok ? 0 : subscriber.stalledTicks + 1
  }
}

function startStreamTimer(): void {
  if (streamTimer) return
  streamTimer = setInterval(() => {
    void streamSample()
  }, STREAM_TICK_MS)
}

/** Test seam: the live subscriber count (cleanup and cap assertions). */
export function adminStreamSubscriberCount(): number {
  return streamSubscribers.size
}

export default async function adminMonitorRoutes(fastify: FastifyInstance) {
  const read = adminRoute('operations.monitor.read')
  const write = adminRoute('operations.monitor.write', { stepUp: true })

  // ─── Admin reads ───────────────────────────────────────────────────
  fastify.get('/api/admin/monitor/overview', { preHandler: read }, async (_req, reply) => {
    try {
      return reply.send(await sharedSnapshot())
    } catch (err) {
      return handleError(reply, err)
    }
  })

  fastify.get('/api/admin/monitor/series', { preHandler: read }, async (req, reply) => {
    try {
      const { range } = seriesQuery.parse(req.query)
      const window = rangeWindow(range as MonitorRange)
      return reply.send({
        range,
        unit: window.unit,
        since: window.since.toISOString(),
        points: await MonitoringService.series(range as MonitorRange),
      })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  // ─── Unified core reads ──────────────────────────────────────────────
  fastify.get('/api/admin/monitor/cores', { preHandler: read }, async (_req, reply) => {
    try {
      return reply.send(await sharedCoreSnapshot())
    } catch (err) {
      return handleError(reply, err)
    }
  })

  fastify.get(
    '/api/admin/monitor/cores/:coreId/series',
    { preHandler: read },
    async (req, reply) => {
      const { coreId } = req.params as { coreId: string }
      try {
        const { range } = seriesQuery.parse(req.query)
        const window = rangeWindow(range as MonitorRange)
        return reply.send({
          coreId,
          range,
          unit: window.unit,
          since: window.since.toISOString(),
          points: await MonitoringService.coreSeries(coreId, range as MonitorRange),
        })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  fastify.get('/api/admin/monitor/alert-events', { preHandler: read }, async (req, reply) => {
    try {
      const { limit } = z
        .object({ limit: z.coerce.number().int().min(1).max(200).default(50) })
        .parse(req.query)
      return reply.send({ events: await MonitoringService.alertEvents(limit) })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  // ─── The live stream (authenticated; fetch-based SSE on the client) ──
  fastify.get('/api/admin/monitor/stream', { preHandler: read }, async (req, reply) => {
    if (streamSubscribers.size >= MAX_ADMIN_STREAMS) {
      return reply.code(503).send({
        error: 'Too many monitor streams',
        code: 'STREAM_LIMIT',
      })
    }
    // Hijack: the reply lives as long as the connection, outside Fastify's
    // serialization. The onRequest inflight bookkeeping already released via
    // raw 'close', so a long-lived stream is not a ghost request.
    reply.hijack()
    const raw = reply.raw
    // A monitor stream lives for minutes: the server's 30 s connection timeout
    // must not guillotine it. The heartbeat keeps proxies awake instead.
    req.raw.socket.setTimeout(0)
    req.raw.socket.setNoDelay(true)
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    const subscriber: StreamSubscriber = { request: req, reply, stalledTicks: 0 }
    streamSubscribers.add(subscriber)
    startStreamTimer()
    req.raw.on('close', () => removeSubscriber(subscriber))

    // Initial snapshot: the client renders immediately, then lives on events.
    try {
      const [base, cores] = await Promise.all([sharedSnapshot(), sharedCoreSnapshot()])
      const snapshot = base as { overview: unknown; vitals: unknown; alerts: AlertEvaluation[] }
      sseWrite(subscriber, 'snapshot', {
        at: cores.generatedAt,
        overview: snapshot.overview,
        vitals: snapshot.vitals,
        alerts: snapshot.alerts,
        cores: cores.cores,
        counts: cores.counts,
        instances: cores.instances,
        db: cores.db,
      })
    } catch {
      sseWrite(subscriber, 'stream.error', { message: 'initial snapshot unavailable' })
    }
  })

  fastify.put('/api/admin/monitor/alerts/:id', { preHandler: write }, async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const body = alertBody.parse(req.body)
      await MonitoringService.updateAlertRule({ id, ...body })
      return reply.send({ success: true })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  // ─── Wall tokens ───────────────────────────────────────────────────
  fastify.get('/api/admin/monitor/wall-tokens', { preHandler: read }, async (_req, reply) => {
    try {
      return reply.send({ tokens: await WallTokenService.list() })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  fastify.post('/api/admin/monitor/wall-tokens', { preHandler: write }, async (req, reply) => {
    const body = wallTokenBody.parse(req.body)
    try {
      const created = await WallTokenService.create({
        label: body.label,
        expiresAt: body.expiresAt,
        ipCidr: body.ipCidr,
        actorEmail: req.user?.email ?? 'admin',
      })
      // ⚠️ The ONLY response that ever contains `token`. It is not stored in
      // plaintext anywhere and cannot be read again.
      return reply.send(created)
    } catch (err) {
      return handleError(reply, err)
    }
  })

  fastify.delete(
    '/api/admin/monitor/wall-tokens/:id',
    { preHandler: write },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      try {
        await WallTokenService.revoke(id, req.user?.email ?? 'admin')
        return reply.send({ success: true })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  // ─── The TV wall (public by design; wall token is the credential) ──
  fastify.get('/api/wall/overview', async (request, reply) => {
    const token = wallTokenFrom(request)
    if (!token || !(await WallTokenService.verify(token, request.ip))) {
      return reply.code(401).send({ error: 'Wall token required', code: 'WALL_TOKEN_REQUIRED' })
    }
    try {
      // ⚠️ Aggregates only. No customer, no money, no name — by construction,
      // because the snapshot has no such fields.
      return reply.send(await sharedSnapshot())
    } catch (err) {
      return handleError(reply, err)
    }
  })
}
