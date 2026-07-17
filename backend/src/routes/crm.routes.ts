// ============================================
// backend/src/routes/crm.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createInteractionSchema,
  createOpportunitySchema,
  updateOpportunitySchema,
} from '@hisabche/validation'
import { CrmService } from '../services/crm.service'
import { authenticate } from '../middleware/auth.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function crmRoutes(fastify: FastifyInstance) {
  const crmService = new CrmService()

  // ─── GET /api/interactions ───────────────────────────────
  fastify.get('/api/interactions', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'interactions' })],
    schema: {
      querystring: toJsonSchema(z.object({
        customerId: z.string().uuid().optional(),
      })),
      response: {
        200: toJsonSchema(z.array(z.any())),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { customerId } = request.query as { customerId?: string }
      const interactions = await crmService.listInteractions(request.userId, customerId)
      return reply.send(interactions)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch interactions' })
    }
  })

  // ─── POST /api/interactions ──────────────────────────────
  fastify.post('/api/interactions', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createInteractionSchema),
      response: {
        201: toJsonSchema(z.any()),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createInteractionSchema.parse(request.body)
      const interaction = await crmService.createInteraction(request.userId, data)
      await clearCache('interactions:*')
      return reply.code(201).send(interaction)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create interaction' })
    }
  })

  // ─── GET /api/opportunities ──────────────────────────────
  fastify.get('/api/opportunities', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'opportunities' })],
    schema: {
      querystring: toJsonSchema(z.object({
        customerId: z.string().uuid().optional(),
      })),
      response: {
        200: toJsonSchema(z.array(z.any())),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { customerId } = request.query as { customerId?: string }
      const opportunities = await crmService.listOpportunities(request.userId, customerId)
      return reply.send(opportunities)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch opportunities' })
    }
  })

  // ─── POST /api/opportunities ─────────────────────────────
  fastify.post('/api/opportunities', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createOpportunitySchema),
      response: {
        201: toJsonSchema(z.any()),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createOpportunitySchema.parse(request.body)
      const opportunity = await crmService.createOpportunity(request.userId, data)
      await clearCache('opportunities:*')
      return reply.code(201).send(opportunity)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create opportunity' })
    }
  })

  // ─── PATCH /api/opportunities/:id ────────────────────────
  fastify.patch('/api/opportunities/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updateOpportunitySchema),
      response: {
        200: toJsonSchema(z.any()),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updateOpportunitySchema.parse(request.body)
      const opportunity = await crmService.updateOpportunity(request.userId, id, data)
      await clearCache('opportunities:*')
      return reply.send(opportunity)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update opportunity' })
    }
  })
}