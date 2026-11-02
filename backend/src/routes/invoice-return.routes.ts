// ============================================
// backend/src/routes/invoice-return.routes.ts
//
// Fastify Routes for Invoice Returns (Sales -> Invoices)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { ValidationError } from '../errors/validation.error'
import type { ReturnCondition, ReturnDeductionRequest } from '@hisabche/validation'
import { InvoiceReturnService } from '../services/sales/invoice-return.service'
import { sendFailure } from '../errors/http-failure'
import { readClientRequestId, sendCreated } from '../utils/client-request'
import { invalidateMoneyCaches } from '../utils/money-cache'

export async function invoiceReturnRoutes(fastify: FastifyInstance) {
  const service = new InvoiceReturnService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]
  // Paying money back to a customer is a payment, and is held to the payment rule.
  const refund = [authenticate, requireWorkspaceContext, requireCapability('payment.record')]

  fastify.get(
    '/api/invoices/:id/returns',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const workspaceId = request.tenancy.workspaceId
        const { id } = request.params as { id: string }
        const returns = await service.getReturns(workspaceId, id)
        return reply.send({ data: returns })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch invoice returns')
      }
    },
  )

  fastify.post(
    '/api/invoices/:id/returns',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const workspaceId = request.tenancy.workspaceId
        const userId = request.tenancy.userId
        const { id } = request.params as { id: string }
        const clientRequestId = readClientRequestId(request)
        const body = request.body as {
          returnType: 'sale_return' | 'purchase_return'
          returnNumber: string
          returnDate: string
          reasonCode?: string | undefined
          notes?: string | undefined
          deductions?: ReturnDeductionRequest[] | undefined
          lines: Array<{
            originalLineId: string
            quantity?: number | undefined
            returnQuantity?: number | undefined
            restockChoice?: 'restock' | 'scrap' | undefined
            reasonCode?:
              | 'defective'
              | 'wrong_item'
              | 'customer_change_of_mind'
              | 'damaged_in_transit'
              | 'expired'
              | 'other'
              | undefined
            conditionCode?: ReturnCondition | undefined
          }>
        }
        // A body with no list of lines must be refused here: it would otherwise reach the
        // service as a TypeError (a 500) — and the one return an invoice may have is not
        // to be spent on an empty document.
        if (!Array.isArray(body?.lines)) throw new ValidationError('RETURN_LINES_REQUIRED')
        const ret = await service.createReturn(workspaceId, {
          originalInvoiceId: id,
          userId,
          clientRequestId,
          returnType: body.returnType,
          returnNumber: body.returnNumber,
          returnDate: body.returnDate,
          reasonCode: body.reasonCode,
          notes: body.notes,
          deductions: body.deductions,
          lines: body.lines.map((l) => ({
            originalLineId: l.originalLineId,
            returnQuantity: l.returnQuantity ?? l.quantity ?? 1,
            restockChoice: l.restockChoice ?? 'restock',
            reasonCode: l.reasonCode ?? 'other',
            conditionCode: l.conditionCode,
          })),
        })
        // A return changes the customer's statement and balance, the dashboard and
        // stock; a cached copy would keep showing the figures from before it
        // (BUG-008: it stayed «unpaid» for two minutes after a payment).
        await invalidateMoneyCaches(workspaceId)
        return sendCreated(reply, { data: ret })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create invoice return')
      }
    },
  )

  // Money paid back against a return: its own event, recorded by the payment core.
  fastify.post(
    '/api/invoices/:id/returns/:returnId/refunds',
    { preHandler: refund },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, returnId } = request.params as { id: string; returnId: string }
        const body = request.body as {
          amount?: number
          method?: 'cash' | 'bank'
          tillSessionId?: string | null
          entryDate?: string
        }
        const result = await service.refundReturn(request.tenancy, id, returnId, {
          amount: Number(body?.amount),
          method: body?.method as 'cash' | 'bank',
          tillSessionId: body?.tillSessionId ?? null,
          entryDate: body?.entryDate,
          clientRequestId: readClientRequestId(request),
        })
        await invalidateMoneyCaches(request.tenancy.workspaceId)
        return sendCreated(reply, { data: result })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to refund invoice return')
      }
    },
  )
}
