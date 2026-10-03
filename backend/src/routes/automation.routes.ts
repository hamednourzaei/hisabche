// ============================================
// backend/src/routes/automation.routes.ts
//
// Standing arrangements (capability #63 — recurring invoice).
//
//   reads    invoice.read    — whoever may see invoices may see what issues them
//   writes   invoice.create  — defining one is deciding that invoices will be
//                              issued; the same permission as issuing one
//
// Bodies are parsed in the handler: the template is the invoice body, and its
// real validation is the invoice's own schema inside the service.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { createRecurringInvoiceSchema, updateAutomationSchema } from '@hisabche/validation'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { automationService } from '../services/automation/automation.service'
import { invalidateMoneyCaches } from '../utils/money-cache'

const READ = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
const WRITE = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]

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

export async function automationRoutes(fastify: FastifyInstance) {
  fastify.get('/api/automations', { preHandler: READ }, async (request: FastifyRequest, reply) => {
    try {
      return reply.send({ automations: await automationService.list(request.tenancy) })
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to list automations')
    }
  })

  fastify.post(
    '/api/automations/recurring-invoice',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        const input = createRecurringInvoiceSchema.parse(request.body)
        const created = await automationService.createRecurringInvoice(request.tenancy, input)
        return reply.code(201).send(created)
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to create the recurring invoice')
      }
    },
  )

  fastify.patch(
    '/api/automations/:id',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        const patch = updateAutomationSchema.parse(request.body)
        return reply.send(await automationService.update(request.tenancy, id, patch))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to update the automation')
      }
    },
  )

  // Removes it from the list. Its history, and every invoice it issued, stay.
  fastify.delete(
    '/api/automations/:id',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        await automationService.archive(request.tenancy, id)
        return reply.code(204).send()
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to remove the automation')
      }
    },
  )

  fastify.get(
    '/api/automations/:id/runs',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        return reply.send({ runs: await automationService.runs(request.tenancy, id) })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read the automation history')
      }
    },
  )

  // Issue today's now. Refused with 409 when today's was already issued.
  fastify.post(
    '/api/automations/:id/run',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        const result = await automationService.runNow(request.tenancy, id)
        if (result.outcome === 'ran') await invalidateMoneyCaches(request.tenancy.workspaceId)
        return reply.send(result)
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to run the automation')
      }
    },
  )
}
