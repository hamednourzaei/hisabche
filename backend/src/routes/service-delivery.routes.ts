// ============================================
// backend/src/routes/service-delivery.routes.ts
//
// Fastify Routes for Service Delivery & Attendance (M4)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { ServiceDeliveryService } from '../services/service-delivery/service-delivery.service'
import { sendFailure } from '../errors/http-failure'
import { sendCreated } from '../utils/client-request'

export async function serviceDeliveryRoutes(fastify: FastifyInstance) {
  const service = new ServiceDeliveryService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]

  // ─── 1. GET /api/service-delivery/sessions ─────────────────────
  fastify.get(
    '/api/service-delivery/sessions',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = (request.query || {}) as {
          date?: string
          customerId?: string
          practitionerId?: string
          status?: string
        }
        const sessions = await service.list(request.tenancy, query)
        return reply.send({ data: sessions })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch service delivery sessions')
      }
    },
  )

  // ─── 2. GET /api/service-delivery/sessions/:id ─────────────────
  fastify.get(
    '/api/service-delivery/sessions/:id',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const session = await service.getById(request.tenancy, id)
        return reply.send({ data: session })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch service delivery session')
      }
    },
  )

  // ─── 3. POST /api/service-delivery/sessions ────────────────────
  fastify.post(
    '/api/service-delivery/sessions',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = (request.body || {}) as Parameters<typeof service.create>[1]
        const session = await service.create(request.tenancy, body)
        return sendCreated(reply, session)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create service delivery session')
      }
    },
  )

  // ─── 4. POST /api/service-delivery/sessions/:id/deliver ────────
  fastify.post(
    '/api/service-delivery/sessions/:id/deliver',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = (request.body || {}) as Parameters<typeof service.deliver>[2]
        // The answer has the same shape the device gives (no {data} wrapper), so one hook reads both.
        const result = await service.deliver(request.tenancy, id, body)
        return reply.send(result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to deliver service session')
      }
    },
  )

  // ─── 4b. POST /api/service-delivery/sessions/:id/status ────────
  // «حاضر شد» / «نیامد». Only the moves that carry no money; delivery and
  // cancellation keep their own routes and transactions.
  fastify.post(
    '/api/service-delivery/sessions/:id/status',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = (request.body || {}) as { to?: unknown; status?: unknown }
        // The device's outbox replays the whole session row, whose field is
        // `status`; a person's tap sends `to`. Both name the same move.
        const to = typeof body.to === 'string' ? body.to : String(body.status ?? '')
        const result = await service.moveStatus(request.tenancy, id, to)
        return reply.send(result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to change service session status')
      }
    },
  )

  // ─── 5. POST /api/service-delivery/sessions/:id/cancel ─────────
  fastify.post(
    '/api/service-delivery/sessions/:id/cancel',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = (request.body || {}) as {
          reversalEntryId?: string | undefined
          reason?: string | undefined
        }
        const result = await service.cancel(request.tenancy, id, {
          reversalEntryId: body.reversalEntryId,
          reason: body.reason,
        })
        return reply.send(result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to cancel service delivery session')
      }
    },
  )
}
