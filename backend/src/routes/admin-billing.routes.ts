// ============================================
// backend/src/routes/admin-billing.routes.ts
//
// Admin Billing & Monetization Routes:
// - Versioned plan pricing
// - Billing ledger entries
// - Maker-Checker action requests & decisions
// - Subscription history
// - Dunning & communication logs
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { requireAdminPermission, requireAdminStepUp } from '../middleware/admin-rbac.middleware'
import { AdminBillingService, BillingLedgerItem } from '../services/admin/admin-billing.service'

const setPriceBody = z.object({
  plan: z.string().min(1),
  amountIrr: z.number().int().nonnegative(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveUntil: z.string().datetime().nullable().optional(),
})

const recordLedgerBody = z.object({
  entryType: z.enum(['CHARGE', 'PAYMENT', 'REFUND', 'ADJUSTMENT', 'CREDIT', 'UPGRADE_CREDIT']),
  amountIrr: z.number().int(),
  description: z.string().min(1),
  idempotencyKey: z.string().optional(),
})

const proposeActionRequestBody = z.object({
  actionType: z.enum([
    'REFUND',
    'LEDGER_ADJUSTMENT',
    'PRICE_CHANGE',
    'DOWNGRADE',
    'LICENSE_TRANSFER',
  ]),
  payload: z.record(z.unknown()),
  diffPreview: z.record(z.unknown()),
})

const decideActionRequestBody = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
})

export default async function adminBillingRoutes(fastify: FastifyInstance) {
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

  // ─── GET/POST /api/admin/billing/prices ───────────────────────
  fastify.get(
    '/api/admin/billing/prices',
    {
      preHandler: [authenticate, platformAdminGuard, requireAdminPermission('billing.plans.read')],
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return handle(reply, async () => {
        const prices = await AdminBillingService.listPlanPrices()
        return { prices }
      })
    },
  )

  fastify.post(
    '/api/admin/billing/prices',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('billing.plans.write'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = setPriceBody.parse(req.body)
      const actorEmail = req.user?.email ?? 'admin'
      return handle(reply, async () => {
        return AdminBillingService.setPlanPrice({
          ...body,
          createdBy: actorEmail,
        })
      })
    },
  )

  // ─── GET /api/admin/billing/ledger · POST /api/admin/workspaces/:id/billing-ledger
  fastify.get(
    '/api/admin/billing/ledger',
    {
      preHandler: [authenticate, platformAdminGuard, requireAdminPermission('billing.ledger.read')],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId, limit, offset } = req.query as {
        workspaceId?: string
        limit?: string
        offset?: string
      }
      return handle(reply, async () => {
        return AdminBillingService.listLedger({
          workspaceId,
          limit: limit ? Number(limit) : undefined,
          offset: offset ? Number(offset) : undefined,
        })
      })
    },
  )

  fastify.post(
    '/api/admin/workspaces/:id/billing-ledger',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('billing.ledger.write'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      // The target workspace is the URL's subject, never a body field.
      const { id: workspaceId } = z.object({ id: z.string().uuid() }).parse(req.params)
      const body = recordLedgerBody.parse(req.body)
      const actorEmail = req.user?.email ?? 'admin'
      const idempotencyKey =
        (req.headers['idempotency-key'] as string | undefined) ?? body.idempotencyKey
      return handle(reply, async () => {
        return AdminBillingService.recordLedgerEntry({
          workspaceId,
          entryType: body.entryType as BillingLedgerItem['entry_type'],
          amountIrr: body.amountIrr,
          description: body.description,
          actorEmail,
          idempotencyKey,
        })
      })
    },
  )

  // ─── GET/POST /api/admin/billing/action-requests ─────────────
  fastify.get(
    '/api/admin/billing/action-requests',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('billing.upgrade_requests.read'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { status } = req.query as { status?: string }
      return handle(reply, async () => {
        const requests = await AdminBillingService.listActionRequests(status)
        return { requests }
      })
    },
  )

  fastify.post(
    '/api/admin/billing/action-requests',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('billing.upgrade_requests.decide'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = proposeActionRequestBody.parse(req.body)
      const actorEmail = req.user?.email ?? 'admin'
      return handle(reply, async () => {
        return AdminBillingService.proposeActionRequest({
          ...body,
          proposedBy: actorEmail,
        })
      })
    },
  )

  fastify.post(
    '/api/admin/billing/action-requests/:id/decide',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('billing.upgrade_requests.decide'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      const body = decideActionRequestBody.parse(req.body)
      const actorEmail = req.user?.email ?? 'admin'
      return handle(reply, async () => {
        return AdminBillingService.decideActionRequest({
          requestId: id,
          approved: body.approved,
          approverEmail: actorEmail,
          rejectionReason: body.rejectionReason,
        })
      })
    },
  )

  // ─── GET /api/admin/billing/subscriptions/:id/history ────────
  fastify.get(
    '/api/admin/billing/subscriptions/:id/history',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('billing.subscriptions.read'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      return handle(reply, async () => {
        const history = await AdminBillingService.listSubscriptionHistory(id)
        return { history }
      })
    },
  )

  // ─── GET /api/admin/billing/dunning-logs ──────────────────────
  fastify.get(
    '/api/admin/billing/dunning-logs',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('billing.subscriptions.read'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = req.query as { workspaceId?: string }
      return handle(reply, async () => {
        const logs = await AdminBillingService.listDunningLogs(workspaceId)
        return { logs }
      })
    },
  )
}
