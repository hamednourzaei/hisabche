// ============================================
// backend/src/routes/crm.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createInteractionSchema,
  updateInteractionStatusSchema,
  publicUpdateTaskStatusSchema,
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
      const result = await crmService.listInteractions(request.userId, customerId)
      return reply.send(result.interactions)
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

  // ─── PATCH /api/interactions/:id/status ──────────────────
  // Owner-side, authenticated manual status override (in case the
  // employee forgot to mark it complete on the public link).
  fastify.patch('/api/interactions/:id/status', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updateInteractionStatusSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const { status } = updateInteractionStatusSchema.parse(request.body)
      const interaction = await crmService.updateInteractionStatus(request.userId, id, status)
      await clearCache('interactions:*')
      return reply.send(interaction)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update task status' })
    }
  })

  // ─── GET /api/public/tasks/:token ────────────────────────
  // Public, unauthenticated, read-only task view — reached via the
  // link the owner shares with an employee who has no site account.
  // Looked up ONLY by the unguessable public_token, never by id, and
  // exposes nothing beyond this one task. No `authenticate` preHandler
  // on purpose (mirrors invoice-public.routes.ts).
  fastify.get('/api/public/tasks/:token', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      params: toJsonSchema(z.object({ token: z.string().min(8) })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.params as { token: string }
      const task = await crmService.getPublicTaskByToken(token)
      return reply.send(task)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(404).send({ error: 'Task not found' })
    }
  })

  // ─── PATCH /api/public/tasks/:token/status ───────────────
  // The only write the public link allows: advancing this one task's
  // status to "in_progress" or "completed". No auth, but scoped
  // strictly to the row matching this token — same trust model as
  // sharing an invoice link.
  fastify.patch('/api/public/tasks/:token/status', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      params: toJsonSchema(z.object({ token: z.string().min(8) })),
      body: toJsonSchema(publicUpdateTaskStatusSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.params as { token: string }
      const { status } = publicUpdateTaskStatusSchema.parse(request.body)
      const task = await crmService.updatePublicTaskStatus(token, status)
      return reply.send(task)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(404).send({ error: 'Task not found' })
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
      const result = await crmService.listOpportunities(request.userId, customerId)
      return reply.send(result.opportunities)
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