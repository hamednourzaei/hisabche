// ============================================
// backend/src/routes/purchasing.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { createPurchaseOrderSchema, updatePurchaseOrderSchema } from '@hisabche/validation'
import PurchasingService from '../services/purchasing.service'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function purchasingRoutes(fastify: FastifyInstance) {
  const purchasingService = new PurchasingService()

  // ─── GET /api/purchase-orders ────────────────────────────
  fastify.get(
    '/api/purchase-orders',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'purchase-orders' }),
      ],
      schema: {
        response: {
          200: toJsonSchema(z.array(z.any())),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const orders = await purchasingService.listPurchaseOrders(request.tenancy)
        return reply.send(orders)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch purchase orders' })
      }
    },
  )

  // ─── GET /api/purchase-orders/:id ────────────────────────
  //
  // `getPurchaseOrder` existed in the service from the start; only the door was
  // missing, so `usePurchaseOrder(id)` 404'd and no purchase order could be
  // opened. Listed in KNOWN_MISSING until now.
  fastify.get(
    '/api/purchase-orders/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await purchasingService.getPurchaseOrder(id, request.tenancy))
      } catch (err) {
        fastify.log.error(err)
        // NotFound carries its own status; anything else is ours.
        const status = (err as { statusCode?: number })?.statusCode ?? 500
        return reply.code(status).send({ error: 'Failed to fetch the purchase order' })
      }
    },
  )

  // ─── POST /api/purchase-orders ───────────────────────────
  fastify.post(
    '/api/purchase-orders',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        body: toJsonSchema(createPurchaseOrderSchema),
        response: {
          201: toJsonSchema(z.any()),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createPurchaseOrderSchema.parse(request.body)
        const order = await purchasingService.createPurchaseOrder(request.tenancy, data)
        await clearCache('purchase-orders:*')
        return reply.code(201).send(order)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to create purchase order' })
      }
    },
  )

  // ─── PATCH /api/purchase-orders/:id ──────────────────────
  fastify.patch(
    '/api/purchase-orders/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updatePurchaseOrderSchema),
        response: {
          200: toJsonSchema(z.any()),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const data = updatePurchaseOrderSchema.parse(request.body)
        const order = await purchasingService.updatePurchaseOrder(request.tenancy, id, data)
        await clearCache(`purchase-order:${id}`)
        await clearCache('purchase-orders:*')
        return reply.send(order)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to update purchase order' })
      }
    },
  )

  // ─── POST /api/purchase-orders/:id/receive ──────────────
  fastify.post(
    '/api/purchase-orders/:id/receive',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: {
          200: toJsonSchema(z.any()),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const result = await purchasingService.receiveGoods(request.tenancy, id)
        await clearCache(`purchase-order:${id}`)
        await clearCache('purchase-orders:*')
        return reply.send(result)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to receive goods' })
      }
    },
  )
}
