// ============================================
// backend/src/routes/inventory-reservations.routes.ts
//
// V58 · P0-1 — the HTTP surface of stock reservations / ATP.
//
//   reads     inventory.read   (who may SEE availability)
//   reserve   product.write   (manager and up) — a promise binds real stock
//   release   product.write   — freeing a hold
//   settle    product.write   — marking a promise honoured
//
// The service is the only writer; these handlers parse, authorize, delegate.
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  InventoryReservationService,
  stockReserveSchema,
  stockReservationActionSchema,
} from '../services/inventory/reservation.service'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'

const READ = [authenticate, requireWorkspaceContext, requireCapability('inventory.read')]
const WRITE = [authenticate, requireWorkspaceContext, requireCapability('product.write')]

const uuid = z.string().uuid()
const listQuerySchema = z.object({
  status: z.enum(['active', 'settled', 'released', 'expired']).optional(),
  warehouseId: uuid.optional(),
  productId: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

function fail(fastify: FastifyInstance, reply: FastifyReply, err: unknown, fallback: string) {
  if (err instanceof z.ZodError) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: err.errors[0]?.message ?? 'Validation failed',
      details: err.errors.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
  }
  if (err instanceof BaseError && err.statusCode < 500) {
    return reply.code(err.statusCode).send({ error: err.name, message: err.message })
  }
  fastify.log.error(err)
  return reply.code(500).send({ error: 'Internal Server Error', message: fallback })
}

export async function inventoryReservationRoutes(fastify: FastifyInstance) {
  const reservationService = new InventoryReservationService()

  // ATP for one warehouse + product: on hand, held, free.
  fastify.get(
    '/api/inventory/reservations/available',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { warehouseId, productId } = z
          .object({ warehouseId: uuid, productId: uuid })
          .parse(request.query)
        return reply.send(
          await reservationService.available(request.tenancy, warehouseId, productId),
        )
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read the available stock')
      }
    },
  )

  // The workspace's holds, newest first.
  fastify.get(
    '/api/inventory/reservations',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const query = listQuerySchema.parse(request.query)
        return reply.send(await reservationService.list(request.tenancy, query))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to fetch the reservations')
      }
    },
  )

  // Reserve. Idempotent on the body's idempotencyKey.
  fastify.post(
    '/api/inventory/reservations',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        const input = stockReserveSchema.parse(request.body)
        const result = await reservationService.reserve(request.tenancy, input)
        return reply.code(result.status === 'already_reserved' ? 200 : 201).send(result)
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to reserve the stock')
      }
    },
  )

  // Release (cancel) — whole or partial.
  fastify.post(
    '/api/inventory/reservations/release',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        const input = stockReservationActionSchema.parse(request.body)
        return reply.send(await reservationService.release(request.tenancy, input))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to release the reservation')
      }
    },
  )

  // Settle — the promise was honoured (partial allowed). Moves no stock.
  fastify.post(
    '/api/inventory/reservations/settle',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        const input = stockReservationActionSchema.parse(request.body)
        return reply.send(await reservationService.settle(request.tenancy, input))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to settle the reservation')
      }
    },
  )
}
