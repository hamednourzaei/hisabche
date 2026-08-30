// ============================================
// backend/src/routes/intelligence.routes.ts
//
// Registered with prefix '/api/intelligence' in index.ts.
//
// Duplicate detection and merging (MDM), and the deterministic figures a
// copilot explains (insights).
//
// Both need the financial capability: a duplicate list names every customer,
// and an insight is a profit figure. Merging needs more still — it moves debts
// between identities.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { MdmService } from '../services/mdm'
import { InsightsService } from '../services/insights'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

const entitySchema = z.enum(['customer', 'supplier', 'product'])

const mergeSchema = z.object({
  entity: entitySchema,
  survivorId: z.string().uuid(),
  absorbedId: z.string().uuid(),
  /** Never optional. "Why are these one customer" must have an answer. */
  reason: z.string().min(1).max(500),
})

const periodSchema = z.object({
  from: z.string().min(8),
  to: z.string().min(8),
})

export async function intelligenceRoutes(fastify: FastifyInstance) {
  const mdmService = new MdmService()
  const insightsService = new InsightsService()

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

  // ─── GET /duplicates/:entity ───────────────────────────
  fastify.get(
    '/duplicates/:entity',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('customer.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { entity } = request.params as { entity: string }
        const { minScore } = request.query as { minScore?: string }

        return reply.send(
          await mdmService.findDuplicates(
            request.tenancy,
            entitySchema.parse(entity),
            minScore ? Number(minScore) : 0.5,
          ),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to find duplicates')
      }
    },
  )

  // ─── GET /duplicates/:entity/compare ───────────────────
  fastify.get(
    '/duplicates/:entity/compare',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('customer.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { entity } = request.params as { entity: string }
        const { leftId, rightId } = request.query as { leftId: string; rightId: string }

        return reply.send(
          await mdmService.comparePair(
            request.tenancy,
            entitySchema.parse(entity),
            leftId,
            rightId,
          ),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to compare the pair')
      }
    },
  )

  // ─── POST /merge ───────────────────────────────────────
  // Never automatic: a merge moves invoices, debts and payment history between
  // identities, and undoing a wrong one is far more expensive than leaving the
  // duplicate in place for another day.
  fastify.post(
    '/merge',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('customer.write')],
      schema: { body: toJsonSchema(mergeSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { entity, ...input } = mergeSchema.parse(request.body)
        return reply.send(await mdmService.merge(request.tenancy, entity, input))
      } catch (err) {
        return fail(reply, err, 'Failed to merge the records')
      }
    },
  )

  fastify.get(
    '/merges',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.operational.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await mdmService.listMerges(request.tenancy))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch merge history')
      }
    },
  )

  // ─── GET /summary ──────────────────────────────────────
  fastify.get(
    '/summary',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: { querystring: toJsonSchema(periodSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { from, to } = periodSchema.parse(request.query)
        return reply.send(await insightsService.getPeriodSummary(request.tenancy, from, to))
      } catch (err) {
        return fail(reply, err, 'Failed to build the summary')
      }
    },
  )

  // ─── POST /explain ─────────────────────────────────────
  // The structure a copilot is HANDED. It phrases this; it never computes it.
  fastify.post(
    '/explain',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: {
        body: toJsonSchema(z.object({ current: periodSchema, previous: periodSchema })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { current, previous } = z
          .object({ current: periodSchema, previous: periodSchema })
          .parse(request.body)

        return reply.send(
          await insightsService.explainProfitChange(request.tenancy, current, previous),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to explain the change')
      }
    },
  )

  // ─── GET /anomalies ────────────────────────────────────
  fastify.get(
    '/anomalies',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: { querystring: toJsonSchema(periodSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { from, to } = periodSchema.parse(request.query)
        return reply.send(await insightsService.findAnomalies(request.tenancy, from, to))
      } catch (err) {
        return fail(reply, err, 'Failed to find anomalies')
      }
    },
  )
}
