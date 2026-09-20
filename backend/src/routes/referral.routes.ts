// ============================================
// backend/src/routes/referral.routes.ts
//
// «صفحه رفرال» — a person's invite link, who joined with it, and what they
// earned.
//
// ⚠️ SCOPED TO THE CALLER, NOT TO A WORKSPACE.
//
// This is the one place in the product where `user_id` IS the filter rather
// than a record of who acted (راهنمای سشن §۱٫۱). A referral belongs to a
// PERSON: they keep the people they invited when they move between shops, and
// two owners of the same shop must not see each other's commissions. Every
// query below is keyed by `request.user.id` and never by a client-supplied id.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { authenticate } from '../middleware/auth.middleware'
import { referralService } from '../services/referral'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

// ⚠️ THIS SCHEMA IS THE RESPONSE, NOT A DESCRIPTION OF IT.
//
// fast-json-stringify only emits what the schema names, and a `required` field
// the handler does not return makes it THROW — `"rateBps" is required!`, a 500
// on a handler that did its job perfectly. The shape below must stay identical
// to `ReferralOverview` in `services/referral/referral.service.ts` and to the
// interface in `packages/api/src/hooks/referrals.ts`.
// Guard: `referral-programme.test.ts` → «response schema matches the service».
const summarySchema = z.object({
  referredCount: z.number(),
  activeCount: z.number(),
  thisMonthMinor: z.number(),
  totalMinor: z.number(),
  pendingMinor: z.number(),
  currency: z.string().nullable(),
  currencies: z.array(z.string()),
  payoutThresholdMinor: z.number(),
})

const overviewSchema = z.object({
  // `['string','null']` — fast-json-stringify REPLACES a null on a plain
  // `string` with `""` rather than erroring, and «no code yet» would then be
  // indistinguishable from an empty one (راهنمای سشن، سریالایز).
  code: z.string().nullable(),
  summary: summarySchema,
  referrals: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      signedUpAt: z.string(),
      plan: z.string().nullable(),
      interval: z.string().nullable(),
      commissionMinor: z.number(),
      baseAmountMinor: z.number(),
      currency: z.string().nullable(),
      paidPeriods: z.number(),
      periodsRemaining: z.number(),
      isActive: z.boolean(),
      status: z.string(),
    }),
  ),
  terms: z.object({
    rateBps: z.number(),
    signupDiscountBps: z.number(),
    periodLimit: z.number(),
    attributionWindowDays: z.number(),
    payoutThresholdMinor: z.number(),
  }),
})

/** Exported for the guard test only — the real serializer is built from it. */
export const referralOverviewJsonSchema = toJsonSchema(overviewSchema)

export async function referralRoutes(fastify: FastifyInstance) {
  // ─── GET /api/referrals ───────────────────────────────────────────────
  //
  // ⚠️ NO `requireWorkspaceContext`. Somebody who has just signed up and has
  // no workspace yet still has a referral link — gating this on a workspace
  // would hide the link from exactly the people most likely to share it.
  fastify.get(
    '/api/referrals',
    {
      preHandler: [authenticate],
      schema: { response: { 200: toJsonSchema(overviewSchema) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as { user?: { id?: string } }).user?.id
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' })

      const overview = await referralService.getOverview(userId)
      return reply.send(overview)
    },
  )
}
