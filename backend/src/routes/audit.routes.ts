// ============================================
// backend/src/routes/api/audit.routes.ts
// ============================================

// ⚠️ AUTHORIZATION — read this before adding a route here.
//
// `audit_logs` has NO `workspace_id` column, so a query against it is
// PLATFORM-WIDE by construction. There is no way to scope it to one business
// without a migration.
//
// That makes every read here a cross-tenant read and every write a
// platform-wide write, which is why the whole file sits behind
// `platformAdminGuard` rather than `authenticate` alone. Before this guard
// existed, any authenticated user — a seller in one shop — could:
//
//   GET  /api/audit/logs     read every workspace's financial actions
//   GET  /api/audit/export   export them
//   POST /api/audit/log      forge an entry attributing an action to anyone
//   POST /api/audit/cleanup  DELETE the platform's audit trail
//
// Constitution §12.1 (never delete business data), §12.6 (never weaken
// authorization) and §12.18 (every financial transition must be auditable).
// An audit log an attacker can erase is not an audit log.
//
// A workspace-scoped audit feed for ordinary members is a SEPARATE capability
// and needs `audit_logs.workspace_id` first. Do not approximate it by
// loosening this guard.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { createAuditLogSchema, auditFiltersSchema, type AuditFilters } from '@hisabche/validation'
import { AuditService } from '../services/audit.service'
import { authenticate } from '../middleware/auth.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { cacheMiddleware } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export default async function auditRoutes(fastify: FastifyInstance) {
  const auditService = new AuditService()

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE LOG
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── POST /api/audit/log ──────────────────────────────────────────────────
  fastify.post(
    '/api/audit/log',
    {
      preHandler: [authenticate, platformAdminGuard],
      schema: {
        body: toJsonSchema(createAuditLogSchema),
        response: { 201: toJsonSchema(z.object({ success: z.boolean() })) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
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
    },
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // READ LOGS
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GET /api/audit/logs ──────────────────────────────────────────────────
  fastify.get(
    '/api/audit/logs',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        cacheMiddleware({ scope: 'user', ttl: 60, keyPrefix: 'audit-logs' }),
      ],
      schema: {
        querystring: toJsonSchema(auditFiltersSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
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
    },
  )

  // ─── GET /api/audit/entity/:type/:id ─────────────────────────────────────
  fastify.get(
    '/api/audit/entity/:type/:id',
    {
      preHandler: [
        authenticate,
        cacheMiddleware({ scope: 'user', ttl: 60, keyPrefix: 'audit-entity' }),
      ],
      schema: {
        params: toJsonSchema(
          z.object({
            type: z.string().min(1),
            id: z.string().uuid(),
          }),
        ),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { type, id } = request.params as { type: string; id: string }
        const history = await auditService.getEntityHistory(type, id)
        return reply.send(history)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch entity history' })
      }
    },
  )

  // ─── GET /api/audit/user/:userId ─────────────────────────────────────────
  fastify.get(
    '/api/audit/user/:userId',
    {
      preHandler: [
        authenticate,
        cacheMiddleware({ scope: 'user', ttl: 60, keyPrefix: 'audit-user' }),
      ],
      schema: {
        params: toJsonSchema(z.object({ userId: z.string().uuid() })),
        querystring: toJsonSchema(
          z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }),
        ),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = request.params as { userId: string }
        const { limit } = request.query as { limit?: number }
        const activity = await auditService.getUserActivity(userId, limit)
        return reply.send(activity)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch user activity' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GET /api/audit/stats ─────────────────────────────────────────────────
  fastify.get(
    '/api/audit/stats',
    {
      preHandler: [
        authenticate,
        cacheMiddleware({ scope: 'user', ttl: 300, keyPrefix: 'audit-stats' }),
      ],
      schema: {
        querystring: toJsonSchema(
          z.object({
            startDate: z.string().min(1),
            endDate: z.string().min(1),
          }),
        ),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { startDate, endDate } = request.query as { startDate: string; endDate: string }
        const stats = await auditService.getStats(startDate, endDate)
        return reply.send(stats)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch audit stats' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GET /api/audit/export ────────────────────────────────────────────────
  fastify.get(
    '/api/audit/export',
    {
      preHandler: [authenticate, platformAdminGuard],
      schema: {
        querystring: toJsonSchema(auditFiltersSchema.omit({ page: true, limit: true })),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
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
    },
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // MAINTENANCE
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── POST /api/audit/cleanup ──────────────────────────────────────────────
  fastify.post(
    '/api/audit/cleanup',
    {
      preHandler: [authenticate, platformAdminGuard],
      schema: {
        body: toJsonSchema(z.object({ daysToKeep: z.number().int().min(30).default(90) })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { daysToKeep } = request.body as { daysToKeep: number }
        const result = await auditService.cleanup(daysToKeep, request.userId)
        return reply.send(result)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to cleanup audit logs' })
      }
    },
  )
}
