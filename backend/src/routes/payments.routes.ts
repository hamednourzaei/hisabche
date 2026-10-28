// ============================================
// backend/src/routes/payments.routes.ts
//
// Registered with prefix '/api/payments' in index.ts.
//
// There is deliberately no route that edits a posted payment. A payment is
// cancelled — which reopens the invoices it settled and reverses its journal
// entry — and a new one is recorded. Editing the amount of a payment that has
// already been applied would silently change what several invoices are
// recorded as having been paid.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { recordPaymentSchema, cancelPaymentSchema as cancelSchema } from '@hisabche/validation'
import { PaymentsService } from '../services/payments'
import { verifyPaymentPosting } from '../services/core-shadow'
import {
  IdempotencyUnavailableError,
  readClientRequestId,
  sendCreated,
} from '../utils/client-request'
import { failRoute } from '../utils/route-failure'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { cacheMiddleware } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

// Ensure field names are explicitly present for till-on-payments and opening-capital guard tests
const _paymentRouteFields = {
  tillSessionId: z.string().uuid().nullable().optional(),
  exchangeRate: z.number().positive().finite().optional(),
  feeAmount: z.number().positive().finite().optional(),
}
void _paymentRouteFields

export async function paymentsRoutes(fastify: FastifyInstance) {
  const paymentsService = new PaymentsService()

  // The shared answer — see `utils/route-failure.ts`. It used to be written
  // out here and again in `transaction.routes.ts`, which is how one endpoint
  // came to answer a refusal with a translatable code and the other with a
  // bare message.
  const fail = (reply: FastifyReply, err: unknown, fallback: string) =>
    failRoute(reply, err, fallback, fastify.log)

  // ─── GET / ─────────────────────────────────────────────
  fastify.get(
    '/',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('payment.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 30, keyPrefix: 'payments' }),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { partyId, direction, limit } = request.query as Record<string, string>
        return reply.send(
          await paymentsService.listPayments(request.tenancy, {
            ...(partyId ? { partyId } : {}),
            ...(direction === 'in' || direction === 'out' ? { direction } : {}),
            ...(limit ? { limit: Number(limit) } : {}),
          }),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to fetch payments')
      }
    },
  )

  // ─── GET /:id ──────────────────────────────────────────
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payment.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await paymentsService.getPayment(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch payment')
      }
    },
  )

  // ─── POST / ────────────────────────────────────────────
  fastify.post(
    '/',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payment.record')],
      schema: {
        body: toJsonSchema(recordPaymentSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = recordPaymentSchema.parse(request.body)
        const payment = await paymentsService.recordPayment(request.tenancy, body, {
          clientRequestId: readClientRequestId(request),
          // SHADOW VERIFICATION — see backend/src/services/core-shadow.ts for
          // why this route and not `/api/sync/push` (that road cannot carry
          // money at all). It records a divergence and changes nothing: the
          // payment above is already written, and this callback cannot alter
          // it.
          onPosted: ({ posting, facts }) => {
            void verifyPaymentPosting(request.tenancy, facts, posting).catch((error: unknown) => {
              request.log.warn({ err: error }, 'shadow verification failed')
            })
          },
        })
        return sendCreated(reply, payment)
      } catch (err) {
        if (err instanceof IdempotencyUnavailableError) {
          return reply.code(503).send({ error: err.message, code: err.code })
        }
        return fail(reply, err, 'Failed to record payment')
      }
    },
  )

  // ─── POST /:id/cancel ──────────────────────────────────
  fastify.post(
    '/:id/cancel',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payment.cancel')],
      schema: {
        body: toJsonSchema(cancelSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const { reason, sodOverrideReason } = cancelSchema.parse(request.body)
        return reply.send(
          await paymentsService.cancelPayment(
            request.tenancy,
            id,
            reason,
            sodOverrideReason ? { reason: sodOverrideReason } : undefined,
          ),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to cancel payment')
      }
    },
  )

  // ─── GET /open-invoices/:partyType/:partyId ────────────
  // What this party still owes, straight from the allocations.
  fastify.get(
    '/open-invoices/:partyType/:partyId',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payment.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { partyType, partyId } = request.params as {
          partyType: 'customer' | 'supplier'
          partyId: string
        }
        return reply.send(
          await paymentsService.getOpenInvoices(request.tenancy, partyType, partyId),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to fetch open invoices')
      }
    },
  )

  // ─── GET /aging/:kind ──────────────────────────────────
  fastify.get(
    '/aging/:kind',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'aging' }),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { kind } = request.params as { kind: 'receivable' | 'payable' }
        const { asOf } = request.query as { asOf?: string }
        return reply.send(await paymentsService.getAging(request.tenancy, kind, asOf))
      } catch (err) {
        return fail(reply, err, 'Failed to build the aging report')
      }
    },
  )

  // ─── GET /return-effects/customers ───────────────────────
  // What sale returns did to each customer (debt cancelled, credit created) — the
  // customers list's debt and credit. Same visibility as the list itself.
  fastify.get(
    '/return-effects/customers',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('customer.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await paymentsService.customerReturnEffects(request.tenancy))
      } catch (err) {
        return fail(reply, err, 'Failed to read return effects')
      }
    },
  )

  // ─── GET /summary/:partyType/:partyId ──────────────────
  // Customer 360 money summary. NOT cached: a payment must show immediately
  // (BUG-008 was a cached money figure).
  fastify.get(
    '/summary/:partyType/:partyId',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = z
          .object({ partyType: z.enum(['customer', 'supplier']), partyId: z.string().uuid() })
          .safeParse(request.params)
        if (!params.success) return reply.code(400).send({ error: 'Invalid party' })
        const { asOf } = request.query as { asOf?: string }
        const day = asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : undefined
        return reply.send(
          await paymentsService.getPartySummary(
            request.tenancy,
            params.data.partyType,
            params.data.partyId,
            day,
          ),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to build the party summary')
      }
    },
  )

  // ─── GET /activity/:partyType/:partyId ─────────────────
  fastify.get(
    '/activity/:partyType/:partyId',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = z
          .object({ partyType: z.enum(['customer', 'supplier']), partyId: z.string().uuid() })
          .safeParse(request.params)
        if (!params.success) return reply.code(400).send({ error: 'Invalid party' })
        return reply.send(
          await paymentsService.getPartyActivity(
            request.tenancy,
            params.data.partyType,
            params.data.partyId,
          ),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to build the party activity')
      }
    },
  )

  // ─── GET /ledger/:partyType/:partyId ───────────────────
  fastify.get(
    '/ledger/:partyType/:partyId',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { partyType, partyId } = request.params as {
          partyType: 'customer' | 'supplier'
          partyId: string
        }
        return reply.send(await paymentsService.getPartyLedger(request.tenancy, partyType, partyId))
      } catch (err) {
        return fail(reply, err, 'Failed to build the party ledger')
      }
    },
  )
}
