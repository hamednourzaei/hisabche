// ============================================
// backend/src/routes/admin-insights.routes.ts
//
// V63 — the admin items that were ⛔ in `docs/architecture/admin/V63-113-ITEMS.md`.
// Every route goes through `adminRoute(permission, { stepUp })`
// (`admin-route-chain.test.ts`). Only one of them writes — the maintenance
// switch — and it needs a fresh second factor.
//
//   GET /api/admin/security/failed-logins   #49  security.events.read
//   GET /api/admin/security/certificates    #58  security.posture.read
//   GET /api/admin/ops/maintenance          #68  operations.health.read
//   PUT /api/admin/ops/maintenance          #68  operations.maintenance.write + step-up
//   GET /api/admin/ops/migrations           #69  operations.health.read
//   GET /api/admin/ops/email-delivery       #79  operations.jobs.read
//   GET /api/admin/gateways/analytics       #10 #12  billing.gateways.read
//   GET /api/admin/workspaces/:id/usage     #84  customers.workspaces.read
//   GET /api/admin/users/:id/activity       #89  customers.users.read
//   GET /api/admin/reports/signup-funnel    #94  customers.workspaces.read
//   GET /api/admin/reports/revenue-forecast #103 billing.ledger.read
//   GET /api/admin/developers/api-usage     #113 product.oauth.read
//
// #52 (permission matrix) needs no route: `GET /api/admin/roles` already
// returns every role's permissions and the full catalogue.
// ============================================

import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'

import { adminRoute } from '../middleware/admin-rbac.middleware'
import {
  maintenanceSnapshot,
  refreshMaintenanceFlag,
  setMaintenance,
} from '../runtime/maintenance-mode'
import { AdminInsightsService } from '../services/admin/admin-insights.service'
import { AdminSecurityService } from '../services/admin/admin-security.service'

const idParam = z.object({ id: z.string().uuid() })
const hoursQuery = z.object({ hours: z.coerce.number().int().min(1).max(168).default(24) })
const daysQuery = (max: number, fallback: number) =>
  z.object({ days: z.coerce.number().int().min(1).max(max).default(fallback) })
const activityQuery = z.object({ before: z.string().datetime().optional() })
const refreshQuery = z.object({ refresh: z.enum(['0', '1']).optional() })
const maintenanceBody = z.object({
  enabled: z.boolean(),
  // The reason is what every customer's 503 is about: it is required both ways.
  reason: z.string().trim().min(3).max(300),
})

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof z.ZodError) {
    return reply.code(400).send({
      error: err.errors[0]?.message ?? 'Validation failed',
      code: 'VALIDATION_FAILED',
    })
  }
  const e = err as { statusCode?: number; code?: string; message?: string } | undefined
  const status = typeof e?.statusCode === 'number' ? e.statusCode : 500
  const message = status < 500 && e?.message ? e.message : 'Internal server error'
  return reply.code(status).send({ error: message, code: e?.code ?? 'ERROR' })
}

export default async function adminInsightsRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── Security ──────────────────────────────────────────────────────
  fastify.get(
    '/api/admin/security/failed-logins',
    { preHandler: adminRoute('security.events.read') },
    async (request, reply) => {
      try {
        const { hours } = hoursQuery.parse(request.query)
        return reply.send(await AdminInsightsService.failedLogins(hours))
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  fastify.get(
    '/api/admin/security/certificates',
    { preHandler: adminRoute('security.posture.read') },
    async (request, reply) => {
      try {
        const { refresh } = refreshQuery.parse(request.query)
        return reply.send(await AdminInsightsService.certificates(refresh === '1'))
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  // ─── Operations ────────────────────────────────────────────────────
  fastify.get(
    '/api/admin/ops/maintenance',
    { preHandler: adminRoute('operations.health.read') },
    async (_request, reply) => {
      try {
        // A fresh read: the console must show the row, not this instance's copy.
        const state = await refreshMaintenanceFlag()
        return reply.send(state)
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  fastify.put(
    '/api/admin/ops/maintenance',
    { preHandler: adminRoute('operations.maintenance.write', { stepUp: true }) },
    async (request, reply) => {
      try {
        const body = maintenanceBody.parse(request.body)
        const before = maintenanceSnapshot()
        const state = await setMaintenance({ enabled: body.enabled, reason: body.reason })
        await AdminSecurityService.logSecurityEvent({
          eventType: body.enabled ? 'MAINTENANCE_MODE_ENABLED' : 'MAINTENANCE_MODE_DISABLED',
          adminEmail: request.user?.email ?? null,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
          details: { reason: body.reason, wasEnabled: before.enabled },
        })
        return reply.send(state)
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  fastify.get(
    '/api/admin/ops/migrations',
    { preHandler: adminRoute('operations.health.read') },
    async (_request, reply) => {
      try {
        return reply.send({ migrations: await AdminInsightsService.migrationStatus() })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  fastify.get(
    '/api/admin/ops/email-delivery',
    { preHandler: adminRoute('operations.jobs.read') },
    async (_request, reply) => {
      try {
        return reply.send(await AdminInsightsService.emailDelivery())
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  // ─── Revenue ───────────────────────────────────────────────────────
  fastify.get(
    '/api/admin/gateways/analytics',
    { preHandler: adminRoute('billing.gateways.read') },
    async (request, reply) => {
      try {
        const { days } = daysQuery(90, 7).parse(request.query)
        return reply.send(await AdminInsightsService.gatewayAnalytics(days))
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  fastify.get(
    '/api/admin/reports/revenue-forecast',
    { preHandler: adminRoute('billing.ledger.read') },
    async (_request, reply) => {
      try {
        return reply.send(await AdminInsightsService.revenueForecast())
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  // ─── Customers ─────────────────────────────────────────────────────
  fastify.get(
    '/api/admin/workspaces/:id/usage',
    { preHandler: adminRoute('customers.workspaces.read') },
    async (request, reply) => {
      try {
        const { id } = idParam.parse(request.params)
        const { days } = daysQuery(90, 30).parse(request.query)
        return reply.send(await AdminInsightsService.workspaceUsage(id, days))
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  fastify.get(
    '/api/admin/users/:id/activity',
    { preHandler: adminRoute('customers.users.read') },
    async (request, reply) => {
      try {
        const { id } = idParam.parse(request.params)
        const { before } = activityQuery.parse(request.query)
        return reply.send(await AdminInsightsService.userActivity(id, before ?? null))
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  fastify.get(
    '/api/admin/reports/signup-funnel',
    { preHandler: adminRoute('customers.workspaces.read') },
    async (request, reply) => {
      try {
        const { days } = daysQuery(365, 30).parse(request.query)
        return reply.send(await AdminInsightsService.signupFunnel(days))
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  // ─── Developers ────────────────────────────────────────────────────
  fastify.get(
    '/api/admin/developers/api-usage',
    { preHandler: adminRoute('product.oauth.read') },
    async (request, reply) => {
      try {
        const { days } = daysQuery(30, 7).parse(request.query)
        return reply.send(await AdminInsightsService.apiUsage(days))
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )
}
