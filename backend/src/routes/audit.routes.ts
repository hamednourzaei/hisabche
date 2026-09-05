// ============================================
// backend/src/routes/api/audit.routes.ts
// ============================================

// ⚠️ AUTHORIZATION — read this before adding a route here.
//
// ---------------------------------------------------------------------------
// THIS FILE NOW HAS TWO KINDS OF ROUTE. Know which one you are adding.
//
//   PLATFORM SUPPORT — `platformAdminGuard`. Calls `AuditService.list()`,
//   `getStats()`, `exportLogs()`, `cleanup()`, `getEntityHistory()`,
//   `getUserActivityAcrossWorkspaces()`. These cross workspaces ON PURPOSE and
//   must never be reachable by an ordinary member.
//
//   MEMBER-FACING (G4) — `requireWorkspaceContext` + a capability. Calls only
//   `listForWorkspace()` / `getEntityHistoryForWorkspace()`, which take a
//   TenancyContext and filter on it. This is the «سابقه تغییرات» tab.
//
// `constitution-guards.test.ts` enforces the split PER HANDLER: an unguarded
// handler fails, and so does a merely workspace-scoped handler that calls a
// cross-workspace method — because `requireWorkspaceContext` would make it
// LOOK scoped while the query read every business.
//
// ---------------------------------------------------------------------------
// WHY THE PLATFORM ROUTES EXIST AT ALL
//
// `audit_logs` DOES have a `workspace_id` column — added by
// live-reconciliation-migration.sql. But `AuditService.log()` did not write it
// until G4, so every historical row has it NULL and cannot be attributed to a
// business. The platform routes read that history; the member-facing ones read
// what has been written since.
//
// Before `platformAdminGuard` existed, any authenticated user — a seller in
// one shop — could:
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
// A workspace-scoped audit feed for ordinary members was called out here as a
// SEPARATE capability needing `audit_logs.workspace_id` first. G4 built it that
// way: the column is now written, the scoped read is its own service method,
// and the two member-facing routes are at the top of this file. The guard was
// not loosened to get there — it was made per-handler and stricter.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { createAuditLogSchema, auditFiltersSchema, type AuditFilters } from '@hisabche/validation'
import { AuditService } from '../services/audit.service'
import { authenticate } from '../middleware/auth.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { cacheMiddleware } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

/**
 * G4 — what the member-facing audit tab may filter on.
 *
 * ⚠️ There is no `workspaceId` here, and there must never be. The workspace
 * comes from `request.tenancy`, which the middleware verified. A workspace
 * accepted from the client is not a boundary — it is a suggestion.
 */
const workspaceAuditFiltersSchema = z.object({
  entityType: z.string().max(60).optional(),
  entityId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  action: z.string().max(30).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export default async function auditRoutes(fastify: FastifyInstance) {
  const auditService = new AuditService()

  // ═══════════════════════════════════════════════════════════════════════════
  // G4 — THE MEMBER-FACING AUDIT TRAIL
  //
  // Every other route in this file runs `platformAdminGuard`, because
  // `AuditService.list()` crosses workspaces on purpose for platform support.
  // These two do not: they are workspace-scoped reads for the «سابقه تغییرات»
  // tab, and they call `listForWorkspace`, which filters on the verified
  // context.
  //
  // Guarded with `report.operational.read` rather than a new capability: seeing
  // who changed what in your own business is reading a report about it.
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GET /api/audit/workspace ─────────────────────────────────────────────
  fastify.get(
    '/api/audit/workspace',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.operational.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const filters = workspaceAuditFiltersSchema.parse(request.query ?? {})
        return reply.send(await auditService.listForWorkspace(request.tenancy, filters))
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        if (err instanceof Error && /AUDIT_BRANCH_NOT_MIGRATED/.test(err.message)) {
          return reply.code(409).send({ error: err.message, code: 'AUDIT_BRANCH_NOT_MIGRATED' })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch the audit trail' })
      }
    },
  )

  // ─── GET /api/audit/workspace/:entityType/:entityId ────────────────────────
  //
  // H6 — the "history of this record" panel on a document's own screen.
  fastify.get(
    '/api/audit/workspace/:entityType/:entityId',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.operational.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { entityType, entityId } = request.params as {
          entityType: string
          entityId: string
        }
        return reply.send({
          history: await auditService.getEntityHistoryForWorkspace(
            request.tenancy,
            entityType,
            entityId,
          ),
        })
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch the record history' })
      }
    },
  )

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
        platformAdminGuard,
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
        platformAdminGuard,
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
        // Platform support path: crosses workspaces on purpose, behind
        // platformAdminGuard, and named so the review can see it.
        const activity = await auditService.getUserActivityAcrossWorkspaces(userId, limit)
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
        platformAdminGuard,
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
