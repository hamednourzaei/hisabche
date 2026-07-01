// ============================================
// backend/src/routes/godam.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createGodamSchema,
  updateGodamSchema,
  stockTransferSchema,
} from '@hisabche/validation'
import { GodamService } from '../services/godam.service'
import { authenticate } from '../middleware/auth.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function godamRoutes(fastify: FastifyInstance) {
  const godamService = new GodamService()

  // ─── GET /api/godams ──────────────────────────────────────
  fastify.get('/api/godams', {
    preHandler: [authenticate],
    schema: {
      response: {
        200: toJsonSchema(z.array(z.any())),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const godams = await godamService.listGodams(request.userId)
      return reply.send(godams)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch godams' })
    }
  })

  // ─── POST /api/godams ─────────────────────────────────────
  fastify.post('/api/godams', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createGodamSchema),
      response: {
        201: toJsonSchema(z.any()),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createGodamSchema.parse(request.body)
      const godam = await godamService.createGodam(request.userId, data)
      return reply.code(201).send(godam)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create godam' })
    }
  })

  // ─── PATCH /api/godams/:id ───────────────────────────────
  fastify.patch('/api/godams/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updateGodamSchema),
      response: {
        200: toJsonSchema(z.any()),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updateGodamSchema.parse(request.body)
      const godam = await godamService.updateGodam(request.userId, id, data)
      return reply.send(godam)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update godam' })
    }
  })

  // ─── DELETE /api/godams/:id ──────────────────────────────
  fastify.delete('/api/godams/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      await godamService.deleteGodam(request.userId, id)
      return reply.code(204).send()
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to delete godam' })
    }
  })

  // ─── POST /api/stock-transfers ───────────────────────────
  fastify.post('/api/stock-transfers', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(stockTransferSchema),
      response: {
        200: toJsonSchema(z.any()),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = stockTransferSchema.parse(request.body)
      const result = await godamService.transferStock(request.userId, data)
      return reply.send(result)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to transfer stock' })
    }
  })

  // ─── GET /api/godams/:id/stock ───────────────────────────
  fastify.get('/api/godams/:id/stock', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        200: toJsonSchema(z.array(z.any())),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const stock = await godamService.getStockByGodam(request.userId, id)
      return reply.send(stock)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch stock' })
    }
  })
}