// ============================================
// backend/src/routes/transport.routes.ts
//
// Fastify Routes for Transport (Sales -> Orders -> Delivery View)
// Freight, Courier COD (settled via PaymentsService), Delivery Notes (POD as
// columns), and WP-19 fleet / dispatch / closing at the door.
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
  // WP-19: the cashier may settle what the driver actually handed in, which can
  // be less than the amount due. The difference stays a receivable.
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
  // A signature is the ordinary way a customer accepts a parcel. Older callers
  // sent only a recipient name; they still mean «signed for». A photo or a code
  // has to be named explicitly, and is then verified by the shared rule.
  method: z.enum(['signature', 'photo', 'code']).default('signature'),
  recipientName: z.string().trim().min(1).max(200),
  // Required for `method: 'code'`, and checked against the code on the note.
  code: z.string().trim().min(1).max(40).optional(),
  // Required for `method: 'photo'`: a storage reference, not the bytes.
  photoRef: z.string().trim().min(1).max(500).optional(),
  deliveredAt: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(400).optional(),
})

const fleetCreateBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  plateNumber: z.string().trim().min(1).max(40).optional(),
  assetId: z.string().uuid().optional(),
  // Absent = never declared (unknown). A declared 0 is refused by the database.
  capacityParcels: z.number().int().positive().optional(),
  nextServiceDueOn: z.string().trim().min(4).max(40).optional(),
  odometerKm: z.number().int().min(0).optional(),
  notes: z.string().trim().max(500).optional(),
})

const vehicleServiceBodySchema = z.object({
  serviceOn: z.string().trim().min(4).max(40),
  nextServiceDueOn: z.string().trim().min(4).max(40).optional(),
  odometerKm: z.number().int().min(0).optional(),
  notes: z.string().trim().max(500).optional(),
})

const assignBodySchema = z
  .object({
    vehicleId: z.string().uuid().optional(),
    driverEmployeeId: z.string().uuid().optional(),
    plannedOn: z.string().trim().min(4).max(40),
  })
  // A dispatch with neither a vehicle nor a driver names nobody who is
  // responsible for the parcel, which is the one thing a dispatch is for.
  .refine((body) => Boolean(body.vehicleId || body.driverEmployeeId), {
    message: 'DISPATCH_DRIVER_OR_VEHICLE_REQUIRED',
  })

const closeBodySchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('delivered'),
    pod: z.object({
      method: z.enum(['signature', 'photo', 'code']),
      recipientName: z.string().trim().min(1).max(200),
      code: z.string().trim().min(1).max(40).optional(),
      photoRef: z.string().trim().min(1).max(500).optional(),
      capturedAt: z.string().trim().max(40).optional(),
      notes: z.string().trim().max(400).optional(),
    }),
    // Absent = the full COD amount was collected at the door. A shortfall is
    // computed, never sent by the client.
    collectedMinor: z.number().int().min(0).optional(),
  }),
  z.object({
    outcome: z.literal('failed'),
    failureReason: z.string().trim().min(1).max(400),
  }),
])

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

  // ─── Fleet & Dispatch (WP-19) ───────────────────────────────
  fastify.get(
    '/api/deliveries/fleet',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = (request.query || {}) as { onDate?: string | undefined }
        // A dispatch day, not a clock: the date the run is planned for.
        const onDate = query.onDate?.trim() || new Date().toISOString().slice(0, 10)
        const fleet = await service.getDeliveryFleet(request.tenancy.workspaceId, onDate)
        return reply.send({ data: fleet })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to load the delivery fleet')
      }
    },
  )

  fastify.post(
    '/api/deliveries/fleet',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = fleetCreateBodySchema.parse(request.body)
        const vehicle = await service.createDeliveryVehicle(request.tenancy, body)
        return reply.status(201).send({ data: vehicle })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to add the vehicle')
      }
    },
  )

  fastify.post(
    '/api/deliveries/fleet/:id/service',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        const body = vehicleServiceBodySchema.parse(request.body)
        const vehicle = await service.recordVehicleService(request.tenancy, id, body)
        return reply.status(201).send({ data: vehicle })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to record the service')
      }
    },
  )

  fastify.post(
    '/api/deliveries/courier/:id/assign',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        const body = assignBodySchema.parse(request.body)
        const delivery = await service.assignCourierDelivery(request.tenancy, id, body)
        return reply.send({ data: delivery })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to put the parcel on the run')
      }
    },
  )

  fastify.post(
    '/api/deliveries/courier/:id/close',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        const body = closeBodySchema.parse(request.body)
        const clientRequestId = readClientRequestId(request)
        const closed = await service.closeCourierDelivery(
          request.tenancy,
          id,
          body.outcome === 'delivered'
            ? {
                outcome: 'delivered',
                pod: body.pod,
                collectedMinor: body.collectedMinor,
                clientRequestId,
              }
            : { outcome: 'failed', failureReason: body.failureReason, clientRequestId },
        )
        return reply.send({ data: closed })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to close the delivery')
      }
    },
  )

  // ─── Delivery Notes & POD ───────────────────────────────────
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
        const pod = await service.recordDeliveryPod(request.tenancy, id, body)
        return reply.status(201).send({ data: pod })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to record proof of delivery')
      }
    },
  )
}
