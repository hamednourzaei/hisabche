// ============================================
// backend/src/routes/repair.routes.ts
//
// Repair slips (retail-ops-01; QA document §9, 10 Nov 2026). Same
// permissions as service sessions: reading needs invoice.read, opening and
// moving a slip needs invoice.create — the slip ends in a sale invoice.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  REPAIR_STATUSES,
  repairBillCreateSchema,
  repairPartReserveSchema,
  repairTicketCreateSchema,
  repairTicketMoveSchema,
  type RepairStatus,
} from '@hisabche/validation'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { sendFailure } from '../errors/http-failure'
import { readClientRequestId } from '../utils/client-request'
import { invalidateMoneyCaches } from '../utils/money-cache'
import { RepairTicketService } from '../services/repair/repair-ticket.service'

const idOf = (request: FastifyRequest) => (request.params as { id: string }).id
const isUuid = (v: string) => z.string().uuid().safeParse(v).success

export async function repairRoutes(fastify: FastifyInstance) {
  const service = new RepairTicketService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]

  fastify.get(
    '/api/repair-tickets',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { status?: string; customerId?: string }
        const status =
          query.status === 'open'
            ? 'open'
            : REPAIR_STATUSES.find((s): s is RepairStatus => s === query.status)
        const data = await service.list(request.tenancy, {
          ...(status ? { status } : {}),
          ...(query.customerId && isUuid(query.customerId) ? { customerId: query.customerId } : {}),
        })
        return reply.send({ data })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to read the repair tickets')
      }
    },
  )

  fastify.get(
    '/api/repair-tickets/:id',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!isUuid(idOf(request))) return reply.code(400).send({ error: 'Invalid id' })
        return reply.send({ data: await service.get(request.tenancy, idOf(request)) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to read the repair ticket')
      }
    },
  )

  fastify.post(
    '/api/repair-tickets',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = repairTicketCreateSchema.parse(request.body)
        return reply.code(201).send({ data: await service.create(request.tenancy, body) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to open the repair ticket')
      }
    },
  )

  fastify.post(
    '/api/repair-tickets/:id/status',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!isUuid(idOf(request))) return reply.code(400).send({ error: 'Invalid id' })
        const body = repairTicketMoveSchema.parse(request.body)
        return reply.send({ data: await service.move(request.tenancy, idOf(request), body) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to move the repair ticket')
      }
    },
  )

  fastify.post(
    '/api/repair-tickets/:id/approve',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!isUuid(idOf(request))) return reply.code(400).send({ error: 'Invalid id' })
        return reply.send({ data: await service.approve(request.tenancy, idOf(request)) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to approve repair ticket')
      }
    },
  )

  fastify.post(
    '/api/repair-tickets/:id/parts',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!isUuid(idOf(request))) return reply.code(400).send({ error: 'Invalid id' })
        const body = repairPartReserveSchema.parse(request.body)
        return reply
          .code(201)
          .send({ data: await service.addPart(request.tenancy, idOf(request), body) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to reserve repair part')
      }
    },
  )

  fastify.post(
    '/api/repair-tickets/:id/parts/:partId/consume',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, partId } = request.params as { id: string; partId: string }
        if (!isUuid(id) || !isUuid(partId)) return reply.code(400).send({ error: 'Invalid id' })
        const data = await service.consumePart(request.tenancy, id, partId)
        await invalidateMoneyCaches(request.tenancy.workspaceId)
        return reply.send({ data })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to consume repair part')
      }
    },
  )

  fastify.post(
    '/api/repair-tickets/:id/parts/:partId/release',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, partId } = request.params as { id: string; partId: string }
        if (!isUuid(id) || !isUuid(partId)) return reply.code(400).send({ error: 'Invalid id' })
        return reply.send({ data: await service.releasePart(request.tenancy, id, partId) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to release repair part')
      }
    },
  )

  fastify.post(
    '/api/repair-tickets/:id/bill',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!isUuid(idOf(request))) return reply.code(400).send({ error: 'Invalid id' })
        const body = repairBillCreateSchema.parse(request.body ?? {})
        const data = await service.createFinalBill(
          request.tenancy,
          idOf(request),
          body,
          readClientRequestId(request),
        )
        await invalidateMoneyCaches(request.tenancy.workspaceId)
        return reply.code(201).send({ data })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to bill repair ticket')
      }
    },
  )
}
