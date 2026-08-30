// ============================================
// backend/src/routes/governance.routes.ts
//
// Registered with prefix '/api/governance' in index.ts.
//
// Segregation of duties: what is enforced in this workspace, and every time
// somebody was allowed past it.
//
// The override LOG is readable by a manager on purpose. A control whose
// bypasses only the person who bypassed them can see is not a control.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { SOD_RULES, SoDService } from '../services/authorization'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

const settingsSchema = z.object({
  mode: z.enum(['off', 'warn', 'strict']).optional(),
  disabledRules: z.array(z.string()).optional(),
})

export async function governanceRoutes(fastify: FastifyInstance) {
  const sodService = new SoDService()

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

  // ─── GET /sod ──────────────────────────────────────────
  // What is enforced right now, and the full catalogue so a workspace can see
  // what it is choosing between.
  fastify.get(
    '/sod',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const described = await sodService.describe(request.tenancy)
        return reply.send({ ...described, catalogue: SOD_RULES })
      } catch (err) {
        return fail(reply, err, 'Failed to read the SoD settings')
      }
    },
  )

  // ─── PUT /sod ──────────────────────────────────────────
  fastify.put(
    '/sod',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')],
      schema: {
        body: toJsonSchema(settingsSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = settingsSchema.parse(request.body)
        return reply.send(await sodService.setSettings(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to save the SoD settings')
      }
    },
  )

  // ─── GET /sod/overrides ────────────────────────────────
  fastify.get(
    '/sod/overrides',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { limit } = request.query as { limit?: string }
        return reply.send(await sodService.listOverrides(request.tenancy, Number(limit) || 100))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch SoD overrides')
      }
    },
  )
}
