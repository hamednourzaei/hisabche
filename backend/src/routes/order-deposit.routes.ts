// ============================================
// backend/src/routes/order-deposit.routes.ts
//
// Fastify Routes for Order Deposits (Sales -> Orders / Invoices)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { OrderDepositService } from '../services/sales/order-deposit.service'

export async function orderDepositRoutes(fastify: FastifyInstance) {
  const service = new OrderDepositService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]

  fastify.get(
    '/api/orders/:id/deposits',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const { id } = request.params as { id: string }
      const deposits = await service.getOrderDeposits(workspaceId, id)
      return reply.send({ data: deposits })
    },
  )

  fastify.post(
    '/api/orders/:id/deposits',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const { id } = request.params as { id: string }
      const body = request.body as {
        customerId: string
        amountMinor: number
        paymentMethod?: string | undefined
      }
      const deposit = await service.createOrderDeposit(workspaceId, {
        orderId: id,
        customerId: body.customerId,
        amountMinor: body.amountMinor,
        paymentMethod: body.paymentMethod,
      })
      return reply.status(201).send({ data: deposit })
    },
  )
}
