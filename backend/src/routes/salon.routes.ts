// ============================================
// backend/src/routes/salon.routes.ts
//
// Salon parts of the service core (salon-01, provider-commission-01; QA
// document §8, 10 Nov 2026). Reading follows the sessions (invoice.read);
// resources and the catalog are set-up of what is sold (product.write);
// commission rates and the commission report are pay (payroll.write /
// payroll.read).
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  commissionRateSchema,
  resourceBookingCreateSchema,
  serviceCatalogSchema,
  serviceResourcePatchSchema,
  serviceResourceSchema,
} from '@hisabche/validation'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { sendFailure } from '../errors/http-failure'
import { SalonService } from '../services/salon/salon.service'

const DAY = /^\d{4}-\d{2}-\d{2}$/
const isUuid = (v: string) => z.string().uuid().safeParse(v).success

export async function salonRoutes(fastify: FastifyInstance) {
  const service = new SalonService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const setup = [authenticate, requireWorkspaceContext, requireCapability('product.write')]
  const payRead = [authenticate, requireWorkspaceContext, requireCapability('payroll.read')]
  const payWrite = [authenticate, requireWorkspaceContext, requireCapability('payroll.write')]

  const handle =
    (what: string, run: (request: FastifyRequest) => Promise<unknown>, status = 200) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.code(status).send({ data: await run(request) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, what)
      }
    }
  const withId =
    (what: string, run: (request: FastifyRequest, id: string) => Promise<unknown>) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      if (!isUuid(id)) return reply.code(400).send({ error: 'Invalid id' })
      return handle(what, (r) => run(r, id))(request, reply)
    }

  fastify.get(
    '/api/service-resources',
    { preHandler: read },
    handle('Failed to read the resources', (r) => service.resources(r.tenancy)),
  )
  fastify.post(
    '/api/service-resources',
    { preHandler: setup },
    handle(
      'Failed to add the resource',
      (r) => service.createResource(r.tenancy, serviceResourceSchema.parse(r.body)),
      201,
    ),
  )
  fastify.patch(
    '/api/service-resources/:id',
    { preHandler: setup },
    withId('Failed to update the resource', (r, id) =>
      service.updateResource(r.tenancy, id, serviceResourcePatchSchema.parse(r.body)),
    ),
  )

  fastify.get(
    '/api/service-catalog',
    { preHandler: read },
    handle('Failed to read the service catalog', (r) => service.catalog(r.tenancy)),
  )
  fastify.put(
    '/api/service-catalog/:id',
    { preHandler: setup },
    withId('Failed to save the service', (r, id) =>
      service.saveCatalog(r.tenancy, id, serviceCatalogSchema.parse(r.body)),
    ),
  )

  fastify.get(
    '/api/provider-commissions/rates',
    { preHandler: payRead },
    handle('Failed to read the commission rates', (r) => service.commissionRates(r.tenancy)),
  )
  fastify.put(
    '/api/provider-commissions/rates',
    { preHandler: payWrite },
    handle('Failed to save the commission rate', (r) =>
      service.setCommissionRate(r.tenancy, commissionRateSchema.parse(r.body)),
    ),
  )
  fastify.get(
    '/api/provider-commissions/my',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { from, to } = request.query as { from?: string; to?: string }
      if (!from || !to || !DAY.test(from) || !DAY.test(to) || from > to) {
        return reply
          .code(400)
          .send({ error: 'COMMISSION_RANGE_INVALID', code: 'COMMISSION_RANGE_INVALID' })
      }
      return handle('Failed to compute your commission', (r) =>
        service.myCommission(r.tenancy, from, to),
      )(request, reply)
    },
  )
  fastify.get(
    '/api/provider-commissions',
    { preHandler: payRead },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { from, to } = request.query as { from?: string; to?: string }
      if (!from || !to || !DAY.test(from) || !DAY.test(to) || from > to) {
        return reply
          .code(400)
          .send({ error: 'COMMISSION_RANGE_INVALID', code: 'COMMISSION_RANGE_INVALID' })
      }
      return handle('Failed to compute the commission', (r) =>
        service.commission(r.tenancy, from, to),
      )(request, reply)
    },
  )

  // ─── Generalized Resource Capacity & Interval Bookings (V60 Slice 7) ──────
  fastify.get(
    '/api/resource-bookings',
    { preHandler: read },
    handle('Failed to read resource bookings', (r) => {
      const q = (r.query ?? {}) as { resourceId?: string }
      return service.listResourceBookings(r.tenancy, q.resourceId)
    }),
  )

  fastify.post(
    '/api/resource-bookings',
    { preHandler: setup },
    handle(
      'Failed to book resource slot',
      (r) => service.bookResource(r.tenancy, resourceBookingCreateSchema.parse(r.body)),
      201,
    ),
  )

  fastify.post(
    '/api/resource-bookings/:id/release',
    { preHandler: setup },
    withId('Failed to release resource booking', (r, id) =>
      service.releaseResourceBooking(r.tenancy, id),
    ),
  )

  fastify.get(
    '/api/service-resources/:id/slots',
    { preHandler: read },
    withId('Failed to read resource availability', (r, id) => {
      const q = (r.query ?? {}) as { startAt?: string; endAt?: string; slotMinutes?: string }
      const startAt = q.startAt ?? new Date().toISOString()
      const endAt = q.endAt ?? new Date(Date.now() + 8 * 60 * 60_000).toISOString()
      const slotMinutes = q.slotMinutes ? Number(q.slotMinutes) : 60
      return service.getResourceSlots(r.tenancy, id, { startAt, endAt }, slotMinutes)
    }),
  )
}
