// ============================================
// backend/src/routes/metal-rates.routes.ts
//
// Fastify Routes for Metal Rates (Sales builder / Settings -> metal unit)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { MetalRatesService } from '../services/pricing/metal-rates.service'

export async function metalRatesRoutes(fastify: FastifyInstance) {
  const service = new MetalRatesService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]

  fastify.get(
    '/api/metal-rates/latest',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const rate = await service.getLatestMetalRate(workspaceId)
      return reply.send({ data: rate })
    },
  )

  fastify.post(
    '/api/metal-rates',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { rateDate: string; rate24kMinorPerGram: number }
      const workspaceId = request.tenancy.workspaceId
      const recorded = await service.recordMetalRate(workspaceId, {
        rateDate: body.rateDate,
        rate24kMinorPerGram: body.rate24kMinorPerGram,
      })
      return reply.status(201).send({ data: recorded })
    },
  )
}
