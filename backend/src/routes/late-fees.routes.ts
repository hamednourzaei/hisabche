// ============================================
// backend/src/routes/late-fees.routes.ts
//
// Capability #124 — late payment fees.
//
//   GET   /api/late-fees/policy                  invoice.read
//   PUT   /api/late-fees/policy                  manager and up
//   GET   /api/invoices/:id/late-fees            invoice.read    (a preview; charges nothing)
//   POST  /api/invoices/:id/late-fees            manager and up  { language }
//
// Charging a customer a penalty is a manager's decision, and so is the policy.
// There is no job and no automatic charge. There is no DELETE: a fee charged by
// mistake is corrected by cancelling its invoice, like any other invoice.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { LATE_FEE_LANGUAGES, lateFeeService } from '../services/commerce/late-fee.service'
import { requireRole } from '../services/tenancy.service'
import { invalidateMoneyCaches } from '../utils/money-cache'

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

export async function lateFeeRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/late-fees/policy',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        return reply.send({ policy: await lateFeeService.policy(request.tenancy) })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read the late fee policy')
      }
    },
  )

  fastify.put(
    '/api/late-fees/policy',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        return reply.send({
          policy: await lateFeeService.savePolicy(request.tenancy, request.body),
        })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to save the late fee policy')
      }
    },
  )

  fastify.get(
    '/api/invoices/:id/late-fees',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        return reply.send(await lateFeeService.preview(request.tenancy, id))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read the late fees')
      }
    },
  )

  fastify.post(
    '/api/invoices/:id/late-fees',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        const { language } = z
          .object({ language: z.enum(LATE_FEE_LANGUAGES).default('fa') })
          .parse(request.body ?? {})
        try {
          return reply.send(await lateFeeService.assess(request.tenancy, id, language))
        } finally {
          // A fee invoice may have been issued even when a later step failed.
          await invalidateMoneyCaches(request.tenancy.workspaceId)
        }
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to charge the late fee')
      }
    },
  )
}
