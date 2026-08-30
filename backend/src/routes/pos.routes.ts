// ============================================
// backend/src/routes/pos.routes.ts
//
// Registered with prefix '/api/pos' in index.ts.
//
// ---------------------------------------------------------------------------
// THE OFFLINE CONTRACT
//
// `orderRef` is generated ONCE on the device and sent unchanged on every
// retry. `POST /sessions/:id/orders` is therefore idempotent: a retry after a
// lost response returns the order that already exists rather than taking the
// sale twice. That is the single most important property at a till, because a
// till on a bad connection retries constantly.
//
// The same holds for `POST /sessions/:id/close`, which is keyed by the session
// id at the ledger.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { PosService } from '../services/pos'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

const openSchema = z.object({
  openingFloatMinor: z.number().int().min(0),
  branchId: z.string().uuid().nullable().optional(),
})

const orderSchema = z.object({
  /** Generated on the device, stable across retries. The idempotency key. */
  orderRef: z.string().min(4).max(80),
  totalMinor: z.number().int(),
  changeMinor: z.number().int().min(0).default(0),
  invoiceId: z.string().uuid().nullable().optional(),
  payments: z
    .array(
      z.object({
        method: z.enum(['cash', 'card', 'transfer', 'credit', 'other']),
        amountMinor: z.number().int(),
      }),
    )
    .min(1),
})

const movementSchema = z.object({
  kind: z.enum(['cash_in', 'cash_out']),
  amountMinor: z.number().int().positive(),
  reason: z.string().min(1).max(300),
})

const closeSchema = z.object({
  countedCashMinor: z.number().int().min(0),
  varianceReason: z.string().max(500).optional(),
  force: z.boolean().optional(),
})

export async function posRoutes(fastify: FastifyInstance) {
  const posService = new PosService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      const code = /^[A-Z][A-Z_]{6,}/.exec(err.message)?.[0]
      return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  // ─── GET /sessions/current ─────────────────────────────
  fastify.get(
    '/sessions/current',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('invoice.create')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const session = await posService.getOpenSession(request.tenancy)
        if (!session) return reply.send({ session: null })
        return reply.send({
          session,
          totals: await posService.getTotals(request.tenancy, session.id),
        })
      } catch (err) {
        return fail(reply, err, 'Failed to fetch the current session')
      }
    },
  )

  // ─── POST /sessions ────────────────────────────────────
  fastify.post(
    '/sessions',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('invoice.create')],
      schema: { body: toJsonSchema(openSchema), response: { 201: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = openSchema.parse(request.body)
        return reply.code(201).send(await posService.openSession(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to open the session')
      }
    },
  )

  // ─── GET /sessions/:id ─────────────────────────────────
  fastify.get(
    '/sessions/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('invoice.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const [session, totals] = await Promise.all([
          posService.getSession(request.tenancy, id),
          posService.getTotals(request.tenancy, id),
        ])
        return reply.send({ session, totals })
      } catch (err) {
        return fail(reply, err, 'Failed to fetch the session')
      }
    },
  )

  // ─── POST /sessions/:id/orders ─────────────────────────
  // Idempotent on `orderRef`: a retry returns the order that already exists.
  fastify.post(
    '/sessions/:id/orders',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('invoice.create')],
      schema: { body: toJsonSchema(orderSchema), response: { 201: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = orderSchema.parse(request.body)
        return reply.code(201).send(await posService.recordOrder(request.tenancy, id, body))
      } catch (err) {
        return fail(reply, err, 'Failed to record the order')
      }
    },
  )

  // ─── POST /orders/:id/void ─────────────────────────────
  fastify.post(
    '/orders/:id/void',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payment.cancel')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        await posService.voidOrder(request.tenancy, id)
        return reply.send({ voided: id })
      } catch (err) {
        return fail(reply, err, 'Failed to void the order')
      }
    },
  )

  // ─── POST /sessions/:id/cash ───────────────────────────
  fastify.post(
    '/sessions/:id/cash',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('invoice.create')],
      schema: { body: toJsonSchema(movementSchema), response: { 201: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = movementSchema.parse(request.body)
        return reply.code(201).send(await posService.recordMovement(request.tenancy, id, body))
      } catch (err) {
        return fail(reply, err, 'Failed to record the cash movement')
      }
    },
  )

  // ─── POST /sessions/:id/close ──────────────────────────
  // Posts the day once, keyed by the session id.
  fastify.post(
    '/sessions/:id/close',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('invoice.create')],
      schema: { body: toJsonSchema(closeSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = closeSchema.parse(request.body)
        return reply.send(await posService.closeSession(request.tenancy, id, body))
      } catch (err) {
        return fail(reply, err, 'Failed to close the session')
      }
    },
  )

  // ─── GET /sessions/abandoned ───────────────────────────
  // Drawers open far longer than a shift. Surfaced, never auto-closed.
  fastify.get(
    '/sessions/abandoned',
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
        const { hours } = request.query as { hours?: string }
        return reply.send(
          await posService.findAbandonedSessions(request.tenancy, Number(hours) || 24),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to look for abandoned sessions')
      }
    },
  )
}
