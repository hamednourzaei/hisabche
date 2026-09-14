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

import { PaymentsService } from '../services/payments'
import {
  IdempotencyUnavailableError,
  readClientRequestId,
  sendCreated,
} from '../utils/client-request'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { cacheMiddleware } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

const recordPaymentSchema = z
  .object({
    direction: z.enum(['in', 'out']),
    partyType: z.enum(['customer', 'supplier']),
    // ⚠️ NULLABLE. A walk-in sale has no customer, and the service already
    // supports paying it («both null is the walk-in cash sale» in
    // payments.service.ts) when the payment names the invoice explicitly. This
    // schema still required a uuid, so the invoice page could not record a
    // payment on such an invoice at all.
    partyId: z.string().uuid().nullable(),
    amount: z.number().positive(),
    entryDate: z.string().optional(),
    currency: z.string().max(8).optional(),
    method: z.string().max(32).optional(),
    reference: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
    /** Omit to settle the oldest open invoices first. */
    allocations: z
      .array(z.object({ invoiceId: z.string().uuid(), amount: z.number().positive() }))
      .optional(),
  })
  .refine((body) => body.partyId !== null || (body.allocations?.length ?? 0) > 0, {
    // No party means nothing to auto-allocate against: the invoice must be named.
    message: 'PAYMENT_WITHOUT_PARTY_NEEDS_ALLOCATION',
    path: ['allocations'],
  })

const cancelSchema = z.object({
  reason: z.string().min(1).max(500),
  /**
   * Only honoured when segregation of duties actually offers an override —
   * `warn` mode, and an owner. Sending it otherwise changes nothing.
   */
  sodOverrideReason: z.string().min(1).max(500).optional(),
})

export async function paymentsRoutes(fastify: FastifyInstance) {
  const paymentsService = new PaymentsService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      // The domain refuses with a code — PAYMENT_OVER_ALLOCATED,
      // PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING — that the client translates.
      const code = /^[A-Z][A-Z_]{6,}/.exec(err.message)?.[0]
      return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

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
