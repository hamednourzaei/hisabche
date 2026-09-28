// ============================================
// backend/src/routes/wallet.routes.ts
//
// The business's wallet (docs/wallet-01-migration.sql).
//
//   /api/wallet/…        this workspace: see, top up, pay a plan.
//                        workspace.manage — money for the business is the
//                        owner's decision, like buying the plan itself.
//   /api/admin/wallet/…  the platform: payment methods, the top-up queue,
//                        receipts (signed URL), adjustments, finding a wallet.
//
// ⚠️ Not in the API-key allowlist: a key cannot spend a business's money.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { currencyCodeSchema } from '@hisabche/validation'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { sendFailure } from '../errors/http-failure'
import { readClientRequestId } from '../utils/client-request'
import { BillingService } from '../services/billing.service'
import { walletService } from '../services/wallet/wallet.service'

const manage = [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')]
const admin = [authenticate, platformAdminGuard]

// The one currency list (CLAUDE.md §8): a method or an adjustment in a code
// the product cannot format would leave a balance nobody can read.
const currency = currencyCodeSchema
const minor = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)

const topupBody = z.object({
  methodId: z.string().uuid(),
  amountMinor: minor,
  payerReference: z.string().trim().min(1).max(120),
  cardLast4: z
    .string()
    .regex(/^[0-9]{4}$/)
    .nullable()
    .optional(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(500).optional(),
  receipt: z.object({ base64: z.string().min(1) }).optional(),
})

const payBody = z.object({
  plan: z.enum(['pro', 'enterprise']),
  interval: z.enum(['month', 'year']),
  walletCurrency: currency,
})

const methodBody = z.object({
  kind: z.enum(['card_to_card', 'foreign_currency']),
  currency,
  title: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(2000).default(''),
  destination: z.string().trim().min(1).max(200),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
})

const approveBody = z.object({
  creditedMinor: minor.nullable().optional(),
  note: z.string().trim().max(500).optional(),
})
const rejectBody = z.object({ note: z.string().trim().min(1).max(500) })
const adjustBody = z.object({
  currency,
  amountMinor: z
    .number()
    .int()
    .refine((n) => n !== 0, 'WALLET_AMOUNT_INVALID'),
  note: z.string().trim().min(1).max(500),
})

const id = (request: FastifyRequest) => (request.params as { id: string }).id

export async function walletRoutes(fastify: FastifyInstance) {
  const billingService = new BillingService()
  const fail = (reply: FastifyReply, err: unknown, fallback: string) =>
    sendFailure(reply, fastify.log, err, fallback)

  // ─── The business ───────────────────────────────────────────────────────

  fastify.get('/api/wallet', { preHandler: manage }, async (request, reply) => {
    try {
      return reply.send(await walletService.overview(request.tenancy))
    } catch (err) {
      return fail(reply, err, 'Failed to read the wallet')
    }
  })

  fastify.get('/api/wallet/transactions', { preHandler: manage }, async (request, reply) => {
    const before = z
      .string()
      .datetime({ offset: true })
      .optional()
      .catch(undefined)
      .parse((request.query as { before?: string }).before)
    try {
      return reply.send({ transactions: await walletService.transactions(request.tenancy, before) })
    } catch (err) {
      return fail(reply, err, 'Failed to read the wallet history')
    }
  })

  fastify.get('/api/wallet/topups', { preHandler: manage }, async (request, reply) => {
    try {
      return reply.send({ topups: await walletService.topups(request.tenancy) })
    } catch (err) {
      return fail(reply, err, 'Failed to read top-up requests')
    }
  })

  fastify.post('/api/wallet/topups', { preHandler: manage }, async (request, reply) => {
    try {
      const body = topupBody.parse(request.body)
      return reply.code(201).send(await walletService.requestTopup(request.tenancy, body))
    } catch (err) {
      return fail(reply, err, 'Failed to file the top-up request')
    }
  })

  fastify.post('/api/wallet/topups/:id/cancel', { preHandler: manage }, async (request, reply) => {
    try {
      await walletService.cancelTopup(request.tenancy, id(request))
      return reply.send({ success: true })
    } catch (err) {
      return fail(reply, err, 'Failed to withdraw the top-up request')
    }
  })

  // Pay a plan from the wallet. The price is ours (plan-pricing.ts); the
  // Idempotency-Key makes a lost-response retry answer with the first payment.
  fastify.post('/api/wallet/pay-upgrade', { preHandler: manage }, async (request, reply) => {
    try {
      const body = payBody.parse(request.body)
      const current = await billingService.getCurrentSubscription(
        request.userId,
        request.tenancy.workspaceId,
      )
      const result = await walletService.payUpgrade(request.tenancy, {
        currentPlan: current.plan,
        plan: body.plan,
        interval: body.interval,
        walletCurrency: body.walletCurrency,
        idempotencyKey: readClientRequestId(request),
      })
      // Referral commission and the plan caches — the same after-activation
      // step the admin approval runs. A replay has nothing new to do.
      if (result.subscriptionId) await billingService.afterApprovedUpgrade(result.subscriptionId)
      return reply.send(result)
    } catch (err) {
      return fail(reply, err, 'Failed to pay from the wallet')
    }
  })

  // ─── Platform admin ──────────────────────────────────────────────────────

  fastify.get('/api/admin/wallet/methods', { preHandler: admin }, async (_request, reply) => {
    try {
      return reply.send({ methods: await walletService.listMethods() })
    } catch (err) {
      return fail(reply, err, 'Failed to read payment methods')
    }
  })

  fastify.post('/api/admin/wallet/methods', { preHandler: admin }, async (request, reply) => {
    try {
      const body = methodBody.parse(request.body)
      return reply.code(201).send(await walletService.saveMethod(request.userId, null, body))
    } catch (err) {
      return fail(reply, err, 'Failed to save the payment method')
    }
  })

  fastify.patch('/api/admin/wallet/methods/:id', { preHandler: admin }, async (request, reply) => {
    try {
      const body = methodBody.parse(request.body)
      return reply.send(await walletService.saveMethod(request.userId, id(request), body))
    } catch (err) {
      return fail(reply, err, 'Failed to save the payment method')
    }
  })

  fastify.get('/api/admin/wallet/topups', { preHandler: admin }, async (request, reply) => {
    const status = z
      .enum(['pending', 'approved', 'rejected', 'cancelled', 'all'])
      .catch('pending')
      .parse((request.query as { status?: string }).status)
    try {
      return reply.send({ topups: await walletService.topupQueue(status) })
    } catch (err) {
      return fail(reply, err, 'Failed to read the top-up queue')
    }
  })

  fastify.get(
    '/api/admin/wallet/topups/:id/receipt',
    { preHandler: admin },
    async (request, reply) => {
      try {
        return reply.send({ url: await walletService.receiptUrl(id(request)) })
      } catch (err) {
        return fail(reply, err, 'Failed to open the receipt')
      }
    },
  )

  fastify.post(
    '/api/admin/wallet/topups/:id/approve',
    { preHandler: admin },
    async (request, reply) => {
      try {
        const body = approveBody.parse(request.body ?? {})
        const balance = await walletService.approveTopup(
          request.userId,
          id(request),
          body.creditedMinor ?? null,
          body.note || null,
        )
        return reply.send({ success: true, balanceAfter: balance })
      } catch (err) {
        return fail(reply, err, 'Failed to approve the top-up')
      }
    },
  )

  fastify.post(
    '/api/admin/wallet/topups/:id/reject',
    { preHandler: admin },
    async (request, reply) => {
      try {
        const body = rejectBody.parse(request.body)
        await walletService.rejectTopup(request.userId, id(request), body.note)
        return reply.send({ success: true })
      } catch (err) {
        return fail(reply, err, 'Failed to reject the top-up')
      }
    },
  )

  fastify.get('/api/admin/wallet/workspaces', { preHandler: admin }, async (request, reply) => {
    const q = z
      .string()
      .trim()
      .min(1)
      .max(100)
      .catch('')
      .parse((request.query as { q?: string }).q)
    if (!q) return reply.send({ workspaces: [] })
    try {
      return reply.send({ workspaces: await walletService.searchWorkspaces(q) })
    } catch (err) {
      return fail(reply, err, 'Failed to search wallets')
    }
  })

  fastify.get(
    '/api/admin/wallet/workspaces/:id/transactions',
    { preHandler: admin },
    async (request, reply) => {
      try {
        return reply.send({ transactions: await walletService.workspaceLedger(id(request)) })
      } catch (err) {
        return fail(reply, err, 'Failed to read the wallet history')
      }
    },
  )

  fastify.post(
    '/api/admin/wallet/workspaces/:id/adjust',
    { preHandler: admin },
    async (request, reply) => {
      try {
        const body = adjustBody.parse(request.body)
        const balance = await walletService.adjust(
          request.userId,
          id(request),
          body.currency,
          body.amountMinor,
          body.note,
        )
        return reply.send({ success: true, balanceAfter: balance })
      } catch (err) {
        return fail(reply, err, 'Failed to adjust the wallet')
      }
    },
  )
}
