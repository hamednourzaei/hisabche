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
import {
  decodeFrame,
  encodeFrame,
  encodePullPage,
  encodeSnapshotPage,
  HSB_CONTENT_TYPE,
  Op,
  wantsBinary,
  WireError,
  type WireValue,
} from '@hisabche/sync/wire'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { syncService, SyncError } from '../services/sync.service'
import { cursorWatcher } from '../services/sync-stream'
import { supabase } from '../db'
import { summariseSync, type MutationRow } from '../services/sync-overview.domain'

/** The device header. Optional, but a client that sends one gets echo-skip. */
const DEVICE_HEADER = 'x-hisabche-device'

/**
 * The actor for a sync operation.
 *
 * Both ids come from `request.tenancy`, which requireWorkspaceContext produced
 * by verifying membership. The workspace read here used to come from the
 * ambient `request.workspaceId`, which was `''` for a user with none OR with
 * several — so a multi-workspace member's sync silently targeted the empty
 * workspace. The route-level `if (!actor.workspaceId) 403` was the only thing
 * standing between that and a cross-workspace pull; now the preHandler answers
 * 403 before the handler runs at all.
 */
function actorFrom(request: FastifyRequest, deviceId: string) {
  return {
    userId: request.tenancy.userId,
    workspaceId: request.tenancy.workspaceId,
    deviceId,
  }
}

/**
 * Send a Hisabche Sync Binary frame. JSON stays the default: only a client
 * that asked for HSB in `Accept` gets it, so every build already in the field
 * keeps working unchanged.
 */
function sendHsb(reply: FastifyReply, bytes: Uint8Array) {
  return reply
    .type(HSB_CONTENT_TYPE)
    .send(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
}

/** 1 MiB: a full push batch (50 mutations) is a few KB; anything near this is not a batch. */
const HSB_BODY_LIMIT = 1024 * 1024

export async function syncRoutes(fastify: FastifyInstance) {
  // Scoped to this plugin (registered without fastify-plugin), so no other
  // route starts accepting binary bodies. A malformed frame is a 400 before any
  // handler runs; a frame that is not a PUSH_BATCH is refused the same way.
  fastify.addContentTypeParser(
    HSB_CONTENT_TYPE,
    { parseAs: 'buffer', bodyLimit: HSB_BODY_LIMIT },
    (_request, body, done) => {
      try {
        const frame = decodeFrame(new Uint8Array(body as Buffer))
        if (frame.op !== Op.PUSH_BATCH) throw new WireError('expected a PUSH_BATCH frame')
        done(null, frame.body)
      } catch (err) {
        const error = new Error(`invalid_hsb_frame: ${(err as Error).message}`) as Error & {
          statusCode: number
        }
        error.statusCode = 400
        done(error, undefined)
      }
    },
  )

  /* ═══════════════════════════════════════════════════════════════════════
     POST /api/sync/push
     ═══════════════════════════════════════════════════════════════════════ */
  fastify.post(
    '/api/sync/push',
    { preHandler: [authenticate, requireWorkspaceContext] },
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
        // Other devices of this shop connected to THIS instance hear now, not
        // on the next poll tick. Other instances see it within one tick.
        cursorWatcher.nudge(actor.workspaceId)

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
        reply.header('vary', 'Accept')
        if (wantsBinary(request.headers.accept)) {
          return sendHsb(
            reply.code(200),
            encodeFrame(Op.PUSH_RESULT, {
              batchId,
              results,
              currentCursor,
            } as unknown as WireValue),
          )
        }
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
    { preHandler: [authenticate, requireWorkspaceContext] },
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
      const workspaceId = request.tenancy.workspaceId

      if (!workspaceId) return reply.code(403).send({ error: 'no_workspace' })

      const started = Date.now()

      try {
        const result = await syncService.pull(workspaceId, cursor, limit, deviceId)
        const binary = wantsBinary(request.headers.accept)
        const hsb = binary ? encodePullPage(result) : null

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
            // Measured before compression — the number the binary decision and
            // the lean-payload work are judged by (request #153).
            format: binary ? 'hsb' : 'json',
            bytes: hsb ? hsb.length : Buffer.byteLength(JSON.stringify(result)),
          },
          'sync pull',
        )

        // Never cached. A cached delta is a delta some other client already
        // consumed, and this response is per-cursor by definition.
        reply.header('cache-control', 'no-store')
        reply.header('vary', 'Accept')
        if (hsb) return sendHsb(reply.code(200), hsb)
        return reply.code(200).send(result)
      } catch (err) {
        request.log.error({ err, cursor }, 'sync pull failed')
        return reply.code(500).send({ error: 'sync_pull_failed' })
      }
    },
  )

  /* ═══════════════════════════════════════════════════════════════════════
     GET /api/sync/snapshot — one page of a full rebuild (request #153)
     ═══════════════════════════════════════════════════════════════════════ */
  const snapshotQuery = z.object({
    entity: z.enum(['product', 'customer', 'invoice']),
    after: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(500),
  })

  fastify.get(
    '/api/sync/snapshot',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = snapshotQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_snapshot_request', details: parsed.error.flatten() })
      }
      const { entity, after, limit } = parsed.data
      const workspaceId = request.tenancy.workspaceId

      try {
        const page = await syncService.snapshot(workspaceId, entity, after ?? null, limit)
        reply.header('cache-control', 'no-store')
        reply.header('vary', 'Accept')
        if (wantsBinary(request.headers.accept))
          return sendHsb(reply.code(200), encodeSnapshotPage(page))
        return reply.code(200).send(page)
      } catch (err) {
        request.log.error({ err, entity, after }, 'sync snapshot failed')
        return reply.code(500).send({ error: 'sync_snapshot_failed' })
      }
    },
  )

  /* ═══════════════════════════════════════════════════════════════════════
     GET /api/sync/cursor — where the workspace stands right now
     ═══════════════════════════════════════════════════════════════════════ */
  fastify.get(
    '/api/sync/cursor',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
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
    { preHandler: [authenticate, requireWorkspaceContext] },
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
    { preHandler: [authenticate, requireWorkspaceContext] },
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
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
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

  /* ═══════════════════════════════════════════════════════════════════════
     GET /api/sync/overview — devices and failed changes, from sync_mutations
     ═══════════════════════════════════════════════════════════════════════
     Workspace-scoped (the tenancy boundary), last 30 days, read in pages and
     capped at 10 000 rows — a cap reported as `truncated`, never hidden. */
  fastify.get(
    '/api/sync/overview',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const WINDOW_DAYS = 30
      const PAGE = 1000
      const MAX_PAGES = 10
      const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
      const rows: MutationRow[] = []
      let truncated = false

      for (let page = 0; page < MAX_PAGES; page++) {
        const { data, error } = await supabase
          .from('sync_mutations')
          .select(
            'mutation_id, device_id, entity_type, entity_id, operation, status, error_code, created_at',
          )
          .eq('workspace_id', request.tenancy.workspaceId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .range(page * PAGE, page * PAGE + PAGE - 1)

        if (error) {
          // No sync table yet is «nothing synced», not an error.
          if (error.code === '42P01' || error.code === 'PGRST205') break
          request.log.error({ err: error }, 'sync overview read failed')
          return reply.code(500).send({ error: 'Failed to read sync activity' })
        }
        const batch = (data ?? []) as MutationRow[]
        rows.push(...batch)
        if (batch.length < PAGE) break
        if (page === MAX_PAGES - 1) truncated = true
      }

      return reply.send(summariseSync(rows, WINDOW_DAYS, truncated))
    },
  )
}
