// ============================================
// backend/src/routes/event.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { createEventLogSchema } from '@hisabche/validation'
import { eventService } from '../services/event.service'
import { authenticate } from '../middleware/auth.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function eventRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════
  // EMIT EVENT
  // ═══════════════════════════════════════════════════════════

  // ─── POST /api/events/emit ────────────────────────────────
  fastify.post('/api/events/emit', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createEventLogSchema),
      response: { 201: toJsonSchema(z.object({ id: z.string() })) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createEventLogSchema.parse(request.body)
      const eventId = await eventService.emit(data)
      return reply.code(201).send({ id: eventId })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to emit event' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // PROCESS PENDING
  // ═══════════════════════════════════════════════════════════

  // ─── POST /api/events/process ─────────────────────────────
  fastify.post('/api/events/process', {
    preHandler: [authenticate],
    schema: {
      response: { 200: toJsonSchema(z.object({ processed: z.number(), failed: z.number() })) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await eventService.processPending()
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to process events' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // SEED
  // ═══════════════════════════════════════════════════════════

  // ─── POST /api/events/seed ────────────────────────────────
  fastify.post('/api/events/seed', {
    preHandler: [authenticate],
    schema: {
      response: { 200: toJsonSchema(z.object({ success: z.boolean() })) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await eventService.seedEventTypes()
      return reply.send({ success: true })
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to seed event types' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/events/stats ────────────────────────────────
  fastify.get('/api/events/stats', {
    preHandler: [authenticate],
    schema: {
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await eventService.getStats()
      return reply.send(stats)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch event stats' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════

  // ─── POST /api/events/cleanup ─────────────────────────────
  fastify.post('/api/events/cleanup', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(z.object({ daysToKeep: z.number().int().min(7).default(30) })),
      response: { 200: toJsonSchema(z.object({ deleted: z.number() })) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { daysToKeep } = request.body as { daysToKeep: number }
      const result = await eventService.cleanupProcessed(daysToKeep)
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to cleanup events' })
    }
  })
}