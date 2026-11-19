// ============================================
// backend/src/routes/roll-cutting.routes.ts
//
// WP-04 — server authority for the roll register. Every write needs a
// workspace context and the `stock.adjust` capability. Length changes go
// through one Postgres function (see the service) so two devices cannot
// consume the same meters twice. All paths are tenant-scoped in the service.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { toJsonSchema } from '../utils/json-schema'
import { rollCuttingService } from '../services/inventory/roll-cutting.service'

const createRollSchema = z.object({
  rollNumber: z.string().trim().min(1).max(80),
  initialLength: z.number().positive(),
  unit: z.string().trim().max(12).optional(),
  location: z.string().trim().max(160).optional(),
  costMinor: z.number().int().nonnegative(),
  customConversionFactor: z.number().positive().nullable().optional(),
  idempotencyKey: z.string().min(8).max(120).optional(),
})

const movementSchema = z.object({
  length: z.number().positive(),
  wasteLength: z.number().nonnegative().optional(),
  idempotencyKey: z.string().min(8).max(120),
})

function keyOf(request: FastifyRequest, fallback?: string | undefined): string {
  const header = request.headers['idempotency-key']
  const fromHeader = typeof header === 'string' ? header.trim() : ''
  return fromHeader || fallback || ''
}

export async function rollCuttingRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/rolls',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const rows = await rollCuttingService.list(request.tenancy)
      return reply.send({ data: rows })
    },
  )

  fastify.get(
    '/api/rolls/report',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const rows = await rollCuttingService.report(request.tenancy)
      return reply.send({ data: rows })
    },
  )

  fastify.get(
    '/api/rolls/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: { params: toJsonSchema(z.object({ id: z.string().uuid() })) },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      return reply.send({ data: await rollCuttingService.get(request.tenancy, id) })
    },
  )

  fastify.post(
    '/api/rolls',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('stock.adjust')],
      schema: { body: toJsonSchema(createRollSchema) },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createRollSchema.parse(request.body ?? {})
      const key = keyOf(request, body.idempotencyKey)
      const row = await rollCuttingService.create(request.tenancy, {
        ...body,
        idempotencyKey: key,
      })
      return reply.code(201).send({ data: row })
    },
  )

  const movement =
    (kind: 'consume' | 'cut' | 'return') =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const body = movementSchema.parse(request.body ?? {})
      const result = await rollCuttingService.applyMovement(request.tenancy, {
        rollId: id,
        kind,
        length: body.length,
        wasteLength: body.wasteLength,
        idempotencyKey: keyOf(request, body.idempotencyKey),
      })
      return reply.send({ data: result })
    }

  const movementOpts = {
    preHandler: [authenticate, requireWorkspaceContext, requireCapability('stock.adjust')],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(movementSchema),
    },
  }

  fastify.post('/api/rolls/:id/consume', movementOpts, movement('consume'))
  fastify.post('/api/rolls/:id/cut', movementOpts, movement('cut'))
  fastify.post('/api/rolls/:id/return', movementOpts, movement('return'))
}
