// ============================================
// backend/src/routes/api/analytics.routes.ts
// FIXED: Reduced cache TTL for real-time updates
// ============================================

import { resolveTimeZone } from '../utils/local-day'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { AnalyticsService } from '../services/analytics.service'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { cacheMiddleware } from '../middleware/cache.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { holds } from '../services/authorization'
import {
  DASHBOARD_FIGURE_GROUPS,
  hiddenDashboardGroups,
  maskDashboardKpis,
} from '../services/analytics/dashboard-visibility.domain'

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
    }),
  ),
  topProducts: z.array(z.any()),
  topCustomers: z.array(z.any()),
  chartData: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
      date: z.string(),
      // ✅ FIX: سرویس این دو فیلد را محاسبه می‌کرد، ولی چون در schema نبودند
      // Zod (که کلیدهای ناشناخته را strip می‌کند) آن‌ها را از پاسخ حذف می‌کرد.
      // نتیجه: خط «فاکتورها» و «مشتریان» در نمودار هیچ داده‌ای نداشت و تیک
      // زدنشان هیچ خطی اضافه نمی‌کرد. optional است چون مسیر fallback
      // (chartData: []) این فیلدها را ندارد.
      invoiceCount: z.number().optional(),
      customerCount: z.number().optional(),
    }),
  ),
})

const DashboardKPIsSchema = z.object({
  todaySales: z.number(),
  todayInvoices: z.number(),
  monthlyRevenue: z.number(),
  monthlyGrowth: z.number(),
  pendingPayments: z.number(),
  pendingPaymentsCount: z.number(),
  activeCustomers: z.number(),
  customerGrowth: z.number(),
  lowStockAlerts: z.number(),
  // ✅ FIX: این سه فیلد را سرویس محاسبه می‌کرد، اما چون در schema نبودند هم
  // Zod (.parse) و هم response serialization فست‌فای آن‌ها را حذف می‌کردند —
  // به همین دلیل چهار کارت اول داشبورد همیشه صفر نشان داده می‌شد.
  // default(0) برای زمانی است که کش ۶۰ ثانیه‌ای هنوز آبجکت قدیمی را دارد.
  totalSales: z.number().default(0),
  customerDebt: z.number().default(0),
  warehouseValue: z.number().default(0),

  // The KPIs above sum invoice totals without regard to the currency each
  // invoice is denominated in. That is right for a single-currency workspace
  // and wrong for a mixed one, where 100 USD + 100 AFN was reported as 200.
  // These three carry the honest decomposition. Nothing is converted — the
  // repo has no working exchange-rate source. `.default()` on each so a
  // response still parses while the 60s KPI cache holds a pre-change object.
  byCurrency: z
    .record(
      z.object({
        totalSales: z.number(),
        totalPurchases: z.number(),
        customerDebt: z.number(),
        supplierPayable: z.number(),
        todaySales: z.number(),
        monthlyRevenue: z.number(),
        pendingPayments: z.number(),
      }),
    )
    .default({}),
  currencies: z.array(z.string()).default([]),
  mixedCurrency: z.boolean().default(false),
  // Figure groups this person may not be told (dashboard-visibility.domain):
  // their fields are zero AND named here, so the client leaves the card out.
  hidden: z.array(z.enum(DASHBOARD_FIGURE_GROUPS)).default([]),
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

  // ✅ FIX: کاهش TTL از 300 به 30 ثانیه
  fastify.get(
    '/api/analytics/dashboard',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        // Per MEMBER, not per workspace: the answer now depends on what the
        // person may see, and a shared entry would hand one member's figures
        // to the next.
        cacheMiddleware({ scope: 'member', ttl: 30, keyPrefix: 'dashboard' }),
      ],
      schema: {
        response: {
          200: toJsonSchema(DashboardKPIsSchema),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // The device's zone decides where «today» starts; validated, with an
        // explicit default (utils/local-day.ts).
        const timeZone = resolveTimeZone((request.query as { tz?: unknown } | undefined)?.tz)
        const kpis = await analyticsService.getDashboardKpis(request.tenancy, timeZone)
        // Computed once for the business (the service caches it); what THIS
        // person may be told is decided here, after it.
        const validated = DashboardKPIsSchema.parse(
          maskDashboardKpis(
            kpis as Record<string, unknown>,
            hiddenDashboardGroups((capability) => holds(request.tenancy, capability)),
          ),
        )
        return reply.send(validated)
      } catch (err) {
        if (err instanceof z.ZodError) {
          fastify.log.error({ err: err.errors }, 'Dashboard validation failed')
          return reply.code(500).send({ error: 'Data validation failed' })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch dashboard KPIs' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════════
  // SALES ANALYTICS
  // ═══════════════════════════════════════════════════════════

  // ✅ FIX: کاهش TTL از 120 به 30 ثانیه
  fastify.get(
    '/api/analytics/sales',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        // The sales series IS the invoices, summed by day.
        requireCapability('invoice.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 30, keyPrefix: 'sales' }),
      ],
      schema: {
        querystring: toJsonSchema(DateRangeSchema),
        response: {
          200: toJsonSchema(SalesSummarySchema),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as {
          days?: number
          startDate?: string
          endDate?: string
        }

        const today = new Date()
        const startDate =
          query.startDate ||
          new Date(today.getTime() - (query.days || 30) * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0]
        const endDate = query.endDate || today.toISOString().split('T')[0]

        const dateRange: { startDate: string; endDate: string } = {
          startDate: startDate as string,
          endDate: endDate as string,
        }

        const summary = await analyticsService.getSalesSummary(request.tenancy, dateRange)
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
    },
  )

  // ═══════════════════════════════════════════════════════════
  // INVENTORY ANALYTICS
  // ═══════════════════════════════════════════════════════════

  fastify.get(
    '/api/analytics/inventory',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'inventory' }),
      ],
      schema: {
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const summary = await analyticsService.getInventorySummary(request.tenancy)
        return reply.send(summary)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch inventory analytics' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════════
  // FINANCIAL ANALYTICS
  // ═══════════════════════════════════════════════════════════

  fastify.get(
    '/api/analytics/financial',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'financial' }),
      ],
      schema: {
        querystring: toJsonSchema(
          z.object({
            startDate: z.string().optional(),
            endDate: z.string().optional(),
          }),
        ),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as {
          startDate?: string
          endDate?: string
        }

        const today = new Date()
        const startDate =
          query.startDate ||
          new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const endDate = query.endDate || today.toISOString().split('T')[0]

        const dateRange: { startDate: string; endDate: string } = {
          startDate: startDate as string,
          endDate: endDate as string,
        }

        const summary = await analyticsService.getFinancialSummary(request.tenancy, dateRange)
        return reply.send(summary)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch financial analytics' })
      }
    },
  )
}
