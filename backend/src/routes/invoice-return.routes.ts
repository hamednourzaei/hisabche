// ============================================
// backend/src/routes/invoice-return.routes.ts
//
// Fastify Routes for Invoice Returns (Sales -> Invoices)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { InvoiceReturnService } from '../services/sales/invoice-return.service'
import { sendFailure } from '../errors/http-failure'

export async function invoiceReturnRoutes(fastify: FastifyInstance) {
  const service = new InvoiceReturnService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]

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
        const body = request.body as {
          returnType: 'sale_return' | 'purchase_return'
          returnNumber: string
          returnDate: string
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
          }>
        }
        const ret = await service.createReturn(workspaceId, {
          originalInvoiceId: id,
          userId,
          returnType: body.returnType,
          returnNumber: body.returnNumber,
          returnDate: body.returnDate,
          lines: body.lines.map((l) => ({
            originalLineId: l.originalLineId,
            returnQuantity: l.returnQuantity ?? l.quantity ?? 1,
            restockChoice: l.restockChoice ?? 'restock',
            reasonCode: l.reasonCode ?? 'other',
          })),
        })
        return reply.status(201).send({ data: ret })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create invoice return')
      }
    },
  )
}
