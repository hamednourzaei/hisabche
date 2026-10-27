// ============================================
// backend/src/routes/fitment.routes.ts
//
// Fastify Routes for Auto Fitments and Vehicles (Stock -> Products)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { FitmentService } from '../services/inventory/fitment.service'

export async function fitmentRoutes(fastify: FastifyInstance) {
  const service = new FitmentService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('product.read')]
  const productWrite = [authenticate, requireWorkspaceContext, requireCapability('product.write')]

  // ─── Fitments ───────────────────────────────────────────────
  fastify.get(
    '/api/products/:id/fitments',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const workspaceId = request.tenancy.workspaceId
      const fitments = await service.getFitments(workspaceId, id)
      return reply.send({ data: fitments })
    },
  )

  fastify.post(
    '/api/products/:id/fitments',
    { preHandler: productWrite },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const body = request.body as {
        make: string
        model: string
        yearStart: number
        yearEnd: number
        notes?: string | undefined
      }
      const workspaceId = request.tenancy.workspaceId
      const fitment = await service.addFitment(workspaceId, {
        productId: id,
        make: body.make,
        model: body.model,
        yearStart: body.yearStart,
        yearEnd: body.yearEnd,
        notes: body.notes,
      })
      return reply.status(201).send({ data: fitment })
    },
  )

  // ─── Vehicles ───────────────────────────────────────────────
  fastify.get(
    '/api/vehicles',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const vehicles = await service.getVehicles(workspaceId)
      return reply.send({ data: vehicles })
    },
  )

  fastify.post(
    '/api/vehicles',
    { preHandler: productWrite },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        productId: string
        vin: string
        make: string
        model: string
        year: number
        colour: string
        odometer: number
        receivedDate: string
        basePurchaseCostMinor: number
      }
      const workspaceId = request.tenancy.workspaceId
      const vehicle = await service.createVehicle(workspaceId, body)
      return reply.status(201).send({ data: vehicle })
    },
  )
}
