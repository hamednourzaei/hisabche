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
  // Integer minor units: a fractional minor amount is a wrong request, not a
  // rounding detail, and the service refuses it as well.
  amountMinor: z.number().int().positive(),
  paymentMethod: z.string().trim().min(1).max(32).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

const postBody = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export async function orderDepositRoutes(fastify: FastifyInstance) {
  const service = new OrderDepositService()
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
        const { deposit, posting } = await service.createOrderDeposit(request.tenancy, {
          id: body.id,
          orderId: id,
          customerId: body.customerId,
          amountMinor: body.amountMinor,
          paymentMethod: body.paymentMethod,
          date: body.date,
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
