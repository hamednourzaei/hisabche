// ============================================
// backend/src/routes/transport.routes.ts
//
// Fastify Routes for Transport (Sales -> Orders -> Delivery View)
// Freight, Courier COD (settled via PaymentsService), and Delivery Notes (+ append-only POD).
// Canonical route paths matching packages/api/src/hooks/universal-core.ts.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { sendFailure } from '../errors/http-failure'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { TransportService } from '../services/transport/transport.service'
import { readClientRequestId } from '../utils/client-request'

const uuidParam = z.object({ id: z.string().uuid() })

const tripBodySchema = z.object({
  origin: z.string().trim().min(1).max(200),
  destination: z.string().trim().min(1).max(200),
  startDate: z.string().trim().min(4).max(40),
  vehicleAssetId: z.string().uuid().optional(),
  driverEmployeeId: z.string().uuid().optional(),
})

const courierBodySchema = z.object({
  trackingNumber: z.string().trim().min(1).max(80),
  customerName: z.string().trim().min(1).max(200),
  destinationAddress: z.string().trim().min(1).max(400),
  codAmountMinor: z.number().int().min(0).optional(),
  driverEmployeeId: z.string().uuid().optional(),
})

const settleCodBodySchema = z.object({
  invoiceId: z.string().uuid(),
  method: z.enum(['cash', 'bank']).optional(),
  amountMinor: z.number().int().positive().optional(),
  notes: z.string().trim().max(300).optional(),
})

const deliveryNoteBodySchema = z.object({
  invoiceId: z.string().uuid(),
  noteNumber: z.string().trim().min(1).max(80),
  deliveryDate: z.string().trim().min(4).max(40),
  carrierNotes: z.string().trim().max(500).optional(),
  lines: z
    .array(
      z.object({
        invoiceLineId: z.string().min(1),
        productId: z.string().uuid(),
        quantityDelivered: z.number().positive(),
      }),
    )
    .min(1),
})

const podBodySchema = z.object({
  recipientName: z.string().trim().min(1).max(200),
  deliveredAt: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(400).optional(),
})

export async function transportRoutes(fastify: FastifyInstance) {
  const service = new TransportService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]

  // ─── Freight Trips ──────────────────────────────────────────
  fastify.get(
    '/api/transport/trips',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const trips = await service.getFreightTrips(request.tenancy.workspaceId)
        return reply.send({ data: trips })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to load freight trips')
      }
    },
  )

  fastify.post(
    '/api/transport/trips',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = tripBodySchema.parse(request.body)
        const trip = await service.createFreightTrip(request.tenancy.workspaceId, body)
        return reply.status(201).send({ data: trip })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create freight trip')
      }
    },
  )

  // ─── Courier & COD ──────────────────────────────────────────
  fastify.get(
    '/api/deliveries/courier',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const deliveries = await service.getCourierDeliveries(request.tenancy.workspaceId)
        return reply.send({ data: deliveries })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to load courier deliveries')
      }
    },
  )

  fastify.post(
    '/api/deliveries/courier',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = courierBodySchema.parse(request.body)
        const delivery = await service.createCourierDelivery(request.tenancy.workspaceId, body)
        return reply.status(201).send({ data: delivery })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create courier delivery')
      }
    },
  )

  fastify.post(
    '/api/deliveries/courier/:id/progress-cod',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        const updated = await service.progressCod(request.tenancy.workspaceId, id)
        return reply.send({ data: updated })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to advance COD status')
      }
    },
  )

  fastify.post(
    '/api/deliveries/courier/:id/settle-cod',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        const body = settleCodBodySchema.parse(request.body)
        const settled = await service.settleCourierCod(request.tenancy, id, {
          ...body,
          clientRequestId: readClientRequestId(request),
        })
        return reply.send({ data: settled })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to settle COD payment')
      }
    },
  )

  // ─── Delivery Notes & Append-Only POD ───────────────────────
  fastify.get(
    '/api/deliveries/notes',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = (request.query || {}) as { invoiceId?: string | undefined }
        const notes = await service.getDeliveryNotes(request.tenancy.workspaceId, query.invoiceId)
        return reply.send({ data: notes })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to load delivery notes')
      }
    },
  )

  fastify.post(
    '/api/deliveries/notes',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = deliveryNoteBodySchema.parse(request.body)
        const note = await service.createDeliveryNote(request.tenancy.workspaceId, body)
        return reply.status(201).send({ data: note })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create delivery note')
      }
    },
  )

  fastify.post(
    '/api/deliveries/notes/:id/pod',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        const body = podBodySchema.parse(request.body)
        const event = await service.recordDeliveryPod(request.tenancy, id, body)
        return reply.status(201).send({ data: event })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to record proof of delivery')
      }
    },
  )
}
