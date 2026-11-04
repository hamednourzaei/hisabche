// ============================================
// backend/src/routes/warranty.routes.ts
//
// Fastify Routes for Warranties (Sales -> Invoice Detail / Stock)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireProfileCapability } from '../middleware/profile-capability.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { WarrantyService } from '../services/sales/warranty.service'

export async function warrantyRoutes(fastify: FastifyInstance) {
  const service = new WarrantyService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  // A warranty is recorded PER SERIAL NUMBER, which only a workspace with `serialized_items` can use.
  // The permission below is still required on its own; the profile grants nothing (D4 = B).
  const write = [
    authenticate,
    requireWorkspaceContext,
    requireCapability('invoice.create'),
    requireProfileCapability('serialized_items'),
  ]

  fastify.get(
    '/api/warranties',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const warranties = await service.getWarranties(workspaceId)
      return reply.send({ data: warranties })
    },
  )

  fastify.post(
    '/api/warranties',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const body = request.body as {
        invoiceId: string
        productId: string
        serialNumber?: string | undefined
        startDate: string
        warrantyMonths: number
        customerId?: string | undefined
      }
      const warranty = await service.registerWarranty(workspaceId, body)
      return reply.status(201).send({ data: warranty })
    },
  )
}
