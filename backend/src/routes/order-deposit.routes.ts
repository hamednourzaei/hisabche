// ============================================
// backend/src/routes/order-deposit.routes.ts
//
// Fastify Routes for Order Deposits (Sales -> Orders / Invoices)
//
// P1 (V53): taking a deposit is a LIABILITY, not a sale. The service books
// Dr cash|bank / Cr customer advances through the existing ledger; this route
// only validates the request and hands the tenancy context over.
//
// APPLY and REFUND are one database transaction each
// (docs/order-deposit-apply-refund-01-migration.sql). The route passes the
// caller's idempotency key through unchanged — a retry must send the SAME key,
// which is why it is a body field and not a header the transport is free to
// regenerate.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { refundOrderDepositSchema, applyOrderDepositSchema } from '@hisabche/validation'
import { z } from 'zod'

import { sendFailure } from '../errors/http-failure'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { OrderDepositService } from '../services/sales/order-deposit.service'
import { ServiceDeliveryService } from '../services/service-delivery/service-delivery.service'
import { ValidationError } from '../errors/validation.error'
import { ForbiddenError } from '../errors/auth.error'
import { holds } from '../services/authorization/authorization.domain'
import { supabase } from '../db'

const createBody = z.object({
  /**
   * The deposit's own id, when the client already has one.
   *
   * A device that recorded the receipt offline has already stored the row and
   * references it from its ledger; the server must write THAT id, or the pull
   * back would leave the device with two deposits for one payment. Optional:
   * a browser does not send one and the database generates it.
   */
  id: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  /** V54 5.4: `service_session` = a booking deposit; the id in the path is the session. */
  sourceType: z.enum(['sales_order', 'service_session']).optional(),
  // Integer minor units: a fractional minor amount is a wrong request, not a
  // rounding detail, and the service refuses it as well.
  amountMinor: z.number().int().positive(),
  paymentMethod: z.string().trim().min(1).max(32).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

// advances-02: پیش‌فروش / پیش‌خرید — an advance is its own document.
const advanceBody = z
  .object({
    id: z.string().uuid().optional(),
    kind: z.enum(['pre_sale', 'pre_purchase']),
    /** The customer (pre-sale) or supplier (pre-purchase) — a row of this workspace. */
    partyId: z.string().uuid(),
    amountMinor: z.number().int().positive(),
    paymentMethod: z.string().trim().min(1).max(32).optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict()

const postBody = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export async function orderDepositRoutes(fastify: FastifyInstance) {
  const service = new OrderDepositService()
  const sessions = new ServiceDeliveryService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]
  // Moving money back out to a customer is a payment, not an invoice edit.
  const pay = [authenticate, requireWorkspaceContext, requireCapability('payment.record')]

  fastify.get(
    '/api/orders/:id/deposits',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const deposits = await service.getOrderDeposits(request.tenancy, id)
        return reply.send({ data: deposits })
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to read the order deposits')
      }
    },
  )

  // The same deposits, from the screen where a person actually meets them:
  // the customer's advances, each with what is left of it.
  fastify.get(
    '/api/customers/:id/deposits',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const deposits = await service.listCustomerDeposits(request.tenancy, id)
        return reply.send({ data: deposits })
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to read the customer deposits')
      }
    },
  )

  fastify.post(
    '/api/orders/:id/deposits',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = createBody.parse(request.body)
        // A booking deposit must belong to a real session of THIS workspace,
        // for THAT customer — the order path never checked its document, and
        // a deposit «for» someone else's session would be a liability in the
        // wrong name.
        if (body.sourceType === 'service_session') {
          const session = await sessions.getById(request.tenancy, id)
          if (session.customerId !== body.customerId) {
            throw new ValidationError('SESSION_DEPOSIT_CUSTOMER_MISMATCH')
          }
        }
        const { deposit, posting } = await service.createOrderDeposit(request.tenancy, {
          id: body.id,
          orderId: id,
          customerId: body.customerId,
          amountMinor: body.amountMinor,
          paymentMethod: body.paymentMethod,
          date: body.date,
          sourceType: body.sourceType,
        })
        // `posting` says whether the entry was written; a chart of accounts
        // that cannot express it leaves the deposit recorded as
        // `pending_posting` and reports it, rather than pretending the money
        // was booked.
        return reply.status(201).send({ data: deposit, posting })
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to record the order deposit')
      }
    },
  )

  // Re-post the RECEIPT of a deposit that was recorded while the chart of
  // accounts could not express the entry. Idempotent: an already-booked
  // deposit returns its existing entry and writes nothing.
  fastify.post(
    '/api/orders/:id/deposits/:depositId/post',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, depositId } = request.params as { id: string; depositId: string }
        const body = postBody.parse(request.body ?? {})
        const { deposit, posting } = await service.postReceipt(
          request.tenancy,
          id,
          depositId,
          body.date,
        )
        return reply.send({ data: deposit, posting })
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to post the order deposit receipt')
      }
    },
  )

  // ─── advances-02: pre-sale / pre-purchase ─────────────────────────────
  // Apply and refund go through the deposit routes below with the advance's
  // own id as the document (`/api/orders/<id>/deposits/<id>/apply`); the
  // service sends a pre-purchase to the supplier functions.
  fastify.get(
    '/api/advances',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const kind = (request.query as { kind?: string } | undefined)?.kind
        if (kind !== 'pre_sale' && kind !== 'pre_purchase') {
          throw new ValidationError('ADVANCE_KIND_REQUIRED')
        }
        return reply.send({ data: await service.listAdvances(request.tenancy, kind) })
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to read the advances')
      }
    },
  )

  fastify.post(
    '/api/advances',
    // Taking a customer's money is selling; paying a supplier first is paying.
    // The route asks for the weaker one and the handler for the right one.
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = advanceBody.parse(request.body)
        if (body.kind === 'pre_purchase' && !holds(request.tenancy, 'payment.record')) {
          throw new ForbiddenError('CAPABILITY_REQUIRED:payment.record')
        }
        // The party is a real customer/supplier of THIS workspace.
        const party = await supabase
          .from('customers')
          .select('id')
          .eq('workspace_id', request.tenancy.workspaceId)
          .eq('id', body.partyId)
          .maybeSingle()
        if (party.error) throw party.error
        if (!party.data) throw new ValidationError('ADVANCE_PARTY_NOT_FOUND')

        const { deposit, posting } = await service.createOrderDeposit(request.tenancy, {
          id: body.id,
          orderId: body.id ?? '',
          customerId: body.partyId,
          amountMinor: body.amountMinor,
          paymentMethod: body.paymentMethod,
          date: body.date,
          sourceType: body.kind,
          note: body.note,
        })
        return reply.status(201).send({ data: deposit, posting })
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to record the advance')
      }
    },
  )

  fastify.post(
    '/api/orders/:id/deposits/:depositId/apply',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, depositId } = request.params as { id: string; depositId: string }
        const body = applyOrderDepositSchema.parse(request.body)
        const application = await service.applyDeposit(request.tenancy, id, depositId, body)
        return reply.status(application.replayed ? 200 : 201).send({ data: application })
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to apply the order deposit')
      }
    },
  )

  fastify.post(
    '/api/orders/:id/deposits/:depositId/refund',
    { preHandler: pay },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, depositId } = request.params as { id: string; depositId: string }
        const body = refundOrderDepositSchema.parse(request.body)
        const refund = await service.refundDeposit(request.tenancy, id, depositId, body)
        return reply.status(refund.replayed ? 200 : 201).send({ data: refund })
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to refund the order deposit')
      }
    },
  )
}
