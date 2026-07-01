// ============================================
// backend/src/routes/manufacturing.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createBomSchema,
  updateBomSchema,
  createWorkOrderSchema,
  updateWorkOrderSchema,
} from '@hisabche/validation'
import { ManufacturingService } from '../services/manufacturing.service'
import { authenticate } from '../middleware/auth.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function manufacturingRoutes(fastify: FastifyInstance) {
  const manufacturingService = new ManufacturingService()

  // ─── GET /api/boms ────────────────────────────────────────
  fastify.get('/api/boms', {
    preHandler: [authenticate],
    schema: {
      querystring: toJsonSchema(z.object({ productId: z.string().uuid().optional() })),
      response: {
        200: toJsonSchema(z.array(z.any())),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { productId } = request.query as { productId?: string }
      const boms = await manufacturingService.listBoms(request.userId, productId)
      return reply.send(boms)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch BOMs' })
    }
  })

  // ─── POST /api/boms ──────────────────────────────────────
  fastify.post('/api/boms', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createBomSchema),
      response: {
        201: toJsonSchema(z.any()),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createBomSchema.parse(request.body)
      const bom = await manufacturingService.createBom(request.userId, data)
      return reply.code(201).send(bom)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create BOM' })
    }
  })

  // ─── PATCH /api/boms/:id ─────────────────────────────────
  fastify.patch('/api/boms/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updateBomSchema),
      response: {
        200: toJsonSchema(z.any()),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updateBomSchema.parse(request.body)
      const bom = await manufacturingService.updateBom(request.userId, id, data)
      return reply.send(bom)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update BOM' })
    }
  })

  // ─── GET /api/work-orders ─────────────────────────────────
  fastify.get('/api/work-orders', {
    preHandler: [authenticate],
    schema: {
      querystring: toJsonSchema(z.object({ status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']).optional() })),
      response: {
        200: toJsonSchema(z.array(z.any())),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { status } = request.query as { status?: string }
      const workOrders = await manufacturingService.listWorkOrders(request.userId, status)
      return reply.send(workOrders)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch work orders' })
    }
  })

  // ─── POST /api/work-orders ──────────────────────────────
  fastify.post('/api/work-orders', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createWorkOrderSchema),
      response: {
        201: toJsonSchema(z.any()),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createWorkOrderSchema.parse(request.body)
      const workOrder = await manufacturingService.createWorkOrder(request.userId, data)
      return reply.code(201).send(workOrder)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create work order' })
    }
  })

  // ─── PATCH /api/work-orders/:id ──────────────────────────
  fastify.patch('/api/work-orders/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updateWorkOrderSchema),
      response: {
        200: toJsonSchema(z.any()),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updateWorkOrderSchema.parse(request.body)
      const workOrder = await manufacturingService.updateWorkOrder(request.userId, id, data)
      return reply.send(workOrder)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update work order' })
    }
  })

  // ─── POST /api/work-orders/:id/complete ──────────────────
  fastify.post('/api/work-orders/:id/complete', {
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
      const result = await manufacturingService.completeWorkOrder(request.userId, id)
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to complete work order' })
    }
  })
}