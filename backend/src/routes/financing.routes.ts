// ============================================
// backend/src/routes/financing.routes.ts
//
// Capabilities #125 (loans) and #126 (investments) — registers beside the
// books. Nothing here posts a journal entry.
//
//   GET   /api/financing/facilities             ledger.read
//   POST  /api/financing/facilities             ledger.read + manager and up
//   PATCH /api/financing/facilities/:id/active  ledger.read + manager and up
//   GET   /api/financing/holdings               ledger.read
//   POST  /api/financing/holdings               ledger.read + manager and up
//   PATCH /api/financing/holdings/:id           ledger.read + manager and up
//
// What the business owes and holds is for the people who see the books.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { currencyCodeSchema } from '@hisabche/validation'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { financingService } from '../services/financing/financing.service'
import { requireRole } from '../services/tenancy.service'

const BOOKS = [authenticate, requireWorkspaceContext, requireCapability('ledger.read')]
const isoDay = z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
const idParams = z.object({ id: z.string().uuid() })
const frequency = z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(12)])

const facilityBody = z.object({
  kind: z.enum(['loan', 'receivable_facility']),
  counterparty: z.string().trim().min(1).max(120),
  principal: z.number().positive(),
  currency: currencyCodeSchema,
  annualRatePercent: z.number().min(0).max(1000),
  startDate: isoDay,
  endDate: isoDay.nullable().default(null),
  chargesPerYear: frequency,
})
const holdingBody = z.object({
  label: z.string().trim().min(1).max(120),
  cost: z.number().min(0),
  marketValue: z.number().min(0),
  currency: currencyCodeSchema,
  valuedOn: isoDay,
})
const holdingPatch = z.object({
  marketValue: z.number().min(0).optional(),
  valuedOn: isoDay.optional(),
  isActive: z.boolean().optional(),
})

function fail(fastify: FastifyInstance, reply: FastifyReply, err: unknown, fallback: string) {
  if (err instanceof z.ZodError) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: err.errors[0]?.message ?? 'Validation failed',
      details: err.errors.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
  }
  if (err instanceof BaseError && (err.statusCode < 500 || err.statusCode === 503)) {
    return reply.code(err.statusCode).send({ error: err.name, message: err.message })
  }
  fastify.log.error(err)
  return reply.code(500).send({ error: 'Internal Server Error', message: fallback })
}

export async function financingRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/financing/facilities',
    { preHandler: BOOKS },
    async (request: FastifyRequest, reply) => {
      try {
        return reply.send(await financingService.facilities(request.tenancy))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read loans')
      }
    },
  )

  fastify.post(
    '/api/financing/facilities',
    { preHandler: BOOKS },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        return reply
          .code(201)
          .send(
            await financingService.createFacility(
              request.tenancy,
              facilityBody.parse(request.body),
            ),
          )
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to save the loan')
      }
    },
  )

  fastify.patch(
    '/api/financing/facilities/:id/active',
    { preHandler: BOOKS },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        const { isActive } = z.object({ isActive: z.boolean() }).parse(request.body)
        return reply.send(await financingService.setFacilityActive(request.tenancy, id, isActive))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to update the loan')
      }
    },
  )

  fastify.get(
    '/api/financing/holdings',
    { preHandler: BOOKS },
    async (request: FastifyRequest, reply) => {
      try {
        return reply.send(await financingService.holdings(request.tenancy))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read holdings')
      }
    },
  )

  fastify.post(
    '/api/financing/holdings',
    { preHandler: BOOKS },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        return reply
          .code(201)
          .send(
            await financingService.createHolding(request.tenancy, holdingBody.parse(request.body)),
          )
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to save the holding')
      }
    },
  )

  fastify.patch(
    '/api/financing/holdings/:id',
    { preHandler: BOOKS },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        return reply.send(
          await financingService.updateHolding(
            request.tenancy,
            id,
            holdingPatch.parse(request.body),
          ),
        )
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to update the holding')
      }
    },
  )
}
