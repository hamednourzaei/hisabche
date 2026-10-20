// ============================================
// backend/src/routes/admin-customers.routes.ts
//
// Admin Customers & Support Routes:
// - Workspace 360 view
// - User lifecycle controls (suspend, reactivate, revoke sessions, reset MFA)
// - Support impersonation sessions
// - Internal workspace notes and tags
// - Customer compliance data requests
// - Trial-abuse signals
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { requireAdminPermission, requireAdminStepUp } from '../middleware/admin-rbac.middleware'
import {
  AdminCustomersService,
  UserLifecycleAction,
} from '../services/admin/admin-customers.service'

const userActionBody = z.object({
  action: z.enum(['suspend', 'reactivate', 'revoke_sessions', 'reset_mfa', 'force_signout']),
})

const supportSessionBody = z.object({
  reason: z.string().min(5),
  durationMinutes: z.number().int().min(5).max(240).optional(),
})

const addNoteBody = z.object({
  note: z.string().min(1),
  tags: z.array(z.string()).optional(),
})

const createDataRequestBody = z.object({
  workspaceId: z.string().uuid(),
  requestType: z.enum(['EXPORT', 'DELETE', 'ANONYMISE']),
  legalHold: z.boolean().optional(),
  adminNotes: z.string().optional(),
})

export default async function adminCustomersRoutes(fastify: FastifyInstance) {
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

  // ─── GET /api/admin/workspaces/:id/360 ────────────────────────
  fastify.get(
    '/api/admin/workspaces/:id/360',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('customers.workspaces.read'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      return handle(reply, async () => {
        return AdminCustomersService.getWorkspace360(id)
      })
    },
  )

  // ─── POST /api/admin/users/:id/action ────────────────────────
  fastify.post(
    '/api/admin/users/:id/action',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('customers.users.suspend'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      const body = userActionBody.parse(req.body)
      const actorEmail = req.user?.email ?? 'admin'
      return handle(reply, async () => {
        return AdminCustomersService.manageUser(id, body.action as UserLifecycleAction, actorEmail)
      })
    },
  )

  // ─── POST /api/admin/workspaces/:id/support-sessions ─────────
  fastify.post(
    '/api/admin/workspaces/:id/support-sessions',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('customers.support_sessions.open'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id: workspaceId } = z.object({ id: z.string().uuid() }).parse(req.params)
      const body = supportSessionBody.parse(req.body)
      const adminId = req.user?.id ?? '00000000-0000-0000-0000-000000000000'
      const adminEmail = req.user?.email ?? 'admin'
      return handle(reply, async () => {
        return AdminCustomersService.createSupportSession({
          workspaceId,
          adminId,
          adminEmail,
          reason: body.reason,
          durationMinutes: body.durationMinutes,
        })
      })
    },
  )

  // ─── GET/POST /api/admin/workspaces/:id/notes ─────────────────
  fastify.get(
    '/api/admin/workspaces/:id/notes',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('customers.workspaces.read'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      return handle(reply, async () => {
        const data360 = await AdminCustomersService.getWorkspace360(id)
        return { notes: data360.notes }
      })
    },
  )

  fastify.post(
    '/api/admin/workspaces/:id/notes',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('customers.workspaces.read'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      const body = addNoteBody.parse(req.body)
      const adminId = req.user?.id ?? '00000000-0000-0000-0000-000000000000'
      const adminEmail = req.user?.email ?? 'admin'
      return handle(reply, async () => {
        return AdminCustomersService.addNote({
          workspaceId: id,
          adminId,
          adminEmail,
          note: body.note,
          tags: body.tags,
        })
      })
    },
  )

  // ─── GET/POST /api/admin/data-requests ────────────────────────
  fastify.get(
    '/api/admin/data-requests',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('customers.data_requests.read'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = req.query as { workspaceId?: string | undefined }
      return handle(reply, async () => {
        const requests = await AdminCustomersService.listDataRequests(workspaceId)
        return { requests }
      })
    },
  )

  fastify.post(
    '/api/admin/data-requests',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('customers.data_requests.decide'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = createDataRequestBody.parse(req.body)
      return handle(reply, async () => {
        return AdminCustomersService.createDataRequest(body)
      })
    },
  )

  // ─── GET /api/admin/trial-abuse ───────────────────────────────
  fastify.get(
    '/api/admin/trial-abuse',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('customers.workspaces.read'),
      ],
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return handle(reply, async () => {
        const signals = await AdminCustomersService.listTrialAbuseSignals()
        return { signals }
      })
    },
  )
}
