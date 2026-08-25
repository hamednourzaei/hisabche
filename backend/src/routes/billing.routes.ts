// ============================================
// backend/src/routes/billing.routes.ts
// Billing & Subscription Routes
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { BillingService, PLANS } from '../services/billing.service'
import { authenticate } from '../middleware/auth.middleware'
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
        priceMonthly: key === 'pro' ? 12 : key === 'enterprise' ? null : null,
        priceYearly: key === 'pro' ? 99 : key === 'enterprise' ? null : null,
        limits: value.limits,
        featureKeys: value.featureKeys, // ✅ تغییر: features → featureKeys
      }))
      return reply.send(plans)
    },
  )

  // ─── GET /api/billing/subscription ───────────────────────────
  fastify.get(
    '/api/billing/subscription',
    {
      preHandler: [
        authenticate,
        cacheMiddleware({ scope: 'user', ttl: 60, keyPrefix: 'subscription' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const subscription = await billingService.getCurrentSubscription(request.userId)
      const trial = await billingService.checkTrialStatus(request.userId)
      return reply.send({ ...subscription, trial })
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
  fastify.get(
    '/api/billing/usage',
    {
      preHandler: [authenticate, cacheMiddleware({ scope: 'user', ttl: 120, keyPrefix: 'usage' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const usage = await billingService.getUsageReport(request.userId)
      const subscription = await billingService.getCurrentSubscription(request.userId)
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
