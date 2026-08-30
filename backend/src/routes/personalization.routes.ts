// ============================================
// backend/src/routes/personalization.routes.ts
//
// Registered with prefix '/api/personalization' in index.ts.
//
// A user's own UI preferences. Every route here needs only membership: hiding
// a module is not a privileged act, and gating it behind a capability would
// make the least-privileged users the ones who cannot tidy their own screen.
//
// These routes cannot grant access to anything. The profile is applied to an
// already-authorized list, never consulted in place of one.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { VisibilityService } from '../services/personalization'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

const patchSchema = z.object({
  level: z.enum(['module', 'page', 'widget', 'field']),
  /** Key → visible. Unmentioned keys keep whatever they had. */
  entries: z.record(z.boolean()),
})

export async function personalizationRoutes(fastify: FastifyInstance) {
  const visibilityService = new VisibilityService()

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

  fastify.get(
    '/visibility',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await visibilityService.get(request.tenancy))
      } catch (err) {
        return fail(reply, err, 'Failed to read the visibility profile')
      }
    },
  )

  fastify.patch(
    '/visibility',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: { body: toJsonSchema(patchSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { level, entries } = patchSchema.parse(request.body)
        return reply.send(await visibilityService.patch(request.tenancy, level, entries))
      } catch (err) {
        return fail(reply, err, 'Failed to save the visibility profile')
      }
    },
  )

  // ─── GET /visibility/hidden ────────────────────────────
  // Everything the user has hidden, so the interface can always offer it back.
  // Non-negotiable: there is ALWAYS a way to un-hide.
  fastify.get(
    '/visibility/hidden',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await visibilityService.hidden(request.tenancy))
      } catch (err) {
        return fail(reply, err, 'Failed to read hidden items')
      }
    },
  )

  fastify.post(
    '/visibility/reset',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await visibilityService.reset(request.tenancy))
      } catch (err) {
        return fail(reply, err, 'Failed to reset the visibility profile')
      }
    },
  )
}
