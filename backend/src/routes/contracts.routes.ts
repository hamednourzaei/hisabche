// ============================================
// backend/src/routes/contracts.routes.ts
//
// V60 Slice 9 — Contracts, recurring billing, termination, SLA breach flags & lease returns.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  contractBillPeriodSchema,
  contractCreateSchema,
  contractLeaseReturnSchema,
  contractSlaBreachSchema,
} from '@hisabche/validation'
import { sendFailure } from '../errors/http-failure'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { ContractsService } from '../services/contracts/contracts.service'

const uuidParam = z.object({ id: z.string().uuid() })

export async function contractsRoutes(fastify: FastifyInstance) {
  const service = new ContractsService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]

  fastify.get(
    '/api/contracts',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send({ data: await service.listContracts(request.tenancy) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to list contracts')
      }
    },
  )

  fastify.post(
    '/api/contracts',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = contractCreateSchema.parse(request.body)
        return reply.code(201).send({ data: await service.createContract(request.tenancy, body) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create contract')
      }
    },
  )

  fastify.post(
    '/api/contracts/:id/bill',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        const body = contractBillPeriodSchema.parse(request.body)
        const result = await service.billPeriod(request.tenancy, id, body)
        // A new period invoice is a created document (201); a replay of the same
        // period returns the first one (200) — the same rule as POST /api/orders.
        return reply.code(result.replayed ? 200 : 201).send({ data: result })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to bill contract period')
      }
    },
  )

  fastify.post(
    '/api/contracts/:id/terminate',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        return reply.send({ data: await service.terminateContract(request.tenancy, id) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to terminate contract')
      }
    },
  )

  fastify.post(
    '/api/contracts/:id/sla-breach',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        const body = contractSlaBreachSchema.parse(request.body)
        return reply.send({ data: await service.flagSlaBreach(request.tenancy, id, body) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to record SLA breach')
      }
    },
  )

  fastify.post(
    '/api/contracts/:id/lease-return',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        const body = contractLeaseReturnSchema.parse(request.body)
        return reply.send({
          data: await service.returnLeaseAsset(request.tenancy, id, {
            conditionCode: body.conditionCode,
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
          }),
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to return leased asset')
      }
    },
  )
}
