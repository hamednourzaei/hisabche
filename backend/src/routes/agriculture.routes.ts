// ============================================
// backend/src/routes/agriculture.routes.ts
//
// Fastify Routes for Agriculture & Livestock (Production)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { AgricultureService } from '../services/manufacturing/agriculture.service'

export async function agricultureRoutes(fastify: FastifyInstance) {
  const service = new AgricultureService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]

  // ─── Crop Cycles ────────────────────────────────────────────
  fastify.get(
    '/api/agriculture/crops',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const crops = await service.getCropCycles(workspaceId)
      return reply.send({ data: crops })
    },
  )

  fastify.post(
    '/api/agriculture/crops',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const body = request.body as {
        landUnitId: string
        cropName: string
        plantingDate: string
        expectedHarvestDate?: string | undefined
      }
      const crop = await service.createCropCycle(workspaceId, body)
      return reply.status(201).send({ data: crop })
    },
  )

  // ─── Livestock Groups ───────────────────────────────────────
  fastify.get(
    '/api/agriculture/livestock',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const livestock = await service.getLivestockGroups(workspaceId)
      return reply.send({ data: livestock })
    },
  )

  fastify.post(
    '/api/agriculture/livestock',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const body = request.body as {
        category: string
        headCount: number
        birthOrAcquisitionDate: string
        locationBarn?: string | undefined
      }
      const group = await service.recordLivestockGroup(workspaceId, body)
      return reply.status(201).send({ data: group })
    },
  )
}
