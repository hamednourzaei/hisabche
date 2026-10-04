// ============================================
// backend/src/routes/installments.routes.ts
//
// Capability #123 — the installment plan of one invoice.
//
//   GET    /api/invoices/:id/installments   invoice.read
//   PUT    /api/invoices/:id/installments   invoice.update   { count, firstDueDate }
//   DELETE /api/invoices/:id/installments   invoice.update
//
// A plan changes WHEN an invoice is due, so it is an edit of the invoice — not
// a payment. Recording money stays with the payments routes.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { installmentService } from '../services/commerce/installment.service'
import { invalidateMoneyCaches } from '../utils/money-cache'

const READ = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
const WRITE = [authenticate, requireWorkspaceContext, requireCapability('invoice.update')]

const idParams = z.object({ id: z.string().uuid() })
const planBody = z.object({
  // A single payment is not a plan; five years of months is the ceiling.
  count: z.number().int().min(2).max(60),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

export async function installmentRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/invoices/:id/installments',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        return reply.send(await installmentService.get(request.tenancy, id))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read the installment plan')
      }
    },
  )

  fastify.put(
    '/api/invoices/:id/installments',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        const plan = await installmentService.plan(
          request.tenancy,
          id,
          planBody.parse(request.body),
        )
        await invalidateMoneyCaches(request.tenancy.workspaceId)
        return reply.send(plan)
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to save the installment plan')
      }
    },
  )

  fastify.delete(
    '/api/invoices/:id/installments',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        const plan = await installmentService.clear(request.tenancy, id)
        await invalidateMoneyCaches(request.tenancy.workspaceId)
        return reply.send(plan)
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to remove the installment plan')
      }
    },
  )
}
