// ============================================
// backend/src/routes/admin-ops.routes.ts
//
// Admin Operations & Health Routes:
// - Feature flags catalogue & toggles
// - Real probes system health
// - Background jobs list & retry
// - Announcements & maintenance mode
// - Audited CSV export
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { requireAdminPermission, requireAdminStepUp } from '../middleware/admin-rbac.middleware'
import { AdminOpsService } from '../services/admin/admin-ops.service'
import { AdminSecurityService } from '../services/admin/admin-security.service'
import { AdminControlPlaneService } from '../services/admin/admin-control-plane.service'
import { adminRoute } from '../middleware/admin-rbac.middleware'
import { supabase } from '../db'
import { isReservedFlagKey } from '../runtime/maintenance-mode'

const upsertFlagBody = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  isEnabled: z.boolean().optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  platforms: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  isBeta: z.boolean().optional(),
})

const createAnnouncementBody = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  level: z.enum(['INFO', 'WARNING', 'CRITICAL', 'MAINTENANCE']),
  targetPlans: z.array(z.string()).optional(),
  targetEditions: z.array(z.string()).optional(),
  targetPlatforms: z.array(z.string()).optional(),
  targetLocales: z.array(z.string()).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
})

const exportCsvBody = z.object({
  table: z.enum([
    'audit_logs',
    'billing_ledger_entries',
    'admin_security_events',
    'offline_licenses',
  ]),
  filters: z.record(z.unknown()).optional(),
})

export default async function adminOpsRoutes(fastify: FastifyInstance) {
  const handle = async (reply: FastifyReply, fn: () => Promise<unknown>) => {
    try {
      const data = await fn()
      return reply.send(data)
    } catch (err: unknown) {
      fastify.log.error(err)
      const e = err as { statusCode?: number; code?: string; message?: string } | undefined
      const status = typeof e?.statusCode === 'number' ? e.statusCode : 500
      const message = status < 500 && e?.message ? e.message : 'Internal server error'
      const code =
        e?.code || (status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'ERROR')
      return reply.code(status).send({ error: message, code })
    }
  }

  // ─── FEATURE FLAGS ───────────────────────────────────────────
  fastify.get(
    '/api/admin/ops/flags',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('product.features.read'),
      ],
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return handle(reply, async () => {
        const flags = await AdminOpsService.listFeatureFlags()
        return { flags }
      })
    },
  )

  fastify.post(
    '/api/admin/ops/flags',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('product.features.write'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = upsertFlagBody.parse(req.body)
      const actorEmail = req.user?.email ?? 'admin'
      // V63 #68 — the maintenance switch is a reserved row. It needs
      // `operations.maintenance.write`, not the product flag editor's permission.
      if (isReservedFlagKey(body.key)) {
        return reply.code(403).send({
          error: 'This flag is the maintenance switch — use Operations › announcements',
          code: 'FLAG_KEY_RESERVED',
        })
      }
      return handle(reply, async () => {
        return AdminOpsService.upsertFeatureFlag({
          ...body,
          actorEmail,
        })
      })
    },
  )

  // ─── SYSTEM HEALTH PROBES ────────────────────────────────────
  fastify.get(
    '/api/admin/ops/health',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('operations.health.read'),
      ],
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return handle(reply, async () => {
        const probes = await AdminOpsService.getSystemHealth()
        return { probes }
      })
    },
  )

  // ─── BACKGROUND JOBS ─────────────────────────────────────────
  fastify.get(
    '/api/admin/ops/jobs',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('operations.jobs.read'),
      ],
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return handle(reply, async () => {
        const jobs = await AdminOpsService.listBackgroundJobs()
        return { jobs }
      })
    },
  )

  fastify.post(
    '/api/admin/ops/jobs/:id/retry',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('operations.jobs.run'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      const actorEmail = req.user?.email ?? 'admin'
      return handle(reply, async () => {
        return AdminOpsService.retryJob(id, actorEmail)
      })
    },
  )

  // ─── ANNOUNCEMENTS ───────────────────────────────────────────
  fastify.get(
    '/api/admin/ops/announcements',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('admin.announcements.read'),
      ],
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return handle(reply, async () => {
        const announcements = await AdminOpsService.listAnnouncements()
        return { announcements }
      })
    },
  )

  fastify.post(
    '/api/admin/ops/announcements',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('admin.announcements.write'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = createAnnouncementBody.parse(req.body)
      const actorEmail = req.user?.email ?? 'admin'
      return handle(reply, async () => {
        return AdminOpsService.createAnnouncement({
          ...body,
          actorEmail,
        })
      })
    },
  )

  // ─── AUDITED CSV EXPORT ──────────────────────────────────────
  fastify.post(
    '/api/admin/ops/export-csv',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('security.audit.read'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = exportCsvBody.parse(req.body)
      const actorEmail = req.user?.email ?? 'admin'

      return handle(reply, async () => {
        const { data, error } = await supabase.from(body.table).select('*').limit(500)
        if (error) throw error

        await AdminSecurityService.logSecurityEvent({
          eventType: 'ADMIN_TABLE_EXPORTED_CSV',
          adminEmail: actorEmail,
          details: { table: body.table, rowCount: data?.length ?? 0 },
        })

        return {
          table: body.table,
          rowCount: data?.length ?? 0,
          rows: data ?? [],
        }
      })
    },
  )

  // ─── V100 CONTROL PLANE: SUPPORT & SLA QUEUE ─────────────────
  fastify.get(
    '/api/admin/ops/support-tickets',
    { preHandler: adminRoute('customers.workspaces.read') },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = z
        .object({
          workspaceId: z.string().uuid().optional(),
          status: z.string().optional(),
          priority: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(100).optional(),
        })
        .parse(req.query)
      return handle(reply, async () => {
        const tickets = await AdminControlPlaneService.listSupportTickets(q)
        return { tickets }
      })
    },
  )

  fastify.patch(
    '/api/admin/ops/support-tickets/:id/status',
    { preHandler: adminRoute('customers.support_sessions.open', { stepUp: true }) },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
      const body = z
        .object({
          status: z.enum(['acknowledged', 'escalated', 'resolved', 'closed']),
          note: z.string().trim().max(500).optional(),
        })
        .parse(req.body)
      const actorId = req.userId ?? req.user?.id ?? '00000000-0000-0000-0000-000000000000'
      const actorEmail = req.user?.email ?? 'admin'
      return handle(reply, async () => {
        const data = await AdminControlPlaneService.transitionSupportTicket({
          ticketId: id,
          status: body.status,
          note: body.note,
          actorId,
          actorEmail,
        })
        return { ticket: data }
      })
    },
  )

  fastify.post(
    '/api/admin/ops/support-tickets/evaluate-sla',
    { preHandler: adminRoute('customers.support_sessions.open', { stepUp: true }) },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = z
        .object({
          workspaceId: z.string().uuid().optional(),
        })
        .optional()
        .parse(req.body)
      const actorId = req.userId ?? req.user?.id ?? '00000000-0000-0000-0000-000000000000'
      const actorEmail = req.user?.email ?? 'admin'
      return handle(reply, async () => {
        return AdminControlPlaneService.runSupportSlaSweep({
          workspaceId: body?.workspaceId,
          actorId,
          actorEmail,
        })
      })
    },
  )

  // ─── V100 CONTROL PLANE: GATEWAY WEBHOOK EVENTS (NO SECRETS) ─
  fastify.get(
    '/api/admin/ops/gateway-events',
    { preHandler: adminRoute('billing.gateways.read') },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = z
        .object({
          workspaceId: z.string().uuid().optional(),
          provider: z.string().optional(),
          status: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(100).optional(),
        })
        .parse(req.query)
      return handle(reply, async () => {
        const events = await AdminControlPlaneService.listGatewayEvents(q)
        return { events }
      })
    },
  )

  // ─── V100 CONTROL PLANE: WORKSPACE CROSS-CORE RECONCILIATION ─
  fastify.post(
    '/api/admin/ops/reconcile-workspace',
    { preHandler: adminRoute('billing.ledger.read', { stepUp: true }) },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = z.object({ workspaceId: z.string().uuid() }).parse(req.body)
      const actorEmail = req.user?.email ?? 'admin'
      return handle(reply, async () => {
        const data = await AdminControlPlaneService.reconcileWorkspace({
          workspaceId: body.workspaceId,
          actorEmail,
        })
        return { data }
      })
    },
  )

  // ─── V100 CONTROL PLANE: PROJECT CHANGE ORDERS ──────────────
  fastify.get(
    '/api/admin/ops/change-orders',
    { preHandler: adminRoute('operations.jobs.read') },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = z
        .object({
          workspaceId: z.string().uuid().optional(),
          status: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(100).optional(),
        })
        .parse(req.query)
      return handle(reply, async () => {
        const orders = await AdminControlPlaneService.listChangeOrders(q)
        return { orders }
      })
    },
  )

  fastify.post(
    '/api/admin/ops/change-orders/:id/decide',
    { preHandler: adminRoute('projects.change_orders.decide', { stepUp: true }) },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
      const body = z
        .object({
          decision: z.enum(['approved', 'rejected']),
          reason: z.string().trim().max(500).optional(),
          expectedVersion: z.number().int().min(1).optional(),
        })
        .parse(req.body)
      const actorId = req.userId ?? req.user?.id ?? '00000000-0000-0000-0000-000000000000'
      const actorEmail = req.user?.email ?? 'admin'
      return handle(reply, async () => {
        const data = await AdminControlPlaneService.decideChangeOrder({
          orderId: id,
          decision: body.decision,
          reason: body.reason,
          expectedVersion: body.expectedVersion,
          actorId,
          actorEmail,
        })
        return { data }
      })
    },
  )

  // ─── V100 CONTROL PLANE: CAPABILITIES & 21 CORES SNAPSHOT ───
  fastify.get(
    '/api/admin/ops/capabilities',
    { preHandler: adminRoute('operations.health.read') },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return handle(reply, async () => AdminControlPlaneService.getCapabilitiesSnapshot())
    },
  )
}
