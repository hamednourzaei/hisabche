// ============================================
// backend/src/routes/transport.routes.ts
//
// Fastify Routes for Transport (Sales -> Transport Tab)
// Freight, Courier COD, and Delivery Notes.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { TransportService } from '../services/transport/transport.service'

export async function transportRoutes(fastify: FastifyInstance) {
  const service = new TransportService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]

  // ─── Freight Trips ──────────────────────────────────────────
  const handleGetTrips = async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = request.tenancy.workspaceId
    const trips = await service.getFreightTrips(workspaceId)
    return reply.send({ data: trips })
  }

  const handlePostTrip = async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = request.tenancy.workspaceId
    const body = request.body as {
      origin: string
      destination: string
      startDate: string
      vehicleAssetId?: string | undefined
      driverEmployeeId?: string | undefined
    }
    const trip = await service.createFreightTrip(workspaceId, body)
    return reply.status(201).send({ data: trip })
  }

  fastify.get('/api/freight/trips', { preHandler: read }, handleGetTrips)
  fastify.get('/api/transport/trips', { preHandler: read }, handleGetTrips)
  fastify.post('/api/freight/trips', { preHandler: write }, handlePostTrip)
  fastify.post('/api/transport/trips', { preHandler: write }, handlePostTrip)

  // ─── Courier & COD ──────────────────────────────────────────
  const handleGetCourier = async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = request.tenancy.workspaceId
    const deliveries = await service.getCourierDeliveries(workspaceId)
    return reply.send({ data: deliveries })
  }

  const handlePostCourier = async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = request.tenancy.workspaceId
    const body = request.body as {
      trackingNumber: string
      customerName: string
      destinationAddress: string
      codAmountMinor?: number | undefined
      driverEmployeeId?: string | undefined
    }
    const delivery = await service.createCourierDelivery(workspaceId, body)
    return reply.status(201).send({ data: delivery })
  }

  const handleProgressCod = async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = request.tenancy.workspaceId
    const { id } = request.params as { id: string }
    const updated = await service.progressCod(workspaceId, id)
    return reply.send({ data: updated })
  }

  fastify.get('/api/courier/deliveries', { preHandler: read }, handleGetCourier)
  fastify.get('/api/deliveries/courier', { preHandler: read }, handleGetCourier)
  fastify.post('/api/courier/deliveries', { preHandler: write }, handlePostCourier)
  fastify.post('/api/deliveries/courier', { preHandler: write }, handlePostCourier)
  fastify.patch('/api/courier/deliveries/:id/cod-status', { preHandler: write }, handleProgressCod)
  fastify.post('/api/deliveries/courier/:id/progress-cod', { preHandler: write }, handleProgressCod)

  // ─── Delivery Notes ─────────────────────────────────────────
  const handleGetNotes = async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = request.tenancy.workspaceId
    const query = (request.query || {}) as { invoiceId?: string | undefined }
    const notes = await service.getDeliveryNotes(workspaceId, query.invoiceId)
    return reply.send({ data: notes })
  }

  const handlePostNote = async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = request.tenancy.workspaceId
    const body = request.body as {
      invoiceId: string
      noteNumber: string
      deliveryDate: string
      carrierNotes?: string | undefined
      lines: Array<{ invoiceLineId: string; productId: string; quantityDelivered: number }>
    }
    const note = await service.createDeliveryNote(workspaceId, body)
    return reply.status(201).send({ data: note })
  }

  fastify.get('/api/delivery-notes', { preHandler: read }, handleGetNotes)
  fastify.get('/api/deliveries/notes', { preHandler: read }, handleGetNotes)
  fastify.post('/api/delivery-notes', { preHandler: write }, handlePostNote)
  fastify.post('/api/deliveries/notes', { preHandler: write }, handlePostNote)
}
