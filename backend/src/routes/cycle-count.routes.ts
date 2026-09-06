// ============================================
// backend/src/routes/cycle-count.routes.ts
//
// L2 — counting the shelves.
//
// The pricing lives in `inventory-costing/stock-count.domain.ts` (which had no
// caller until L2) and the orchestration in `CycleCountService`. These routes
// only carry the request.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { CycleCountService, type CycleCountStatus } from '../services/inventory/cycle-count.service'

const createSchema = z.object({
  warehouseId: z.string().uuid(),
  productIds: z.array(z.string().uuid()).min(1),
  notes: z.string().max(2000).optional(),
})

const recordSchema = z.object({
  productId: z.string().uuid(),
  // Non-negative, not positive: counting zero on the shelf is a real and
  // common result, and it is the one that produces the largest write-off.
  countedQty: z.number().nonnegative(),
})

const cancelSchema = z.object({
  // A cancellation with no reason is unauditable — the same rule the transfer
  // document and the SoD override already enforce.
  reason: z.string().min(1).max(500),
})

export async function cycleCountRoutes(fastify: FastifyInstance) {
  const service = new CycleCountService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      // The domain refuses with a code the client translates —
      // CYCLE_COUNT_NOT_OPEN, CYCLE_COUNT_NOTHING_COUNTED.
      const code = /^[A-Z][A-Z_]{6,}/.exec(err.message)?.[0]
      return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  fastify.get(
    '/api/cycle-counts',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { status } = request.query as { status?: CycleCountStatus }
        return reply.send(await service.list(request.tenancy, status))
      } catch (err) {
        return fail(reply, err, 'Failed to list cycle counts')
      }
    },
  )

  fastify.get(
    '/api/cycle-counts/:id',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await service.get(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to load the cycle count')
      }
    },
  )

  fastify.post(
    '/api/cycle-counts',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createSchema.parse(request.body)
        return reply.code(201).send(await service.create(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to open the cycle count')
      }
    },
  )

  fastify.post(
    '/api/cycle-counts/:id/lines',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = recordSchema.parse(request.body)
        return reply.send(
          await service.recordCount(request.tenancy, id, body.productId, body.countedQty),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to record the count')
      }
    },
  )

  // ⚠️ The irreversible one. This writes the ADJUSTMENT stock movements.
  fastify.post(
    '/api/cycle-counts/:id/complete',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await service.complete(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to complete the cycle count')
      }
    },
  )

  fastify.post(
    '/api/cycle-counts/:id/cancel',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = cancelSchema.parse(request.body)
        return reply.send(await service.cancel(request.tenancy, id, body.reason))
      } catch (err) {
        return fail(reply, err, 'Failed to cancel the cycle count')
      }
    },
  )
}

export default cycleCountRoutes
