// ============================================
// backend/src/routesapi/analytics.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { AnalyticsService } from '../services/analytics.service'
import { authenticate } from '../middleware/auth.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

// ═══════════════════════════════════════════════════════════
// ✅ Production Schemas
// ═══════════════════════════════════════════════════════════

const SalesSummarySchema = z.object({
  totalRevenue: z.number(),
  totalInvoices: z.number(),
  averageInvoiceValue: z.number(),
  totalPaid: z.number(),
  totalUnpaid: z.number(),
  byCurrency: z.record(z.number()),
  byPeriod: z.array(
    z.object({
      period: z.string(),
      revenue: z.number(),
      count: z.number(),
    })
  ),
  topProducts: z.array(z.any()),
  topCustomers: z.array(z.any()),
  chartData: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
      date: z.string(),
    })
  ),
})

const DashboardKPIsSchema = z.object({
  todaySales: z.number(),
  todayInvoices: z.number(),
  monthlyRevenue: z.number(),
  monthlyGrowth: z.number(),
  pendingPayments: z.number(),
  activeCustomers: z.number(),
  lowStockAlerts: z.number(),
})

const DateRangeSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export default async function analyticsRoutes(fastify: FastifyInstance) {
  const analyticsService = new AnalyticsService()

  // ══════════════════════════════════════════════════════
  // DASHBOARD KPIs
  // ═══════════════════════════════════════════════════════════

  fastify.get('api/analytics/dashboard', {
    preHandler: [authenticate],
    schema: {
      response: {
        200: toJsonSchema(DashboardKPIsSchema),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const kpis = await analyticsService.getDashboardKpis(request.userId)
      const validated = DashboardKPIsSchema.parse(kpis)
      return reply.send(validated)
    } catch (err) {
      if (err instanceof z.ZodError) {
        fastify.log.error({ err: err.errors }, 'Dashboard validation failed')
        return reply.code(500).send({ error: 'Data validation failed' })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch dashboard KPIs' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // SALES ANALYTICS — Production Ready ✅
  // ═══════════════════════════════════════════════════════════

  fastify.get('api/analytics/sales', {
    preHandler: [authenticate],
    schema: {
      querystring: toJsonSchema(DateRangeSchema),
      response: {
        200: toJsonSchema(SalesSummarySchema),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as {
        days?: number
        startDate?: string
        endDate?: string
      }

      const today = new Date()
      const startDate = query.startDate || new Date(today.getTime() - (query.days || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const endDate = query.endDate || today.toISOString().split('T')[0]

      const dateRange: { startDate: string; endDate: string } = {
        startDate: startDate as string,
        endDate: endDate as string,
      }

      const summary = await analyticsService.getSalesSummary(request.userId, dateRange)

      // ✅ Validate with Zod before sending
      const validated = SalesSummarySchema.parse(summary)
      return reply.send(validated)

    } catch (err) {
      if (err instanceof z.ZodError) {
        fastify.log.error({ err: err.errors }, 'Sales validation failed')
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch sales analytics' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // INVENTORY ANALYTICS
  // ═══════════════════════════════════════════════════════════

  fastify.get('api/analytics/inventory', {
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

  fastify.get('api/analytics/financial', {
    preHandler: [authenticate],
    schema: {
      querystring: toJsonSchema(
        z.object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
      ),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as {
        startDate?: string
        endDate?: string
      }

      const today = new Date()
      const startDate = query.startDate || new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const endDate = query.endDate || today.toISOString().split('T')[0]

      const dateRange: { startDate: string; endDate: string } = {
        startDate: startDate as string,
        endDate: endDate as string,
      }

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