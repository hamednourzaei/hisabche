// ============================================
// backend/src/routes/cloud-migration.routes.ts
//
// Endpoints for Offline -> Cloud Safe Migration (Step M2 / M3).
// Used by device client and admin migration center.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { CloudMigrationService } from '../services/cloud-migration/cloud-migration.service'

const createJobSchema = z.object({
  deviceId: z.string().min(1),
  licenceId: z.string().min(1),
  packageChecksum: z.string().length(64),
  chunksTotal: z.number().int().positive(),
  previewMetrics: z.record(z.unknown()),
})

const processChunkSchema = z.object({
  chunkIndex: z.number().int().nonnegative(),
  chunksTotal: z.number().int().positive(),
  sectionName: z.string().min(1),
  rows: z.array(
    z.object({
      localId: z.string().min(1),
      data: z.record(z.unknown()),
    }),
  ),
  checksum: z.string().length(64),
})

const reconcileSchema = z.object({
  expectedPreview: z.record(z.unknown()),
})

export async function cloudMigrationRoutes(fastify: FastifyInstance) {
  const service = new CloudMigrationService()
  const guard = [authenticate, requireWorkspaceContext, requireCapability('data.import')]

  // ─── 1. POST /api/cloud-migration/jobs ─────────────────────────────────────
  fastify.post(
    '/api/cloud-migration/jobs',
    { preHandler: guard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = request.tenancy!
      const body = createJobSchema.parse(request.body ?? {})
      const job = await service.createJob(ctx, {
        deviceId: body.deviceId,
        licenceId: body.licenceId,
        packageChecksum: body.packageChecksum,
        chunksTotal: body.chunksTotal,
        previewMetrics: body.previewMetrics as never,
      })
      return reply.status(201).send(job)
    },
  )

  // ─── 2. POST /api/cloud-migration/jobs/:id/chunk ───────────────────────────
  fastify.post(
    '/api/cloud-migration/jobs/:id/chunk',
    { preHandler: guard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = request.tenancy!
      const { id } = request.params as { id: string }
      const body = processChunkSchema.parse(request.body ?? {})
      const res = await service.processChunk(ctx, {
        jobId: id,
        chunkIndex: body.chunkIndex,
        chunksTotal: body.chunksTotal,
        sectionName: body.sectionName,
        rows: body.rows,
        checksum: body.checksum,
      })
      return reply.status(200).send(res)
    },
  )

  // ─── 3. POST /api/cloud-migration/jobs/:id/reconcile ───────────────────────
  fastify.post(
    '/api/cloud-migration/jobs/:id/reconcile',
    { preHandler: guard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = request.tenancy!
      const { id } = request.params as { id: string }
      const body = reconcileSchema.parse(request.body ?? {})
      const outcome = await service.reconcileJob(ctx, id, body.expectedPreview as never)
      return reply.status(200).send(outcome)
    },
  )

  // ─── 4. POST /api/cloud-migration/jobs/:id/confirm ─────────────────────────
  fastify.post(
    '/api/cloud-migration/jobs/:id/confirm',
    { preHandler: guard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = request.tenancy!
      const { id } = request.params as { id: string }
      const job = await service.confirmJob(ctx, id)
      return reply.status(200).send(job)
    },
  )

  // ─── 5. GET /api/cloud-migration/jobs/:id ──────────────────────────────────
  fastify.get(
    '/api/cloud-migration/jobs/:id',
    { preHandler: guard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = request.tenancy!
      const { id } = request.params as { id: string }
      const job = await service.getJob(ctx, id)
      return reply.status(200).send(job)
    },
  )
}
