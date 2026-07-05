// ============================================
// backend/src/routes/audit.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
// خط import رو تغییر بده به:
import {
  createAuditLogSchema,
  auditFiltersSchema,
  type AuditFilters,  
} from '@hisabche/validation'
import { AuditService } from '../services/audit.service'
import { authenticate } from '../middleware/auth.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function auditRoutes(fastify: FastifyInstance) {
  const auditService = new AuditService()

  // ═══════════════════════════════════════════════════════════
  // WRITE LOG
  // ═══════════════════════════════════════════════════════════

  // ─── POST /api/audit/log ──────────────────────────────────
  fastify.post('/audit/log', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createAuditLogSchema),
      response: { 201: toJsonSchema(z.object({ success: z.boolean() })) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createAuditLogSchema.parse(request.body)
      await auditService.log({
        ...data,
        ipAddress: data.ipAddress || request.ip,
        userAgent: data.userAgent || request.headers['user-agent'],
      })
      return reply.code(201).send({ success: true })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to write audit log' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // READ LOGS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/audit/logs ──────────────────────────────────
  fastify.get('/audit/logs', {
    preHandler: [authenticate],
    schema: {
      querystring: toJsonSchema(auditFiltersSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const filters = auditFiltersSchema.parse(request.query)
      const result = await auditService.list(filters)
      return reply.send(result)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch audit logs' })
    }
  })

  // ─── GET /api/audit/entity/:type/:id ──────────────────────
  fastify.get('/audit/entity/:type/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({
        type: z.string().min(1),
        id: z.string().uuid(),
      })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { type, id } = request.params as { type: string; id: string }
      const history = await auditService.getEntityHistory(type, id)
      return reply.send(history)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch entity history' })
    }
  })

  // ─── GET /api/audit/user/:userId ──────────────────────────
  fastify.get('/audit/user/:userId', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ userId: z.string().uuid() })),
      querystring: toJsonSchema(z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.params as { userId: string }
      const { limit } = request.query as { limit?: number }
      const activity = await auditService.getUserActivity(userId, limit)
      return reply.send(activity)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch user activity' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/audit/stats ─────────────────────────────────
  fastify.get('/audit/stats', {
    preHandler: [authenticate],
    schema: {
      querystring: toJsonSchema(z.object({
        startDate: z.string().min(1),
        endDate: z.string().min(1),
      })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { startDate, endDate } = request.query as { startDate: string; endDate: string }
      const stats = await auditService.getStats(startDate, endDate)
      return reply.send(stats)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch audit stats' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/audit/export ────────────────────────────────
  fastify.get('/audit/export', {
    preHandler: [authenticate],
    schema: {
      querystring: toJsonSchema(auditFiltersSchema.omit({ page: true, limit: true })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const filters = auditFiltersSchema.omit({ page: true, limit: true }).parse(request.query)
      const logs = await auditService.exportLogs(filters as AuditFilters)
      return reply.send(logs)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to export audit logs' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // MAINTENANCE
  // ═══════════════════════════════════════════════════════════

  // ─── POST /api/audit/cleanup ──────────────────────────────
  fastify.post('/audit/cleanup', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(z.object({ daysToKeep: z.number().int().min(30).default(90) })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { daysToKeep } = request.body as { daysToKeep: number }
      const result = await auditService.cleanup(daysToKeep)
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to cleanup audit logs' })
    }
  })
}