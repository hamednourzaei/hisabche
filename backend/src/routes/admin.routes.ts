// ============================================
// backend/src/routes/admin.routes.ts — v2.0 (Admin Panel phase)
//
// Platform Admin API. EVERY route runs behind [authenticate,
// platformAdminGuard] — server-side authorization only; there is no
// client-trusted admin state anywhere in this file.
//
// Route contract notes:
//   - Path params are UUID-validated before they reach a query, so a malformed
//     id is a 400 from Zod rather than a PostgREST error or a silent empty.
//   - Pagination is clamped in AdminService; queries here only coerce.
//   - Mutations carry an AdminActorContext built from the AUTHENTICATED
//     request (userId + ip + user-agent) and always produce an audit_logs row
//     inside AdminService. There are exactly two mutations: subscription plan
//     and subscription status — invoices/transactions/webhook payloads have no
//     approved edit path and none is offered here.
//   - This surface is deliberately NOT workspace-scoped: platform admins are
//     strangers to every customer workspace by design (see
//     tenancy.service.ts and platform-admin-isolation.test.ts). The guard on
//     these routes IS the boundary.
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { AdminService } from '../services/admin.service'
import { authenticate } from '../middleware/auth.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { planEnum, subscriptionStatusEnum } from '@hisabche/validation'

const uuidParam = z.string().uuid()

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

const workspaceListQuery = listQuery.extend({
  search: z.string().max(200).optional(),
})

const userListQuery = listQuery.extend({
  search: z.string().max(200).optional(),
})

const subscriptionListQuery = listQuery.extend({
  plan: planEnum.optional(),
  status: subscriptionStatusEnum.optional(),
})

const updatePlanBody = z.object({
  plan: planEnum,
  reason: z.string().max(1000).optional(),
})

const updateStatusBody = z.object({
  status: subscriptionStatusEnum,
  reason: z.string().max(1000).optional(),
})

export default async function adminRoutes(fastify: FastifyInstance) {
  const adminService = new AdminService()

  /**
   * One error envelope for every handler: known domain errors keep their
   * status code; anything unexpected becomes a logged 500 with no internals
   * leaked to the client.
   */
  const send = async (request: FastifyRequest, reply: FastifyReply, fn: () => Promise<unknown>) => {
    try {
      return reply.send(await fn())
    } catch (e) {
      fastify.log.error(e)
      const status =
        typeof e === 'object' && e !== null && 'statusCode' in e
          ? (e as { statusCode: number }).statusCode
          : 500
      const message =
        status < 500 && typeof e === 'object' && e !== null && 'message' in e
          ? (e as { message: string }).message
          : 'Failed'
      return reply.code(status).send({ error: message })
    }
  }

  /** Actor context for audit rows — from the authenticated request only. */
  const actorOf = (request: FastifyRequest) => ({
    adminUserId: request.userId,
    ipAddress: request.ip ?? null,
    userAgent: request.headers['user-agent'] ?? null,
  })

  // ─── GET /api/admin/metrics ──────────────────────────────────
  fastify.get(
    '/api/admin/metrics',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) =>
      send(request, reply, () => adminService.getMetrics()),
  )

  // ─── GET /api/admin/users ────────────────────────────────────
  // Auth-admin directory (Supabase auth), not the users table projection.
  fastify.get(
    '/api/admin/users',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const q = listQuery.parse(request.query)
      return send(request, reply, () => adminService.getUsers(q.limit ?? 50, q.offset ?? 0))
    },
  )

  // ─── GET /api/admin/users/:id — detail + memberships ────────
  fastify.get(
    '/api/admin/users/:id',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } =
        uuidParam.parse((request.params as { id: string }).id) === ''
          ? { id: '' }
          : { id: (request.params as { id: string }).id }
      if (!uuidParam.safeParse(id).success) {
        return reply.code(400).send({ error: 'Invalid user id', code: 'INVALID_PARAM' })
      }
      return send(request, reply, () => adminService.getUserDetail(id))
    },
  )

  // ─── GET /api/admin/users-search — table-backed search ──────
  // Distinct from /users above: that one pages Supabase Auth, this one searches
  // the public users projection (email/full_name) with memberships available
  // through /users/:id.
  fastify.get(
    '/api/admin/users-search',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const q = userListQuery.parse(request.query)
      return send(request, reply, () => adminService.searchUsers(q))
    },
  )

  // ─── GET /api/admin/workspaces ──────────────────────────────
  fastify.get(
    '/api/admin/workspaces',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const q = workspaceListQuery.parse(request.query)
      return send(request, reply, () => adminService.listWorkspaces(q))
    },
  )

  // ─── GET /api/admin/workspaces/:id — detail ─────────────────
  fastify.get(
    '/api/admin/workspaces/:id',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = uuidParam.safeParse((request.params as { id: string }).id)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid workspace id', code: 'INVALID_PARAM' })
      }
      return send(request, reply, () => adminService.getWorkspaceDetail(parsed.data))
    },
  )

  // ─── GET /api/admin/workspaces/:id/invoices — read-only ─────
  fastify.get(
    '/api/admin/workspaces/:id/invoices',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = uuidParam.safeParse((request.params as { id: string }).id)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid workspace id', code: 'INVALID_PARAM' })
      }
      const q = listQuery.parse(request.query)
      return send(request, reply, () => adminService.listWorkspaceInvoices(parsed.data, q))
    },
  )

  // ─── GET /api/admin/workspaces/:id/transactions — read-only ─
  fastify.get(
    '/api/admin/workspaces/:id/transactions',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = uuidParam.safeParse((request.params as { id: string }).id)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid workspace id', code: 'INVALID_PARAM' })
      }
      const q = listQuery.parse(request.query)
      return send(request, reply, () => adminService.listWorkspaceTransactions(parsed.data, q))
    },
  )

  // ─── GET /api/admin/subscriptions ───────────────────────────
  fastify.get(
    '/api/admin/subscriptions',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const q = subscriptionListQuery.parse(request.query)
      return send(request, reply, () => adminService.listSubscriptions(q))
    },
  )

  // ─── GET /api/admin/subscriptions/past-due ──────────────────
  // Registered BEFORE /subscriptions/:id so "past-due" is never eaten as an id.
  fastify.get(
    '/api/admin/subscriptions/past-due',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const q = listQuery.parse(request.query)
      return send(request, reply, () => adminService.listPastDueSubscriptions(q.limit ?? 50))
    },
  )

  // ─── GET /api/admin/subscriptions/:id — detail + history ────
  fastify.get(
    '/api/admin/subscriptions/:id',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = uuidParam.safeParse((request.params as { id: string }).id)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid subscription id', code: 'INVALID_PARAM' })
      }
      return send(request, reply, () => adminService.getSubscriptionDetail(parsed.data))
    },
  )

  // ─── PATCH /api/admin/subscriptions/:id/plan — audited ──────
  fastify.patch(
    '/api/admin/subscriptions/:id/plan',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = uuidParam.safeParse((request.params as { id: string }).id)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid subscription id', code: 'INVALID_PARAM' })
      }
      const body = updatePlanBody.parse(request.body)
      return send(request, reply, () =>
        adminService.updateSubscriptionPlan(
          { ...actorOf(request), reason: body.reason },
          parsed.data,
          body.plan,
        ),
      )
    },
  )

  // ─── PATCH /api/admin/subscriptions/:id/status — audited ────
  fastify.patch(
    '/api/admin/subscriptions/:id/status',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = uuidParam.safeParse((request.params as { id: string }).id)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid subscription id', code: 'INVALID_PARAM' })
      }
      const body = updateStatusBody.parse(request.body)
      return send(request, reply, () =>
        adminService.updateSubscriptionStatus(
          { ...actorOf(request), reason: body.reason },
          parsed.data,
          body.status,
        ),
      )
    },
  )

  // ─── GET /api/admin/webhook-events — projected, payload-free ─
  fastify.get(
    '/api/admin/webhook-events',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const q = listQuery.parse(request.query)
      return send(request, reply, () => adminService.listWebhookEvents(q))
    },
  )

  // ─── GET /api/admin/audit-logs ──────────────────────────────
  fastify.get(
    '/api/admin/audit-logs',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const q = listQuery.parse(request.query)
      return send(request, reply, () => adminService.getAuditLogs(q.limit ?? 50, q.offset ?? 0))
    },
  )
}
