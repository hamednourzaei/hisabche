// ============================================
// backend/src/routes/admin-monitor.routes.ts
//
// V63 · M-3 … M-7 — the monitor tab, the TV wall, and its token.
//
//   GET    /api/admin/monitor/overview        live totals + db vitals + alerts
//   GET    /api/admin/monitor/series          history (1h / 24h / 7d / 90d)
//   PUT    /api/admin/monitor/alerts/:id      threshold, duration, on/off
//   GET    /api/admin/monitor/wall-tokens     metadata only — never a token
//   POST   /api/admin/monitor/wall-tokens     create (step-up), value shown once
//   DELETE /api/admin/monitor/wall-tokens/:id revoke (step-up)
//
//   GET    /api/wall/overview                 aggregate counts only (x-wall-token)
//
// ⚠️ V63 audit (12 Nov 2026). Both screens POLL every 10 s — the admin monitor
// through React Query, the wall with `x-wall-token`. The SSE streams and the
// cookie exchange (`/api/admin/monitor/stream`, `/api/wall/stream`,
// `/api/wall/session`, `/api/wall/logout`) had no caller; they were removed
// with the process-wide timer they ran on (the job-authority guard forbids a
// timer that is not a claiming poller). «One sampler for every viewer» is now a
// 10-second shared snapshot: N walls cost one sample per 10 s, not N.
// `x-wall-token` is in the CORS allow-list — without it the browser blocked
// every wall request (the BUG-006 pattern) and the TV never showed a number.
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
  type MonitorRange,
} from '../services/monitoring/monitoring.service'
import { WallTokenService } from '../services/monitoring/wall-token.service'

const RANGES = ['1h', '24h', '7d', '90d'] as const

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
