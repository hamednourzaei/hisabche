// ============================================
// backend/src/routes/promotions.routes.ts
//
// Capabilities #114–#117 — promotions.
//
//   GET    /api/promotions[?active=1]   invoice.read    (a seller prices lines)
//   POST   /api/promotions/quote        invoice.read
//   POST   /api/promotions              manager and up
//   PATCH  /api/promotions/:id/active   manager and up  { isActive }
//
// Deciding what is discounted is a manager's decision; applying it is not.
// There is no DELETE and no edit: a promotion is retired, never removed or
// rewritten — a changed rule is a new promotion, so the one an old invoice was
// priced with still reads as it did.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { currencyCodeSchema } from '@hisabche/validation'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { promotionService } from '../services/commerce/promotion.service'
import { requireRole } from '../services/tenancy.service'

const READ = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
const idParams = z.object({ id: z.string().uuid() })

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

export async function promotionRoutes(fastify: FastifyInstance) {
  fastify.get('/api/promotions', { preHandler: READ }, async (request: FastifyRequest, reply) => {
    try {
      const { active } = z.object({ active: z.enum(['0', '1']).optional() }).parse(request.query)
      return reply.send({
        promotions: await promotionService.list(request.tenancy, { activeOnly: active === '1' }),
      })
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to read promotions')
    }
  })

  fastify.post(
    '/api/promotions/quote',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const input = z
          .object({
            productId: z.string().uuid(),
            customerId: z.string().uuid().nullable().default(null),
            quantity: z.number().positive(),
            currency: currencyCodeSchema,
          })
          .parse(request.body)
        return reply.send(await promotionService.quote(request.tenancy, input))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to quote the price')
      }
    },
  )

  fastify.post('/api/promotions', { preHandler: READ }, async (request: FastifyRequest, reply) => {
    try {
      requireRole(request.tenancy, 'manager')
      return reply.code(201).send(await promotionService.create(request.tenancy, request.body))
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to save the promotion')
    }
  })

  fastify.patch(
    '/api/promotions/:id/active',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        const { isActive } = z.object({ isActive: z.boolean() }).parse(request.body)
        return reply.send(await promotionService.setActive(request.tenancy, id, isActive))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to update the promotion')
      }
    },
  )
}
