// ============================================
// backend/src/routes/analytics.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { dateRangeSchema } from '@hisabche/validation'
import { AnalyticsService } from '../services/analytics.service'
import { authenticate } from '../middleware/auth.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function analyticsRoutes(fastify: FastifyInstance) {
  const analyticsService = new AnalyticsService()

  // ══════════════════════════════════════════════════════
  // DASHBOARD KPIs
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/analytics/dashboard ─────────────────────────
  fastify.get('/api/analytics/dashboard', {
    preHandler: [authenticate],
    schema: {
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const kpis = await analyticsService.getDashboardKpis(request.userId)
      return reply.send(kpis)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch dashboard KPIs' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // SALES ANALYTICS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/analytics/sales ─────────────────────────────
  fastify.get('/api/analytics/sales', {
    preHandler: [authenticate],
    schema: {
      querystring: toJsonSchema(dateRangeSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dateRange = dateRangeSchema.parse(request.query)
      const summary = await analyticsService.getSalesSummary(request.userId, dateRange)
      return reply.send(summary)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch sales analytics' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // INVENTORY ANALYTICS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/analytics/inventory ─────────────────────────
  fastify.get('/api/analytics/inventory', {
    preHandler: [authenticate],
    schema: {
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const summary = await analyticsService.getInventorySummary(request.userId)
      return reply.send(summary)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch inventory analytics' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // FINANCIAL ANALYTICS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/analytics/financial ─────────────────────────
  fastify.get('/api/analytics/financial', {
    preHandler: [authenticate],
    schema: {
      querystring: toJsonSchema(dateRangeSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dateRange = dateRangeSchema.parse(request.query)
      const summary = await analyticsService.getFinancialSummary(request.userId, dateRange)
      return reply.send(summary)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch financial analytics' })
    }
  })
}