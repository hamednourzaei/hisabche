// ============================================
// backend/src/routes/ai.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { aiQuerySchema } from '@hisabche/validation'
import { AIService } from '../services/ai.service'
import { authenticate } from '../middleware/auth.middleware'
import { cacheMiddleware } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function aiRoutes(fastify: FastifyInstance) {
  const aiService = new AIService()

  // ─── POST /api/ai/query ───────────────────────────
  fastify.post('/api/ai/query', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(aiQuerySchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = aiQuerySchema.parse(request.body)
      const response = await aiService.processQuery(request.userId, query)
      return reply.send(response)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to process AI query' })
    }
  })

  // ─── GET /api/ai/insights ─────────────────────────────────
  fastify.get('/api/ai/insights', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 300, keyPrefix: 'insights' })],
    schema: {
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const insights = await aiService.getInsights(request.userId)
      return reply.send(insights)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch insights' })
    }
  })
}