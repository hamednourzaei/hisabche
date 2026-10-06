// ============================================
// backend/src/routes/ai.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { aiQuerySchema } from '@hisabche/validation'
import { AIService } from '../services/ai.service'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { cacheMiddleware } from '../middleware/cache.middleware'
import { requireCapability } from '../middleware/authorize.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function aiRoutes(fastify: FastifyInstance) {
  const aiService = new AIService()

  // ─── POST /api/ai/query ───────────────────────────
  fastify.post(
    '/api/ai/query',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        body: toJsonSchema(aiQuerySchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = aiQuerySchema.parse(request.body)
        const response = await aiService.processQuery(request.tenancy, query)
        return reply.send(response)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to process AI query' })
      }
    },
  )

  // ─── GET /api/ai/insights ─────────────────────────────────
  fastify.get(
    '/api/ai/insights',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        // The suggestions are written FROM invoices, customers and stock —
        // «فلان مشتری بدهکار است» is that data, in a sentence. All three, or
        // none: one cached answer per business must not tell a member what
        // their role keeps from them.
        requireCapability('invoice.read'),
        requireCapability('customer.read'),
        requireCapability('product.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 300, keyPrefix: 'insights' }),
      ],
      schema: {
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const insights = await aiService.getInsights(request.tenancy)
        return reply.send(insights)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch insights' })
      }
    },
  )
}
