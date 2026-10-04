// ============================================
// backend/src/routes/escalation.routes.ts
//
// Capability #68 — the escalation policy of a workflow, and what escalation did.
//
//   reads    any member — the same as the approvals themselves
//   writes   manager and up. There is no workflow capability in the
//            authorization model yet (the workflow routes check membership
//            only), so the role is checked directly: deciding who ELSE may
//            approve is not something a seller sets for their own documents.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireRole } from '../services/tenancy.service'
import { escalationService } from '../services/workflow/escalation.service'

const idParams = z.object({ id: z.string().uuid() })

/** `afterHours: null` switches escalation off; then the role is not needed. */
const policySchema = z.object({
  afterHours: z
    .number()
    .positive()
    .max(24 * 90)
    .nullable(),
  toRole: z.enum(['manager', 'owner']).nullable(),
  maxTimes: z.number().int().min(1).max(5).default(1),
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

export async function escalationRoutes(fastify: FastifyInstance) {
  const READ = [authenticate, requireWorkspaceContext]
  const WRITE = [authenticate, requireWorkspaceContext]

  fastify.get(
    '/api/v1/workflows/:id/escalation',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        return reply.send(await escalationService.getPolicy(request.tenancy, id))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read the escalation policy')
      }
    },
  )

  fastify.put(
    '/api/v1/workflows/:id/escalation',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        requireRole(request.tenancy, 'manager')
        const input = policySchema.parse(request.body)
        return reply.send(await escalationService.setPolicy(request.tenancy, id, input))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to save the escalation policy')
      }
    },
  )

  fastify.get(
    '/api/v1/workflow-escalations',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        return reply.send({ escalations: await escalationService.recent(request.tenancy) })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read escalations')
      }
    },
  )
}
