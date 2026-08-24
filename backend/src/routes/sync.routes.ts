// ============================================
// backend/src/routes/sync.routes.ts
//
// The sync protocol surface.
//
// SECURITY NOTE ON WHAT THIS REPLACED
//
// The previous POST /api/sync/push read a table name out of the request body
// and passed it to `supabase.from(table)` with the service role. Any
// authenticated user could therefore insert, update or delete rows in ANY
// table — including other workspaces' invoices, and `workspaces` itself. It
// also accepted arbitrary columns, so a client could set its own totals. The
// endpoint is gone; nothing here can name a table.
//
// Everything authoritative is derived from the verified token:
// `request.userId` and `request.workspaceId`. The body supplies intent only.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  syncLeaseRequestSchema,
  syncPullRequestSchema,
  syncPushRequestSchema,
} from '@hisabche/validation'
import { z } from 'zod'

import { authenticate } from '../middleware/auth.middleware'
import { syncService, SyncError } from '../services/sync.service'

/** The device header. Optional, but a client that sends one gets echo-skip. */
const DEVICE_HEADER = 'x-hisabche-device'

function actorFrom(request: FastifyRequest, deviceId: string) {
  return {
    userId: (request as FastifyRequest & { userId: string }).userId,
    workspaceId: (request as FastifyRequest & { workspaceId: string }).workspaceId,
    deviceId,
  }
}

export async function syncRoutes(fastify: FastifyInstance) {
  /* ═══════════════════════════════════════════════════════════════════════
     POST /api/sync/push
     ═══════════════════════════════════════════════════════════════════════ */
  fastify.post(
    '/api/sync/push',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = syncPushRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_push_batch',
          details: parsed.error.flatten(),
        })
      }

      const { deviceId, batchId, mutations } = parsed.data
      const actor = actorFrom(request, deviceId)

      if (!actor.workspaceId) {
        return reply.code(403).send({ error: 'no_workspace' })
      }

      const started = Date.now()

      try {
        const { results, currentCursor } = await syncService.push(actor, mutations)

        const applied = results.filter((r) => r.status === 'applied').length
        const duplicates = results.filter((r) => r.duplicate).length
        const conflicts = results.filter((r) => r.errorCode === 'version_conflict').length

        // Observability the old endpoint had none of: without these, a client
        // silently losing mutations looks exactly like a quiet day.
        request.log.info(
          {
            sync: 'push',
            batchId,
            deviceId,
            workspaceId: actor.workspaceId,
            submitted: mutations.length,
            applied,
            rejected: results.length - applied,
            duplicates,
            conflicts,
            pushMs: Date.now() - started,
          },
          'sync push',
        )

        // 200 even with rejections. The batch itself succeeded; per-mutation
        // outcomes are in the body, and an HTTP error would tell the client to
        // retry the whole batch including the parts that already applied.
        return reply.code(200).send({ batchId, results, currentCursor })
      } catch (err) {
        request.log.error({ err, batchId }, 'sync push failed')
        return reply.code(500).send({ error: 'sync_push_failed' })
      }
    },
  )

  /* ═══════════════════════════════════════════════════════════════════════
     GET /api/sync/pull
     ═══════════════════════════════════════════════════════════════════════ */
  fastify.get(
    '/api/sync/pull',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = syncPullRequestSchema.safeParse({
        ...(request.query as Record<string, unknown>),
        deviceId:
          (request.query as { deviceId?: string }).deviceId ?? request.headers[DEVICE_HEADER],
      })

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_pull_request',
          details: parsed.error.flatten(),
        })
      }

      const { cursor, limit, deviceId } = parsed.data
      const workspaceId = (request as FastifyRequest & { workspaceId: string }).workspaceId

      if (!workspaceId) return reply.code(403).send({ error: 'no_workspace' })

      const started = Date.now()

      try {
        const result = await syncService.pull(workspaceId, cursor, limit, deviceId)

        request.log.info(
          {
            sync: 'pull',
            workspaceId,
            fromCursor: cursor,
            nextCursor: result.nextCursor,
            returned: result.changes.length,
            hasMore: result.hasMore,
            mustRehydrate: result.mustRehydrate,
            pullMs: Date.now() - started,
          },
          'sync pull',
        )

        // Never cached. A cached delta is a delta some other client already
        // consumed, and this response is per-cursor by definition.
        reply.header('cache-control', 'no-store')
        return reply.code(200).send(result)
      } catch (err) {
        request.log.error({ err, cursor }, 'sync pull failed')
        return reply.code(500).send({ error: 'sync_pull_failed' })
      }
    },
  )

  /* ═══════════════════════════════════════════════════════════════════════
     GET /api/sync/cursor — where the workspace stands right now
     ═══════════════════════════════════════════════════════════════════════ */
  fastify.get(
    '/api/sync/cursor',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = (request as FastifyRequest & { workspaceId: string }).workspaceId
      if (!workspaceId) return reply.code(403).send({ error: 'no_workspace' })

      return reply.send({ cursor: await syncService.currentCursor(workspaceId) })
    },
  )

  /* ═══════════════════════════════════════════════════════════════════════
     Draft editing lease
     ═══════════════════════════════════════════════════════════════════════ */
  const leaseBody = syncLeaseRequestSchema

  fastify.post(
    '/api/sync/lease',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = leaseBody.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_lease_request' })
      }

      const { entityType, entityId, deviceId } = parsed.data
      const actor = actorFrom(request, deviceId)
      if (!actor.workspaceId) return reply.code(403).send({ error: 'no_workspace' })

      try {
        const result = await syncService.acquireLease(actor, entityType, entityId)
        return reply.code(result.granted ? 200 : 409).send(result)
      } catch (err) {
        if (err instanceof SyncError && err.code === 'not_found') {
          return reply.code(404).send({ error: 'not_found' })
        }
        request.log.error({ err }, 'lease acquire failed')
        return reply.code(500).send({ error: 'lease_failed' })
      }
    },
  )

  fastify.delete(
    '/api/sync/lease',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = leaseBody.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_lease_request' })
      }

      const { entityType, entityId, deviceId } = parsed.data
      const actor = actorFrom(request, deviceId)
      if (!actor.workspaceId) return reply.code(403).send({ error: 'no_workspace' })

      await syncService.releaseLease(actor, entityType, entityId)
      return reply.code(204).send()
    },
  )

  /* ═══════════════════════════════════════════════════════════════════════
     GET /api/sync/health — outbox-side observability
     ═══════════════════════════════════════════════════════════════════════ */
  const healthQuery = z.object({ since: z.coerce.number().int().nonnegative().default(0) })

  fastify.get(
    '/api/sync/health',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = (request as FastifyRequest & { workspaceId: string }).workspaceId
      if (!workspaceId) return reply.code(403).send({ error: 'no_workspace' })

      const { since } = healthQuery.parse(request.query)
      const cursor = await syncService.currentCursor(workspaceId)

      return reply.send({
        currentCursor: cursor,
        // How far behind the caller is. The metric that actually predicts a
        // user seeing stale data.
        lag: Math.max(0, cursor - since),
      })
    },
  )
}
