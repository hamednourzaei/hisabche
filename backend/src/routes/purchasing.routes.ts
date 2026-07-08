// ============================================
// backend/src/routes/purchasing.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
} from '@hisabche/validation'
import PurchasingService from '../services/purchasing.service'
import { authenticate } from '../middleware/auth.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function purchasingRoutes(fastify: FastifyInstance) {
  const purchasingService = new PurchasingService()

  // ─── GET /api/purchase-orders ────────────────────────────
  fastify.get('/api/purchase-orders', {
    preHandler: [authenticate],
    schema: {
      response: {
        200: toJsonSchema(z.array(z.any())),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const orders = await purchasingService.listPurchaseOrders(request.userId)
      return reply.send(orders)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch purchase orders' })
    }
  })

  // ─── POST /api/purchase-orders ───────────────────────────
  fastify.post('/api/purchase-orders', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createPurchaseOrderSchema),
      response: {
        201: toJsonSchema(z.any()),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createPurchaseOrderSchema.parse(request.body)
      const order = await purchasingService.createPurchaseOrder(request.userId, data)
      return reply.code(201).send(order)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create purchase order' })
    }
  })

  // ─── PATCH /api/purchase-orders/:id ──────────────────────
  fastify.patch('/api/purchase-orders/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updatePurchaseOrderSchema),
      response: {
        200: toJsonSchema(z.any()),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updatePurchaseOrderSchema.parse(request.body)
      const order = await purchasingService.updatePurchaseOrder(request.userId, id, data)
      return reply.send(order)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update purchase order' })
    }
  })

  // ─── POST /api/purchase-orders/:id/receive ──────────────
  fastify.post('/api/purchase-orders/:id/receive', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        200: toJsonSchema(z.any()),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const result = await purchasingService.receiveGoods(request.userId, id)
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to receive goods' })
    }
  })
}