// ============================================
// backend/src/routes/crm.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createInteractionSchema,
  updateInteractionStatusSchema,
  publicUpdateTaskStatusSchema,
  recordCustomerOutcomeSchema,
  createOpportunitySchema,
  updateOpportunitySchema,
} from '@hisabche/validation'
import { BaseError } from '../errors/base.error'
import { crm } from '../services/crm'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { cacheMiddleware } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function crmRoutes(fastify: FastifyInstance) {
  // The CRM Core (services/crm). It invalidates its own route caches for the
  // workspace that owns the row — the routes used to clear `interactions:*`
  // and `opportunities:*` across EVERY workspace instead.
  const crmService = crm

  /** Domain refusals keep their status and code; anything else is a logged 500. */
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

  // ─── GET /api/interactions ───────────────────────────────
  fastify.get(
    '/api/interactions',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'interactions' }),
      ],
      schema: {
        querystring: toJsonSchema(
          z.object({
            customerId: z.string().uuid().optional(),
          }),
        ),
        response: {
          200: toJsonSchema(z.array(z.any())),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { customerId } = request.query as { customerId?: string }
        const result = await crmService.listInteractions(request.tenancy, customerId)
        return reply.send(result.interactions)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch interactions' })
      }
    },
  )

  // ─── POST /api/interactions ──────────────────────────────
  fastify.post(
    '/api/interactions',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        body: toJsonSchema(createInteractionSchema),
        response: {
          201: toJsonSchema(z.any()),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createInteractionSchema.parse(request.body)
        const interaction = await crmService.createInteraction(request.tenancy, data)
        return reply.code(201).send(interaction)
      } catch (err) {
        return fail(reply, err, 'Failed to create interaction')
      }
    },
  )

  // ─── PATCH /api/interactions/:id/status ──────────────────
  // Owner-side, authenticated manual status override (in case the
  // employee forgot to mark it complete on the public link).
  fastify.patch(
    '/api/interactions/:id/status',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updateInteractionStatusSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const { status, employeeId, employeeName } = updateInteractionStatusSchema.parse(
          request.body,
        )
        const interaction = await crmService.updateInteractionStatus(
          request.tenancy,
          id,
          status,
          'owner',
          employeeId ? { employeeId, employeeName } : undefined,
        )
        return reply.send(interaction)
      } catch (err) {
        return fail(reply, err, 'Failed to update task status')
      }
    },
  )

  // ─── GET /api/interactions/subjects ──────────────────────
  // Distinct subjects this user has already used, newest first. Feeds the
  // autocomplete so a recurring campaign keeps one spelling instead of
  // fragmenting into near-duplicates that split the stats.
  fastify.get(
    '/api/interactions/subjects',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: { response: { 200: toJsonSchema(z.array(z.string())) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const subjects = await crmService.listSubjectSuggestions(request.tenancy)
        return reply.send(subjects)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch subject suggestions' })
      }
    },
  )

  // ─── PATCH /api/interactions/:id/customer-outcome ────────
  // Owner-side record of how one customer on the task went.
  fastify.patch(
    '/api/interactions/:id/customer-outcome',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(recordCustomerOutcomeSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const input = recordCustomerOutcomeSchema.parse(request.body)
        const task = await crmService.recordCustomerOutcome(
          { id, workspaceId: request.tenancy.workspaceId },
          input,
          'owner',
        )
        return reply.send(task)
      } catch (err) {
        return fail(reply, err, 'Failed to record customer outcome')
      }
    },
  )

  // ─── GET /api/public/tasks/:token ────────────────────────
  // Public, unauthenticated, read-only task view — reached via the
  // link the owner shares with an employee who has no site account.
  // Looked up ONLY by the unguessable public_token, never by id, and
  // exposes nothing beyond this one task. No `authenticate` preHandler
  // on purpose (mirrors invoice-public.routes.ts).
  fastify.get(
    '/api/public/tasks/:token',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        params: toJsonSchema(z.object({ token: z.string().min(8) })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { token } = request.params as { token: string }
        const task = await crmService.getPublicTaskByToken(token)
        return reply.send(task)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(404).send({ error: 'Task not found' })
      }
    },
  )

  // ─── PATCH /api/public/tasks/:token/status ───────────────
  // The only write the public link allows: advancing this one task's
  // status to "in_progress" or "completed". No auth, but scoped
  // strictly to the row matching this token — same trust model as
  // sharing an invoice link.
  fastify.patch(
    '/api/public/tasks/:token/status',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        params: toJsonSchema(z.object({ token: z.string().min(8) })),
        body: toJsonSchema(publicUpdateTaskStatusSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { token } = request.params as { token: string }
        const { status } = publicUpdateTaskStatusSchema.parse(request.body)
        const task = await crmService.updatePublicTaskStatus(token, status)
        return reply.send(task)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(404).send({ error: 'Task not found' })
      }
    },
  )

  // ─── PATCH /api/public/tasks/:token/customer-outcome ─────
  // The assigned employee marking one customer ✅ or ❌ from the shared link.
  // Unauthenticated like the status route above, and scoped the same way: the
  // service rejects any customerId that is not already on this task's own
  // snapshot, so a token holder cannot write against other customers.
  fastify.patch(
    '/api/public/tasks/:token/customer-outcome',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        params: toJsonSchema(z.object({ token: z.string().min(8) })),
        body: toJsonSchema(recordCustomerOutcomeSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { token } = request.params as { token: string }
        const input = recordCustomerOutcomeSchema.parse(request.body)
        const task = await crmService.recordCustomerOutcome(
          { publicToken: token },
          input,
          'employee',
        )
        return reply.send(task)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(404).send({ error: 'Task not found' })
      }
    },
  )

  // ─── GET /api/opportunities ──────────────────────────────
  fastify.get(
    '/api/opportunities',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'opportunities' }),
      ],
      schema: {
        querystring: toJsonSchema(
          z.object({
            customerId: z.string().uuid().optional(),
          }),
        ),
        response: {
          200: toJsonSchema(z.array(z.any())),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { customerId } = request.query as { customerId?: string }
        const result = await crmService.listOpportunities(request.tenancy, customerId)
        return reply.send(result.opportunities)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch opportunities' })
      }
    },
  )

  // ─── POST /api/opportunities ─────────────────────────────
  fastify.post(
    '/api/opportunities',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        body: toJsonSchema(createOpportunitySchema),
        response: {
          201: toJsonSchema(z.any()),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createOpportunitySchema.parse(request.body)
        const opportunity = await crmService.createOpportunity(request.tenancy, data)
        return reply.code(201).send(opportunity)
      } catch (err) {
        return fail(reply, err, 'Failed to create opportunity')
      }
    },
  )

  // ─── PATCH /api/opportunities/:id ────────────────────────
  fastify.patch(
    '/api/opportunities/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updateOpportunitySchema),
        response: {
          200: toJsonSchema(z.any()),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const data = updateOpportunitySchema.parse(request.body)
        const opportunity = await crmService.updateOpportunity(request.tenancy, id, data)
        return reply.send(opportunity)
      } catch (err) {
        return fail(reply, err, 'Failed to update opportunity')
      }
    },
  )

  // ─── GET /api/crm/customers/:customerId ──────────────────
  // Every task (primary or on a multi-customer task) and opportunity of one
  // customer, with totals — the CRM tab of Customer 360 and any other page
  // that shows a party.
  fastify.get(
    '/api/crm/customers/:customerId',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'crm' }),
      ],
      schema: {
        params: toJsonSchema(z.object({ customerId: z.string().uuid() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { customerId } = request.params as { customerId: string }
        return reply.send(await crmService.getCustomerCrm(request.tenancy, customerId))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch customer CRM')
      }
    },
  )

  // V61 B.2.15 — RFM segmentation, per customer AND currency.
  //
  // ⚠️ V61 audit (12 Nov 2026): the first version read `invoices.issue_date`
  // (no such column — the field is `date`, so every call was a 500), counted
  // PURCHASE invoices as a customer buying, scaled by ×100 (wrong for AFN), fell
  // back to a hard-coded 'AFN', used the UTC day, and read one page (1,000
  // invoices) of a figure people act on (lesson 4). Now: sales only, every page,
  // each total in its own currency's digits, the books currency as the fallback,
  // and the business's own day.
  fastify.get(
    '/api/crm/rfm',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('customer.read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { supabase } = await import('../db')
        const { baseCurrencyOf } = await import('../services/base-currency')
        const { selectAllPages } = await import('../utils/fetch-all-pages')
        const { businessDayOf } = await import('../utils/local-day')
        const { DatabaseError } = await import('../errors/database.error')
        const { computeCustomerRfmByCurrency, majorToTillMinor } =
          await import('@hisabche/validation')
        const ws = request.tenancy.workspaceId

        type CustomerRow = { id: string }
        type InvoiceRow = {
          customer_id: string | null
          currency: string | null
          date: string
          total: number | string | null
        }
        type ReadError = { message: string; code?: string }
        const [custRes, invRes, bookCurrency] = await Promise.all([
          selectAllPages<CustomerRow, ReadError>((from, to) =>
            supabase
              .from('customers')
              .select('id')
              .eq('workspace_id', ws)
              .order('id', { ascending: true })
              .range(from, to),
          ),
          selectAllPages<InvoiceRow, ReadError>((from, to) =>
            supabase
              .from('invoices')
              .select('customer_id, currency, date, total')
              .eq('workspace_id', ws)
              .eq('type', 'sale')
              .neq('status', 'cancelled')
              .not('customer_id', 'is', null)
              .order('id', { ascending: true })
              .range(from, to),
          ),
          baseCurrencyOf(ws),
        ])
        if (custRes.error) throw new DatabaseError('Failed to load customers', custRes.error)
        if (invRes.error) throw new DatabaseError('Failed to load sales', invRes.error)

        const customerIds = (custRes.data ?? []).map((c) => c.id)
        const invoices = (invRes.data ?? []).map((i) => {
          const currency = i.currency ?? bookCurrency
          return {
            customerId: String(i.customer_id),
            currency,
            date: String(i.date).slice(0, 10),
            totalMinor: majorToTillMinor(Number(i.total ?? 0), currency),
          }
        })
        const today = businessDayOf(new Date(), request.tenancy.timeZone)
        return reply.send({
          data: computeCustomerRfmByCurrency(customerIds, invoices, today, bookCurrency),
        })
      } catch (err) {
        return fail(reply, err, 'Failed to compute RFM segmentation')
      }
    },
  )
}
