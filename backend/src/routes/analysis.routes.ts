// ============================================
// backend/src/routes/analysis.routes.ts
//
// The read side of six Business-OS engines (see analysis.service.ts). All
// GET, all computed from rows the workspace already has.
//
//   collections, customer risk     report.operational.read  (seller and up —
//                                  the people who chase the money)
//   suppliers, break-even, cohorts, working capital  report.financial.read    (manager and up —
//                                  cost, margin and spend)
//
// Nothing here is cached by the route: a worklist that is two minutes stale
// tells someone to chase a customer who has just paid.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { currencyCodeSchema } from '@hisabche/validation'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { analysisService } from '../services/analysis/analysis.service'

const OPERATIONAL = [
  authenticate,
  requireWorkspaceContext,
  requireCapability('report.operational.read'),
]
const FINANCIAL = [
  authenticate,
  requireWorkspaceContext,
  requireCapability('report.financial.read'),
]

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

function fail(fastify: FastifyInstance, reply: FastifyReply, err: unknown, fallback: string) {
  if (err instanceof z.ZodError) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: err.errors[0]?.message ?? 'Validation failed',
      details: err.errors.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
  }
  if (err instanceof BaseError && err.statusCode < 500) {
    return reply.code(err.statusCode).send({ error: err.name, message: err.message })
  }
  fastify.log.error(err)
  return reply.code(500).send({ error: 'Internal Server Error', message: fallback })
}

export async function analysisRoutes(fastify: FastifyInstance) {
  // Who to remind today, and how firmly.
  fastify.get(
    '/api/analysis/collections',
    { preHandler: OPERATIONAL },
    async (request: FastifyRequest, reply) => {
      try {
        return reply.send(await analysisService.collections(request.tenancy))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to build the collections worklist')
      }
    },
  )

  // How one customer has paid, and what that says.
  fastify.get(
    '/api/analysis/customers/:id/risk',
    { preHandler: OPERATIONAL },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        return reply.send(await analysisService.customerRisk(request.tenancy, id))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to assess the customer')
      }
    },
  )

  fastify.get(
    '/api/analysis/suppliers',
    { preHandler: FINANCIAL },
    async (request: FastifyRequest, reply) => {
      try {
        return reply.send(await analysisService.suppliers(request.tenancy))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to assess the suppliers')
      }
    },
  )

  fastify.get(
    '/api/analysis/break-even',
    { preHandler: FINANCIAL },
    async (request: FastifyRequest, reply) => {
      try {
        const query = z
          .object({
            from: isoDay,
            to: isoDay,
            currency: currencyCodeSchema,
            // Absent = not stated. The result is then a lower bound and says so;
            // an absent figure is never read as zero.
            otherFixedCosts: z.coerce.number().min(0).optional(),
          })
          .refine((value) => value.from <= value.to, { message: 'analysis.errors.range' })
          .parse(request.query)
        return reply.send(
          await analysisService.breakEven(request.tenancy, {
            from: query.from,
            to: query.to,
            currency: query.currency,
            otherFixedCosts: query.otherFixedCosts ?? null,
          }),
        )
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to compute the break-even point')
      }
    },
  )

  fastify.get(
    '/api/analysis/working-capital',
    { preHandler: FINANCIAL },
    async (request: FastifyRequest, reply) => {
      try {
        const query = z
          .object({ from: isoDay, to: isoDay, currency: currencyCodeSchema })
          .refine((value) => value.from <= value.to, { message: 'analysis.errors.range' })
          .parse(request.query)
        return reply.send(await analysisService.workingCapital(request.tenancy, query))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to compute working capital')
      }
    },
  )

  fastify.get(
    '/api/analysis/cohorts',
    { preHandler: FINANCIAL },
    async (request: FastifyRequest, reply) => {
      try {
        return reply.send(await analysisService.cohorts(request.tenancy))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to build the cohorts')
      }
    },
  )
}
