// ============================================
// backend/src/routes/system-metrics.routes.ts
//
//   GET /api/system/metrics          one sample (JSON)
//   GET /api/system/metrics/stream   a sample every 2 s (Server-Sent Events)
//
// Public — the live bar at the top of /docs reads them (docs/monitor-banner.ts).
// Percentages, uptime and in-flight requests only; see utils/system-metrics.
//
// ⚠️ A PUBLIC STREAM IS A RESOURCE ANYONE CAN HOLD. At most MAX_STREAMS are
// open at once (the next gets 503), one sampler serves all of them, and it
// runs only while someone is watching.
// ============================================

import type { FastifyInstance, FastifyReply } from 'fastify'

import { adminRoute } from '../middleware/admin-rbac.middleware'
import { listInstances } from '../services/instance-registry'
import {
  MAX_INSTANCES,
  ScalingError,
  getInstanceCount,
  isScalingConfigured,
  setInstanceCount,
} from '../services/render-scaling'

import { createSampler, type SystemSample } from '../utils/system-metrics'
import { pressureMonitor } from '../runtime/pressure'
import { getServiceModeState } from '../runtime/service-mode'
import { parseProcessRole } from '../runtime/role'

export const METRICS_INTERVAL_MS = 2000
export const MAX_STREAMS = 20

export function registerSystemMetricsRoutes(server: FastifyInstance, inflight: () => number): void {
  const subscribers = new Set<(sample: SystemSample) => void>()
  // An open monitor stream is itself an in-flight request; it is not load.
  const sample = createSampler(() => Math.max(0, inflight() - subscribers.size))
  let last: SystemSample | null = null
  let timer: NodeJS.Timeout | null = null

  const tick = () => {
    last = sample()
    for (const send of subscribers) send(last)
  }
  const start = () => {
    if (timer) return
    timer = setInterval(tick, METRICS_INTERVAL_MS)
    timer.unref()
  }
  const stopIfIdle = () => {
    if (timer && subscribers.size === 0) {
      clearInterval(timer)
      timer = null
    }
  }
  server.addHook('onClose', async () => {
    subscribers.clear()
    stopIfIdle()
  })

  server.get('/api/system/metrics', async () => {
    if (timer && last) return last
    // CPU is a rate: take a baseline, wait a moment, measure.
    sample()
    // A 1 s window: 250 ms was noisy next to Task Manager's 1–2 s average.
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return sample()
  })

  // V61 C.4.8 — Authenticated operational metrics (RED + pressure + service mode)
  // V63 · S-1 — now on the same RBAC chain as every other admin route.
  server.get('/metrics', { preHandler: adminRoute('operations.health.read') }, async () => {
    const pressure = pressureMonitor.snapshot()
    const serviceMode = getServiceModeState()
    return {
      role: parseProcessRole(),
      serviceMode: serviceMode.mode,
      primaryWritable: serviceMode.primaryWritable,
      replicaLagExceeded: serviceMode.replicaLagExceeded,
      eventLoopDelayMs: pressure.eventLoopDelayMs,
      heapUsedBytes: pressure.heapUsedBytes,
      rssBytes: pressure.rssBytes,
      overloaded: pressure.overloaded,
      inflight: inflight(),
      uptimeSeconds: Math.round(process.uptime()),
    }
  })

  server.get('/api/system/metrics/stream', (request, reply) => {
    if (subscribers.size >= MAX_STREAMS) {
      return reply.status(503).send({ error: 'Too many monitor viewers', code: 'MONITOR_BUSY' })
    }
    reply.hijack()
    const res = reply.raw
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Proxies must pass each event on at once, not buffer the stream.
      'X-Accel-Buffering': 'no',
    })
    const send = (s: SystemSample) => {
      res.write(`data: ${JSON.stringify(s)}\n\n`)
    }
    if (last) send(last)
    subscribers.add(send)
    start()
    request.raw.on('close', () => {
      subscribers.delete(send)
      stopIfIdle()
    })
    return reply
  })
}

// ─── Platform admin: the servers page ─────────────────────────────────────
//
//   GET /api/admin/instances        every live instance's load (heartbeats)
//   GET /api/admin/instances/scale  how many instances Render runs, the cap
//   PUT /api/admin/instances/scale  { count } — add or remove servers
export function registerInstanceAdminRoutes(server: FastifyInstance): void {
  const read = adminRoute('operations.servers.read')
  const scale = adminRoute('operations.servers.scale', { stepUp: true })

  server.get('/api/admin/instances', { preHandler: read }, async () => listInstances())

  server.get('/api/admin/instances/scale', { preHandler: read }, async (_request, reply) => {
    if (!isScalingConfigured()) {
      return { configured: false, count: null, max: MAX_INSTANCES }
    }
    try {
      return { configured: true, count: await getInstanceCount(), max: MAX_INSTANCES }
    } catch (err) {
      return scalingFail(reply, err)
    }
  })

  server.put('/api/admin/instances/scale', { preHandler: scale }, async (request, reply) => {
    const count = Number((request.body as { count?: unknown } | undefined)?.count)
    try {
      await setInstanceCount(count)
      request.log.warn(
        { count, by: request.userId },
        'render instance count changed from the admin panel',
      )
      return { success: true, count }
    } catch (err) {
      return scalingFail(reply, err)
    }
  })
}

function scalingFail(reply: FastifyReply, err: unknown) {
  if (err instanceof ScalingError) {
    return reply.status(err.status).send({ error: err.code, code: err.code, detail: err.detail })
  }
  throw err
}
