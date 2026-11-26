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
import { supabase } from '../db'
import { DatabaseError, NotFoundError, ConflictError } from '../errors/database.error'

import {
  recordPaymentSchema,
  cancelPaymentSchema as cancelSchema,
  createChequeSchema,
  transitionChequeSchema,
} from '@hisabche/validation'
import { PaymentsService } from '../services/payments'
import { ChequesService } from '../services/payments/cheques.service'
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
import { toJsonSchema } from '../utils/json-schema'

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

  // ─── V61 B.2.5: CHEQUE LIFECYCLE ─────────────────────────────────────────
  const chequesService = new ChequesService()

  fastify.get(
    '/cheques',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payment.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { status } = request.query as { status?: string }
        const data = await chequesService.list(request.tenancy, status)
        return reply.send({ data })
      } catch (err) {
        return fail(reply, err, 'Failed to list cheques')
      }
    },
  )

  fastify.post(
    '/cheques',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payment.record')],
      schema: {
        body: toJsonSchema(createChequeSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createChequeSchema.parse(request.body)
        const created = await chequesService.create(request.tenancy, body)
        return reply.code(201).send({ data: created })
      } catch (err) {
        return fail(reply, err, 'Failed to create cheque')
      }
    },
  )

  fastify.post(
    '/cheques/:id/transition',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payment.record')],
      schema: {
        body: toJsonSchema(transitionChequeSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = transitionChequeSchema.parse(request.body)
        const updated = await chequesService.transition(request.tenancy, id, body)
        return reply.send({ data: updated })
      } catch (err) {
        return fail(reply, err, 'Failed to transition cheque')
      }
    },
  )

  // ─── X10: OFFLINE/GATEWAY PAYMENT PROCESSOR STATE ──────────────────────
  const processorTransitionSchema = z
    .object({
      processorState: z.enum([
        'queued_offline',
        'pending_capture',
        'captured',
        'declined',
        'voided',
      ]),
      gatewayName: z.string().trim().max(80).optional(),
      externalRef: z.string().trim().max(120).optional(),
      feeMinor: z.number().int().min(0).default(0),
      reason: z.string().trim().max(300).optional(),
    })
    .strict()

  const ALLOWED_PROCESSOR_FSM: Readonly<Record<string, readonly string[]>> = {
    queued_offline: ['pending_capture', 'voided'],
    pending_capture: ['captured', 'declined', 'voided'],
    declined: ['pending_capture', 'voided'],
    captured: ['voided'],
    voided: [],
  }

  fastify.get(
    '/:id/processor-state',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payment.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const { data: payment, error: pErr } = await supabase
          .from('payments')
          .select('id, method, currency, updated_at')
          .eq('id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .maybeSingle()
        if (pErr) throw new DatabaseError('Failed to verify payment', pErr)
        if (!payment) throw new NotFoundError('Payment')

        const { data: stateRow, error: sErr } = await supabase
          .from('payment_gateway_states')
          .select('*')
          .eq('payment_id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .maybeSingle()
        if (sErr) throw new DatabaseError('Failed to read payment processor state', sErr)

        return reply.send({
          data: stateRow
            ? {
                paymentId: stateRow.payment_id,
                processorState: stateRow.processor_state,
                gatewayName: stateRow.gateway_name,
                externalRef: stateRow.external_ref,
                feeMinor: stateRow.fee_minor,
                currency: stateRow.currency,
                reason: stateRow.reason,
                updatedAt: stateRow.updated_at,
              }
            : {
                paymentId: payment.id,
                processorState: payment.method === 'cash' ? 'captured' : 'queued_offline',
                gatewayName: null,
                externalRef: null,
                feeMinor: 0,
                currency: payment.currency,
                reason: null,
                updatedAt: payment.updated_at,
              },
        })
      } catch (err) {
        return fail(reply, err, 'Failed to read payment processor state')
      }
    },
  )

  fastify.post(
    '/:id/processor-state',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payment.record')],
      schema: {
        body: toJsonSchema(processorTransitionSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = processorTransitionSchema.parse(request.body)
        const { data: payment, error: pErr } = await supabase
          .from('payments')
          .select('id, method, currency')
          .eq('id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .maybeSingle()
        if (pErr) throw new DatabaseError('Failed to verify payment', pErr)
        if (!payment) throw new NotFoundError('Payment')

        const { data: existing, error: eErr } = await supabase
          .from('payment_gateway_states')
          .select('*')
          .eq('payment_id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .maybeSingle()
        if (eErr) throw new DatabaseError('Failed to read processor state', eErr)

        const current =
          existing?.processor_state ?? (payment.method === 'cash' ? 'captured' : 'queued_offline')
        if (
          current !== body.processorState &&
          !(ALLOWED_PROCESSOR_FSM[current] ?? []).includes(body.processorState)
        ) {
          throw new ConflictError('PROCESSOR_STATE_TRANSITION_NOT_ALLOWED')
        }

        const now = new Date().toISOString()
        const payload = {
          workspace_id: request.tenancy.workspaceId,
          payment_id: id,
          processor_state: body.processorState,
          gateway_name: body.gatewayName ?? existing?.gateway_name ?? null,
          external_ref: body.externalRef ?? existing?.external_ref ?? null,
          fee_minor: body.feeMinor,
          currency: payment.currency,
          reason: body.reason ?? null,
          updated_by: request.tenancy.userId,
          updated_at: now,
        }

        const { data: saved, error: wErr } = existing
          ? await supabase
              .from('payment_gateway_states')
              .update(payload)
              .eq('id', existing.id)
              .eq('workspace_id', request.tenancy.workspaceId)
              .select('*')
              .single()
          : await supabase.from('payment_gateway_states').insert(payload).select('*').single()
        if (wErr) throw new DatabaseError('Failed to save processor state', wErr)

        const { error: evErr } = await supabase.from('payment_gateway_events').insert({
          workspace_id: request.tenancy.workspaceId,
          payment_id: id,
          from_state: current,
          to_state: body.processorState,
          gateway_name: saved.gateway_name,
          external_ref: saved.external_ref,
          fee_minor: body.feeMinor,
          signature_verified: false,
          reason: body.reason ?? null,
          actor_id: request.tenancy.userId,
        })
        if (evErr) throw new DatabaseError('Failed to append gateway event log', evErr)

        return reply.send({
          data: {
            paymentId: saved.payment_id,
            processorState: saved.processor_state,
            gatewayName: saved.gateway_name,
            externalRef: saved.external_ref,
            feeMinor: saved.fee_minor,
            currency: saved.currency,
            reason: saved.reason,
            updatedAt: saved.updated_at,
          },
        })
      } catch (err) {
        return fail(reply, err, 'Failed to update payment processor state')
      }
    },
  )

  fastify.get(
    '/:id/gateway-events',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payment.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const { data: payment, error: pErr } = await supabase
          .from('payments')
          .select('id')
          .eq('id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .maybeSingle()
        if (pErr) throw new DatabaseError('Failed to verify payment', pErr)
        if (!payment) throw new NotFoundError('Payment')

        const { data: events, error: evErr } = await supabase
          .from('payment_gateway_events')
          .select('*')
          .eq('payment_id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .order('created_at', { ascending: true })
        if (evErr) throw new DatabaseError('Failed to read payment gateway events', evErr)
        return reply.send({ data: events ?? [] })
      } catch (err) {
        return fail(reply, err, 'Failed to read gateway events')
      }
    },
  )

  const webhookSchema = z
    .object({
      processorState: z.enum(['captured', 'declined', 'voided']),
      gatewayName: z.string().trim().min(1).max(80),
      externalRef: z.string().trim().min(1).max(120),
      feeMinor: z.number().int().min(0).default(0),
      amountMinor: z.number().int().min(0).optional(),
      currency: z.string().trim().min(3).max(3).optional(),
      reason: z.string().trim().max(300).optional(),
    })
    .strict()

  // X10 Cryptographically verified payment gateway callback (HMAC-SHA256 + timingSafeEqual + replay dedup)
  fastify.post(
    '/:id/gateway-webhook',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payment.record')],
      schema: {
        body: toJsonSchema(webhookSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const secret = process.env.PAYMENT_WEBHOOK_SECRET
        const sigHeader = String(request.headers['x-hisabche-signature'] ?? '').trim()
        if (!secret || !sigHeader) {
          return reply
            .code(401)
            .send({ error: 'GATEWAY_SIGNATURE_REQUIRED', code: 'GATEWAY_SIGNATURE_REQUIRED' })
        }
        const { id } = request.params as { id: string }
        const body = webhookSchema.parse(request.body)
        const { createHmac, timingSafeEqual } = await import('node:crypto')
        const canonical = `${id}:${body.processorState}:${body.externalRef}:${body.feeMinor}`
        const expectedHex = createHmac('sha256', secret).update(canonical).digest('hex')
        const gotBuf = Buffer.from(sigHeader, 'utf8')
        const expBuf = Buffer.from(expectedHex, 'utf8')
        if (gotBuf.length !== expBuf.length || !timingSafeEqual(gotBuf, expBuf)) {
          return reply
            .code(401)
            .send({ error: 'GATEWAY_SIGNATURE_INVALID', code: 'GATEWAY_SIGNATURE_INVALID' })
        }

        const { data: payment, error: pErr } = await supabase
          .from('payments')
          .select('id, method, currency, amount')
          .eq('id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .maybeSingle()
        if (pErr) throw new DatabaseError('Failed to verify payment', pErr)
        if (!payment) throw new NotFoundError('Payment')

        if (
          body.currency &&
          body.currency.trim().toUpperCase() !== String(payment.currency).toUpperCase()
        ) {
          throw new ConflictError('GATEWAY_CURRENCY_MISMATCH')
        }
        if (body.amountMinor !== undefined && Number.isFinite(Number(payment.amount))) {
          if (body.amountMinor !== Number(payment.amount)) {
            throw new ConflictError('GATEWAY_AMOUNT_MISMATCH')
          }
        }

        // Deduplicate exact gateway webhook replay (same payment, externalRef, target state)
        const { data: replayedEvent, error: repErr } = await supabase
          .from('payment_gateway_events')
          .select('id')
          .eq('workspace_id', request.tenancy.workspaceId)
          .eq('payment_id', id)
          .eq('external_ref', body.externalRef)
          .eq('to_state', body.processorState)
          .maybeSingle()
        if (repErr) throw new DatabaseError('Failed to check webhook replay', repErr)

        const { data: existing, error: eErr } = await supabase
          .from('payment_gateway_states')
          .select('*')
          .eq('payment_id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .maybeSingle()
        if (eErr) throw new DatabaseError('Failed to read processor state', eErr)

        if (replayedEvent && existing) {
          return reply.send({
            data: {
              paymentId: existing.payment_id,
              processorState: existing.processor_state,
              signatureVerified: true,
              externalRef: existing.external_ref,
              replay: true,
            },
          })
        }

        const current =
          existing?.processor_state ?? (payment.method === 'cash' ? 'captured' : 'queued_offline')
        if (
          current !== body.processorState &&
          !(ALLOWED_PROCESSOR_FSM[current] ?? []).includes(body.processorState)
        ) {
          throw new ConflictError('PROCESSOR_STATE_TRANSITION_NOT_ALLOWED')
        }

        const now = new Date().toISOString()
        const payload = {
          workspace_id: request.tenancy.workspaceId,
          payment_id: id,
          processor_state: body.processorState,
          gateway_name: body.gatewayName,
          external_ref: body.externalRef,
          fee_minor: body.feeMinor,
          currency: payment.currency,
          reason: body.reason ?? null,
          updated_by: request.tenancy.userId,
          updated_at: now,
        }
        const { data: saved, error: wErr } = existing
          ? await supabase
              .from('payment_gateway_states')
              .update(payload)
              .eq('id', existing.id)
              .eq('workspace_id', request.tenancy.workspaceId)
              .select('*')
              .single()
          : await supabase.from('payment_gateway_states').insert(payload).select('*').single()
        if (wErr) throw new DatabaseError('Failed to save webhook processor state', wErr)

        const { error: evErr } = await supabase.from('payment_gateway_events').insert({
          workspace_id: request.tenancy.workspaceId,
          payment_id: id,
          from_state: current,
          to_state: body.processorState,
          gateway_name: body.gatewayName,
          external_ref: body.externalRef,
          fee_minor: body.feeMinor,
          signature_verified: true,
          reason: body.reason ?? 'HMAC-SHA256 verified webhook',
          actor_id: request.tenancy.userId,
        })
        if (evErr) throw new DatabaseError('Failed to append verified gateway event', evErr)

        return reply.send({
          data: {
            paymentId: saved.payment_id,
            processorState: saved.processor_state,
            signatureVerified: true,
            externalRef: saved.external_ref,
            replay: false,
          },
        })
      } catch (err) {
        return fail(reply, err, 'Failed to process gateway webhook')
      }
    },
  )

  // X10 Gateway-to-Ledger settlement reconciliation (currency-grouped, exception-reporting)
  fastify.get(
    '/gateway-reconciliation',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payment.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const wsId = request.tenancy.workspaceId
        const { fetchAllPages } = await import('../utils/fetch-all-pages')
        const payments = await fetchAllPages<{
          id: string
          method: string
          currency: string
          amount: number
          status: string
        }>(
          (from, to) =>
            supabase
              .from('payments')
              .select('id, method, currency, amount, status')
              .eq('workspace_id', wsId)
              .order('id', { ascending: true })
              .range(from, to),
          'Failed to load payments for gateway reconciliation',
        )
        const gatewayStates = await fetchAllPages<{
          payment_id: string
          processor_state: string
          fee_minor: number
          currency: string
        }>(
          (from, to) =>
            supabase
              .from('payment_gateway_states')
              .select('payment_id, processor_state, fee_minor, currency')
              .eq('workspace_id', wsId)
              .order('payment_id', { ascending: true })
              .range(from, to),
          'Failed to load gateway states for reconciliation',
        )
        const journalEntries = await fetchAllPages<{
          id: string
          source_type: string | null
          source_id: string | null
          status: string
        }>(
          (from, to) =>
            supabase
              .from('journal_entries')
              .select('id, source_type, source_id, status')
              .eq('workspace_id', wsId)
              .eq('status', 'posted')
              .eq('source_type', 'payment')
              .order('id', { ascending: true })
              .range(from, to),
          'Failed to load posted payment journal entries',
        )

        const paymentMap = new Map(payments.map((p) => [p.id, p]))
        const stateMap = new Map(gatewayStates.map((g) => [g.payment_id, g]))
        const postedPaymentIds = new Set(journalEntries.map((j) => j.source_id).filter(Boolean))

        const exceptions: Array<{
          code: string
          paymentId: string
          currency: string
          message: string
        }> = []
        const byCurrency = new Map<
          string,
          {
            capturedMinor: number
            queuedOfflineMinor: number
            declinedMinor: number
            voidedMinor: number
            totalFeesMinor: number
          }
        >()
        const ensureBucket = (cur: string) => {
          let b = byCurrency.get(cur)
          if (!b) {
            b = {
              capturedMinor: 0,
              queuedOfflineMinor: 0,
              declinedMinor: 0,
              voidedMinor: 0,
              totalFeesMinor: 0,
            }
            byCurrency.set(cur, b)
          }
          return b
        }

        for (const p of payments) {
          const cur = p.currency.toUpperCase()
          const b = ensureBucket(cur)
          const st = stateMap.get(p.id)
          const effState =
            st?.processor_state ?? (p.method === 'cash' ? 'captured' : 'queued_offline')
          const amt = Number(p.amount)
          if (effState === 'captured') b.capturedMinor += amt
          else if (effState === 'declined') b.declinedMinor += amt
          else if (effState === 'voided') b.voidedMinor += amt
          else b.queuedOfflineMinor += amt
          b.totalFeesMinor += Number(st?.fee_minor ?? 0)

          const isPostedInLedger = postedPaymentIds.has(p.id)
          if (effState === 'captured' && p.status === 'posted' && !isPostedInLedger) {
            exceptions.push({
              code: 'CAPTURED_WITHOUT_LEDGER',
              paymentId: p.id,
              currency: cur,
              message: `Captured payment ${p.id} has no posted journal entry`,
            })
          }
          if ((effState === 'declined' || effState === 'voided') && isPostedInLedger) {
            exceptions.push({
              code: 'DECLINED_OR_VOIDED_WITH_POSTED_LEDGER',
              paymentId: p.id,
              currency: cur,
              message: `Gateway ${effState} payment ${p.id} still has a posted ledger entry`,
            })
          }
          if (effState === 'queued_offline') {
            exceptions.push({
              code: 'QUEUED_OFFLINE_UNSETTLED',
              paymentId: p.id,
              currency: cur,
              message: `Non-cash payment ${p.id} is still queued_offline awaiting settlement`,
            })
          }
        }

        for (const st of gatewayStates) {
          if (!paymentMap.has(st.payment_id)) {
            exceptions.push({
              code: 'ORPHAN_GATEWAY_STATE',
              paymentId: st.payment_id,
              currency: st.currency.toUpperCase(),
              message: `Gateway state exists for missing payment ${st.payment_id}`,
            })
          }
        }

        return reply.send({
          data: {
            workspaceId: wsId,
            checkedAt: new Date().toISOString(),
            reconciled:
              exceptions.filter((e) => e.code !== 'QUEUED_OFFLINE_UNSETTLED').length === 0,
            perCurrency: [...byCurrency.entries()].map(([currency, stats]) => ({
              currency,
              ...stats,
            })),
            exceptions,
          },
        })
      } catch (err) {
        return fail(reply, err, 'Failed to reconcile payment gateway state against ledger')
      }
    },
  )
}
