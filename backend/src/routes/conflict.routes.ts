// ============================================
// backend/src/routes/conflict.routes.ts
//
// Registered with prefix '/api/conflicts' in index.ts.
//
// The review queue for offline writes the server refused, and the one place a
// decision about them can be applied.
//
// Resolving a conflict rewrites a financial record on the strength of a
// person's judgement, so it is an owner's call — the same bar as reversing a
// posted entry, and for the same reason.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { ConflictService } from '../services/conflict'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

const resolveSchema = z.object({
  choice: z.enum(['keep_server', 'keep_client', 'merge']),
  /** Required for `merge`: which side each diverging field takes. */
  fieldChoices: z.record(z.enum(['server', 'client'])).optional(),
  /** Never optional. A financial correction with no reason is unauditable. */
  reason: z.string().min(1).max(500),
})

export async function conflictRoutes(fastify: FastifyInstance) {
  const conflictService = new ConflictService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      const code = /^[A-Z][A-Z_]{6,}/.exec(err.message)?.[0]
      return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  // ─── GET / ─────────────────────────────────────────────
  fastify.get(
    '/',
    {
      // A manager can SEE what is waiting; only an owner decides it.
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('ledger.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { status } = request.query as { status?: 'open' | 'resolved' | 'all' }
        return reply.send(await conflictService.list(request.tenancy, status ?? 'open'))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch conflicts')
      }
    },
  )

  // ─── GET /:id ──────────────────────────────────────────
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('ledger.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await conflictService.get(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch conflict')
      }
    },
  )

  // ─── POST /:id/resolve ─────────────────────────────────
  fastify.post(
    '/:id/resolve',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('ledger.reverse')],
      schema: {
        body: toJsonSchema(resolveSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = resolveSchema.parse(request.body)
        return reply.send(await conflictService.resolve(request.tenancy, id, body))
      } catch (err) {
        return fail(reply, err, 'Failed to resolve conflict')
      }
    },
  )
}
