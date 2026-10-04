// ============================================
// backend/src/routes/saved-views.routes.ts
//
// Capabilities #87 and #89 — named looks of the application's tables.
// Any member: a view is the reader's own way of looking at rows their role
// already lets them see. Ownership (who may change or remove a view) is
// enforced in the service.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import {
  savedViewStateSchema,
  savedViewTableIdSchema,
  savedViewsService,
} from '../services/saved-views.service'

const MEMBER = [authenticate, requireWorkspaceContext]
const idParams = z.object({ id: z.string().uuid() })
const nameSchema = z.string().trim().min(1).max(60)

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

export async function savedViewsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/saved-views',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        const { tableId } = z.object({ tableId: savedViewTableIdSchema }).parse(request.query)
        return reply.send({ views: await savedViewsService.list(request.tenancy, tableId) })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read saved views')
      }
    },
  )

  fastify.post(
    '/api/saved-views',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        const input = z
          .object({
            tableId: savedViewTableIdSchema,
            name: nameSchema,
            state: savedViewStateSchema,
            shared: z.boolean().default(false),
          })
          .parse(request.body)
        return reply.code(201).send(await savedViewsService.create(request.tenancy, input))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to save the view')
      }
    },
  )

  fastify.patch(
    '/api/saved-views/:id',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        const patch = z
          .object({
            name: nameSchema.optional(),
            shared: z.boolean().optional(),
            state: savedViewStateSchema.optional(),
          })
          .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to change' })
          .parse(request.body)
        return reply.send(await savedViewsService.update(request.tenancy, id, patch))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to update the view')
      }
    },
  )

  fastify.delete(
    '/api/saved-views/:id',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        await savedViewsService.remove(request.tenancy, id)
        return reply.code(204).send()
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to remove the view')
      }
    },
  )
}
