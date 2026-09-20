// ============================================
// backend/src/routes/billing.routes.ts
// Billing & Subscription Routes
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { BillingService, PLANS, PLAN_PRICING } from '../services/billing.service'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'
import { Plan } from '@hisabche/validation'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function billingRoutes(fastify: FastifyInstance) {
  const billingService = new BillingService()

  // ─── GET /api/billing/plans ──────────────────────────────────
  fastify.get(
    '/api/billing/plans',
    {
      schema: {
        response: {
          200: toJsonSchema(
            z.array(
              z.object({
                plan: z.enum(['free', 'pro', 'enterprise']), // ✅ اصلاح: اضافه کردن free
                name: z.string(),
                priceMonthly: z.number().nullable(),
                priceYearly: z.number().nullable(),
                /**
                 * ⚠️ MAKING AN EXISTING ASSUMPTION EXPLICIT, NOT A NEW DECISION.
                 *
                 * The prices below are bare numbers with no currency attached,
                 * and the pricing UI rendered them as `${plan.priceMonthly}` —
                 * a hardcoded dollar sign in the component. So the product has
                 * always charged in dollars; it just never said so anywhere a
                 * reader could check.
                 *
                 * Declaring it here means the client stops asserting a currency
                 * of its own. It does NOT change what is charged.
                 *
                 * ⚠️ The owner should confirm this is right. Everything else in
                 * this product prices in the workspace's own currency, and
                 * subscription pricing being in USD is a business decision that
                 * is nowhere written down.
                 */
                currency: z.string(),
                limits: z.any(),
                featureKeys: z.array(z.string()), // ✅ تغییر: features → featureKeys
              }),
            ),
          ),
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const plans = Object.entries(PLANS).map(([key, value]) => ({
        plan: key as Plan,
        name: value.name,
        // ⚠️ From `PLAN_PRICING`, not from a literal here. A second copy of
        // a price is how the pricing page and the referral commission come to
        // disagree about what someone paid.
        priceMonthly: PLAN_PRICING[key as Plan].monthly,
        priceYearly: PLAN_PRICING[key as Plan].yearly,
        currency: PLAN_PRICING[key as Plan].currency,
        limits: value.limits,
        featureKeys: value.featureKeys, // ✅ تغییر: features → featureKeys
      }))
      return reply.send(plans)
    },
  )

  // ─── GET /api/billing/subscription ───────────────────────────
  // A subscription belongs to the WORKSPACE (DECISION A), so the route resolves
  // one and the cache is keyed by it. Keyed by user, two members of the same
  // shop were served two different answers about the same subscription.
  fastify.get(
    '/api/billing/subscription',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'subscription' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const subscription = await billingService.getCurrentSubscription(
        request.userId,
        request.tenancy.workspaceId,
      )
      const trial = await billingService.checkTrialStatus(request.userId)
      // The same verdict the write guard enforces, so the client shows the lock
      // from the server's rule rather than recomputing expiry from dates.
      const access = await billingService.getWorkspaceAccess(request.tenancy.workspaceId)
      return reply.send({ ...subscription, trial, access })
    },
  )

  // ─── POST /api/billing/upgrade ──────────────────────────────
  fastify.post(
    '/api/billing/upgrade',
    {
      preHandler: [authenticate],
      schema: {
        body: toJsonSchema(
          z.object({
            plan: z.enum(['pro', 'enterprise']),
            interval: z.enum(['month', 'year']).default('month'),
          }),
        ),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { plan, interval } = request.body as {
        plan: 'pro' | 'enterprise'
        interval: 'month' | 'year'
      }
      const subscription = await billingService.upgrade(request.userId, plan, interval)
      await clearCache(`subscription:${request.userId}`)
      return reply.send(subscription)
    },
  )

  // ─── POST /api/billing/cancel ───────────────────────────────
  fastify.post(
    '/api/billing/cancel',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const subscription = await billingService.cancel(request.userId)
      await clearCache(`subscription:${request.userId}`)
      return reply.send(subscription)
    },
  )

  // ─── GET /api/billing/usage ──────────────────────────────────
  // Usage meters count WORKSPACE-owned rows (invoices, transactions, seats),
  // so the response is workspace-scoped data: membership is enforced and the
  // cache is keyed by the workspace, not by whichever member asked.
  fastify.get(
    '/api/billing/usage',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'usage' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = request.tenancy
      const usage = await billingService.getUsageReport(request.userId, workspaceId)
      const subscription = await billingService.getCurrentSubscription(request.userId, workspaceId)
      const plan = PLANS[subscription.plan as Plan]
      return reply.send({ usage, limits: plan.limits })
    },
  )

  // ─── GET /api/billing/trial-status ──────────────────────────
  fastify.get(
    '/api/billing/trial-status',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const status = await billingService.checkTrialStatus(request.userId)
      return reply.send(status)
    },
  )
}
