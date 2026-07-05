// ============================================
// backend/src/routes/analytics.routes.ts
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
// ✅ Sales Summary Schema — Production Grade
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

export async function analyticsRoutes(fastify: FastifyInstance) {
  const analyticsService = new AnalyticsService()

  // ══════════════════════════════════════════════════════
  // DASHBOARD KPIs
  // ═══════════════════════════════════════════════════════════

  fastify.get('/api/analytics/dashboard', {
    preHandler: [authenticate],
    schema: {
      response: {
        200: toJsonSchema(DashboardKPIsSchema),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    console.log('========================================')
    console.log('🔍🔍🔍 /api/analytics/dashboard CALLED 🔍🔍🔍')
    console.log('========================================')
    console.log('📌 userId:', request.userId)
    console.log('========================================')

    try {
      const kpis = await analyticsService.getDashboardKpis(request.userId)
      console.log('✅ /api/analytics/dashboard SUCCESS!')
      console.log('📊 KPIs keys:', Object.keys(kpis || {}))
      console.log('========================================')
      return reply.send(kpis)
    } catch (err) {
      console.error('❌ /api/analytics/dashboard ERROR:', err)
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch dashboard KPIs' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // SALES ANALYTICS — Production Ready with Schema ✅
  // ═══════════════════════════════════════════════════════════

  fastify.get('/api/analytics/sales', {
    preHandler: [authenticate],
    schema: {
      querystring: toJsonSchema(DateRangeSchema),
      response: {
        200: toJsonSchema(SalesSummarySchema),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    console.log('========================================')
    console.log('🔍🔍🔍 /api/analytics/sales CALLED 🔍🔍🔍')
    console.log('========================================')
    console.log('📌 userId:', request.userId)
    console.log('📌 userId type:', typeof request.userId)
    console.log('📌 userId length:', request.userId?.length)
    console.log('📌 query params:', request.query)
    console.log('========================================')

    try {
      const query = request.query as {
        days?: number
        startDate?: string
        endDate?: string
      }

      console.log('📌 Parsed query:', query)

      const today = new Date()
      console.log('📌 today:', today.toISOString())

      const startDate = query.startDate || new Date(today.getTime() - (query.days || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const endDate = query.endDate || today.toISOString().split('T')[0]

      console.log('📌 calculated startDate:', startDate)
      console.log('📌 calculated endDate:', endDate)

      const dateRange: { startDate: string; endDate: string } = {
        startDate: startDate as string,
        endDate: endDate as string,
      }

      console.log('📌 dateRange:', dateRange)
      console.log('📌 Calling analyticsService.getSalesSummary...')
      console.log('========================================')

      const summary = await analyticsService.getSalesSummary(request.userId, dateRange)

      console.log('========================================')
      console.log('✅ /api/analytics/sales getSalesSummary RETURNED!')
      console.log('📌 summary type:', typeof summary)
      console.log('📌 summary is null?', summary === null)
      console.log('📌 summary is undefined?', summary === undefined)
      console.log('📌 summary keys:', Object.keys(summary || {}))
      console.log('📌 summary totalRevenue:', summary?.totalRevenue)
      console.log('📌 summary totalInvoices:', summary?.totalInvoices)
      console.log('📌 summary chartData length:', summary?.chartData?.length)

      // ✅ Full JSON log
      try {
        const summaryString = JSON.stringify(summary)
        console.log('📌 summary (full JSON):', summaryString.substring(0, 800) + (summaryString.length > 800 ? '...' : ''))
        console.log('📌 summary JSON length:', summaryString.length)
      } catch (stringifyError) {
        console.error('❌ Failed to stringify summary:', stringifyError)
      }

      console.log('========================================')

      if (!summary || Object.keys(summary).length === 0) {
        console.log('⚠️⚠️⚠️ summary is EMPTY! Returning fallback...')
        return reply.send({
          message: 'No data found for the selected period',
          data: summary,
        })
      }

      // ✅ Production: Return with schema validation
      console.log('✅ Sending summary with SalesSummarySchema validation...')

      // ✅ Validate with Zod before sending
      const validatedSummary = SalesSummarySchema.parse(summary)

      console.log('📌 validatedSummary keys:', Object.keys(validatedSummary))
      console.log('📌 validatedSummary totalRevenue:', validatedSummary.totalRevenue)
      console.log('📌 validatedSummary chartData length:', validatedSummary.chartData?.length)
      console.log('========================================')

      return reply.send(validatedSummary)

    } catch (err) {
      console.error('========================================')
      console.error('❌❌❌ /api/analytics/sales ERROR ❌❌❌')
      console.error('========================================')
      console.error('Error type:', typeof err)
      console.error('Error message:', err instanceof Error ? err.message : String(err))
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack')
      console.error('========================================')

      if (err instanceof z.ZodError) {
        console.error('❌ ZodError details:', JSON.stringify(err.errors, null, 2))
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch sales analytics' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // INVENTORY ANALYTICS
  // ═══════════════════════════════════════════════════════════

  fastify.get('/api/analytics/inventory', {
    preHandler: [authenticate],
    schema: {
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    console.log('========================================')
    console.log('🔍🔍🔍 /api/analytics/inventory CALLED 🔍🔍🔍')
    console.log('========================================')
    console.log('📌 userId:', request.userId)
    console.log('========================================')

    try {
      const summary = await analyticsService.getInventorySummary(request.userId)
      console.log('✅ /api/analytics/inventory SUCCESS!')
      console.log('📊 summary keys:', Object.keys(summary || {}))
      console.log('========================================')
      return reply.send(summary)
    } catch (err) {
      console.error('❌ /api/analytics/inventory ERROR:', err)
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch inventory analytics' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // FINANCIAL ANALYTICS
  // ═══════════════════════════════════════════════════════════

  fastify.get('/api/analytics/financial', {
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
    console.log('========================================')
    console.log('🔍🔍🔍 /api/analytics/financial CALLED 🔍🔍🔍')
    console.log('========================================')
    console.log('📌 userId:', request.userId)
    console.log('📌 query:', request.query)
    console.log('========================================')

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

      console.log('📌 dateRange:', dateRange)

      const summary = await analyticsService.getFinancialSummary(request.userId, dateRange)

      console.log('✅ /api/analytics/financial SUCCESS!')
      console.log('📊 summary keys:', Object.keys(summary || {}))
      console.log('========================================')
      return reply.send(summary)
    } catch (err) {
      console.error('❌ /api/analytics/financial ERROR:', err)
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch financial analytics' })
    }
  })
}