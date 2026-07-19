// ============================================
// backend/src/index.ts — Hisabche API Server v2.0
// Complete: 23 Phases + v1.1 + Performance Middleware + Health Checks + Security
// ============================================

import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import compress from '@fastify/compress'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import dotenv from 'dotenv'

// ──────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────
import { authenticate } from './middleware/auth.middleware'
import { supabase } from './db'

// ──────────────────────────────────────────────
// Routes — Phase 1-9 (Core)
// ──────────────────────────────────────────────
import { authRoutes } from './routes/auth.routes'
import { syncRoutes } from './routes/sync.routes'
import { invoiceRoutes } from './routes/invoice.routes'
import { invoicePdfRoutes } from './routes/invoice-pdf.routes'
import { productRoutes } from './routes/product.routes'
import { customerRoutes } from './routes/customer.routes'
import { transactionRoutes } from './routes/transaction.routes'
import { warehouseRoutes } from './routes/warehouse.routes'

// ──────────────────────────────────────────────
// Routes — Phase 15: HR
// ──────────────────────────────────────────────
import { humanResourcesRoutes } from './routes/human-resources.routes'

// ──────────────────────────────────────────────
// Routes — Phase 16: Projects
// ──────────────────────────────────────────────
import { projectRoutes } from './routes/project.routes'

// ──────────────────────────────────────────────
// Routes — Phase 17: Workspace
// ──────────────────────────────────────────────
import { workspaceRoutes } from './routes/workspace.routes'

// ──────────────────────────────────────────────
// Routes — Phase 18: Permissions
// ──────────────────────────────────────────────
import { permissionRoutes } from './routes/permission.routes'

// ──────────────────────────────────────────────
// Routes — Phase 19: Audit
// ──────────────────────────────────────────────
import auditRoutes from './routes/audit.routes'

// ──────────────────────────────────────────────
// Routes — Phase 20: Event System
// ──────────────────────────────────────────────
import { eventRoutes } from './routes/event.routes'

// ──────────────────────────────────────────────
// Routes — Phase 21: Analytics
// ──────────────────────────────────────────────
import analyticsRoutes from './routes/analytics.routes'

// ──────────────────────────────────────────────
// Routes — Phase 22: AI Assistant
// ──────────────────────────────────────────────
import { aiRoutes } from './routes/ai.routes'

// ──────────────────────────────────────────────
// Routes — Phase 23: Accounting
// ──────────────────────────────────────────────
import { accountingRoutes } from './routes/accounting.routes'

// ──────────────────────────────────────────────
// Routes — Phase 24: CRM
// ──────────────────────────────────────────────
import { crmRoutes } from './routes/crm.routes'

// ──────────────────────────────────────────────
// Routes — Phase 25: Manufacturing
// ──────────────────────────────────────────────
import { manufacturingRoutes } from './routes/manufacturing.routes'

// ──────────────────────────────────────────────
// Routes — Phase 26: Purchasing
// ──────────────────────────────────────────────
import { purchasingRoutes } from './routes/purchasing.routes'

// ──────────────────────────────────────────────
// Routes — Phase 27: Billing & Subscription
// ──────────────────────────────────────────────
import { billingRoutes } from './routes/billing.routes'

// ──────────────────────────────────────────────
// Routes — v1.1: Workflow & Notification Center
// ──────────────────────────────────────────────
import { workflowRoutes } from './routes/workflow.routes'
import { notificationRoutes } from './routes/notification.routes'

// ──────────────────────────────────────────────
// Plugins — v1.1: Job Scheduler
// ──────────────────────────────────────────────
import { jobSchedulerPlugin } from './plugins/job-scheduler.plugin'

// ──────────────────────────────────────────────
// Scheduler — Trial Expiration Worker
// ──────────────────────────────────────────────
import { startScheduler } from './scheduler'

// ──────────────────────────────────────────────
// Environment
// ──────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}

const PORT = Number(process.env.PORT || 3001)
const HOST = '0.0.0.0'
const isProduction = process.env.NODE_ENV === 'production'

// ──────────────────────────────────────────────
// Server Instance
// ──────────────────────────────────────────────
const server = Fastify({
  logger: {
    level: isProduction ? 'info' : 'debug',
    ...(isProduction
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }),
  },
})

// ──────────────────────────────────────────────
// Start
// ──────────────────────────────────────────────
async function start(): Promise<void> {
  try {
    // ═══════════════════════════════════════════
    // ✅ Compression — Gzip/Brotli (NEW v2.0)
    // ═══════════════════════════════════════════
    await server.register(compress, {
      global: true,
      threshold: 1024,
    })

    // ─── Rate Limit ──────────────────────────
    await server.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
      keyGenerator: (request) => {
        return (request as any).userId || request.ip
      },
      errorResponseBuilder: (_request: any, context: any) => ({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil(context.after / 1000),
        limit: context.max,
        remaining: context.remaining,
      }),
    })

    // ─── SLO endpoint ────────────────────────
    server.get('/api/slo', async () => ({
      service: 'Hisabche API',
      version: '2.0.0',
      slo: {
        availability: '99.9%',
        p95Latency: '< 300ms',
        p99Latency: '< 800ms',
        errorRate: '< 0.1%',
      },
      timestamp: new Date().toISOString(),
    }))

    // ─── CORS ────────────────────────────────
    await server.register(cors, {
      origin: isProduction
        ? [
            process.env.FRONTEND_URL || 'https://project-ro4vn-hisabche-s-projects.vercel.app',
          ]
        : [
            'https://project-ro4vn-hisabche-s-projects.vercel.app',
            'https://project-ro4vn.vercel.app',
            'http://localhost:3000',
            'https://hisabche.com',
            'https://www.hisabche.com',
          ],
      credentials: true,
    })

    // ═══════════════════════════════════════════
    // ✅ Performance Monitoring Middleware v2.0
    // ═══════════════════════════════════════════
    server.addHook('onRequest', async (request) => {
      ;(request as any).startTime = Date.now()
    })

    server.addHook('onSend', async (request, reply, payload) => {
      const duration = Date.now() - ((request as any).startTime || Date.now())
      
      reply.header('X-Response-Time-MS', duration.toString())
      
      // ═══════════════════════════════════════════
      // ✅ Security Headers
      // ═══════════════════════════════════════════
      reply.header('X-Frame-Options', 'DENY')
      reply.header('X-Content-Type-Options', 'nosniff')
      reply.header('X-XSS-Protection', '1; mode=block')
      reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
      
      if (duration > 500) {
        request.log.warn(`⚠️ SLOW: ${request.method} ${request.url} - ${duration}ms`)
      }
      
      return payload
    })

    // ═══════════════════════════════════════════
    // Swagger Documentation
    // ═══════════════════════════════════════════
    await server.register(swagger, {
      openapi: {
        info: {
          title: 'Hisabche API',
          description: 'Complete ERP & Accounting API — 23 phases + v1.1',
          version: '2.0.0',
          contact: {
            name: 'Hisabche Team',
            email: 'support@hisabche.com',
          },
        },
        servers: [
          {
            url: isProduction
              ? 'https://api.hisabche.com/api'
              : 'http://localhost:3001',
            description: isProduction ? 'Production Server' : 'Development Server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
          schemas: {
            Error: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' },
                statusCode: { type: 'number' },
              },
            },
          },
        },
        security: [{ bearerAuth: [] }],
        tags: [
          { name: 'Auth', description: 'Authentication endpoints' },
          { name: 'Invoices', description: 'Invoice management' },
          { name: 'Products', description: 'Product management' },
          { name: 'Customers', description: 'Customer management' },
          { name: 'Transactions', description: 'Transaction management' },
          { name: 'warehouse', description: 'Warehouse management' },
          { name: 'Accounting', description: 'Accounting & financial reports' },
          { name: 'HR', description: 'Human resources management' },
          { name: 'Projects', description: 'Project management' },
          { name: 'Workspace', description: 'Workspace & members' },
          { name: 'Permissions', description: 'Roles & permissions' },
          { name: 'Audit', description: 'Audit logs' },
          { name: 'Analytics', description: 'Analytics & dashboards' },
          { name: 'AI', description: 'AI assistant' },
          { name: 'CRM', description: 'Customer relationship management' },
          { name: 'Manufacturing', description: 'BOM & work orders' },
          { name: 'Purchasing', description: 'Purchase orders' },
          { name: 'Sync', description: 'Offline sync' },
          { name: 'Notification', description: 'Notifications' },
          { name: 'Workflow', description: 'Approval workflows' },
          { name: 'Billing', description: 'Billing & Subscription' },
        ],
      },
    })

    // ─── Swagger UI ──────────────────────────
    await server.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
        persistAuthorization: true,
      },
      staticCSP: true,
    })

    // ═══════════════════════════════════════════
    // ✅ Health Checks v2.0
    // ═══════════════════════════════════════════

    // Liveness probe — server is running
    server.get('/live', async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }))

    // Readiness probe — server + database ready
    server.get('/ready', async () => {
      try {
        const { error } = await supabase.from('products').select('id').limit(1)
        return {
          status: error ? 'error' : 'ok',
          database: error ? 'disconnected' : 'connected',
          timestamp: new Date().toISOString(),
        }
      } catch {
        return {
          status: 'error',
          database: 'disconnected',
          timestamp: new Date().toISOString(),
        }
      }
    })

    // Deep health check (public)
    server.get('/api/health', async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      env: process.env.NODE_ENV,
      version: '2.0.0',
      compression: true,
      security: true,
    }))

    // API info (public)
    server.get('/api', async () => ({
      name: 'Hisabche API',
      version: '2.0.0',
      phases: 23,
      status: 'complete',
      docs: '/docs',
      health: '/api/health',
      live: '/live',
      ready: '/ready',
    }))

    // ─── Auth Middleware ─────────────────────
    server.addHook('preHandler', async (request, reply) => {
      const url = request.url
      if (url.startsWith('/docs')) return
      if (url === '/live') return
      if (url === '/ready') return
      if (url.startsWith('/api/health')) return
      if (url === '/api') return
      if (url.startsWith('/api/auth/login')) return
      if (url.startsWith('/api/auth/signup')) return
      if (url.startsWith('/api/auth/forgot-password')) return
      if (url.startsWith('/api/auth/reset-password')) return
      if (request.method === 'OPTIONS') return
      await authenticate(request, reply)
    })

    // ═══════════════════════════════════════════
    // REGISTER ALL ROUTES — 23 Phases + v1.1 + Billing
    // ═══════════════════════════════════════════

    await server.register(authRoutes)
    await server.register(syncRoutes)
    await server.register(invoiceRoutes)
    await server.register(invoicePdfRoutes)
    await server.register(productRoutes)
    await server.register(customerRoutes)
    await server.register(transactionRoutes)
    await server.register(warehouseRoutes)
    await server.register(humanResourcesRoutes)
    await server.register(projectRoutes)
    await server.register(workspaceRoutes)
    await server.register(permissionRoutes)
    await server.register(auditRoutes)
    await server.register(eventRoutes)
    await server.register(analyticsRoutes)
    await server.register(aiRoutes)
    await server.register(accountingRoutes)
    await server.register(crmRoutes)
    await server.register(manufacturingRoutes)
    await server.register(purchasingRoutes)
    await server.register(workflowRoutes)
    await server.register(notificationRoutes)
    await server.register(jobSchedulerPlugin)
    await server.register(billingRoutes)

    // ─── 404 Handler ────────────────────────
    server.setNotFoundHandler((_req, reply) => {
      reply.status(404).send({
        error: 'Not Found',
        message: 'Route does not exist',
        statusCode: 404,
      })
    })

    // ─── Error Handler ──────────────────────
    server.setErrorHandler((error, _req, reply) => {
      const err = error as any
      server.log.error(err)
      reply.status(err.statusCode || 500).send({
        error: err.name || 'Internal Server Error',
        message: err.message || 'Unexpected error',
        statusCode: err.statusCode || 500,
      })
    })

    // ─── Start Server ───────────────────────
    await server.listen({ port: PORT, host: HOST })
    server.log.info(`🚀 Server running on ${HOST}:${PORT} — v2.0 Performance Optimized`)
    server.log.info(`📚 Swagger UI available at /docs`)
    server.log.info(`💚 Health: /live | /ready | /api/health`)

    // ─── Start Scheduler ─────────────────────
    // ✅ بعد از start server اجرا می‌شود
    startScheduler()

  } catch (err) {
    const error = err as Error
    server.log.error(error)
    process.exit(1)
  }
}

// ──────────────────────────────────────────────
// Graceful Shutdown
// ──────────────────────────────────────────────
async function shutdown(signal: string) {
  try {
    server.log.info(`Received ${signal}, shutting down...`)
    await server.close()
    process.exit(0)
  } catch (err) {
    const error = err as Error
    server.log.error(error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// ─── Start the server ────────────────────────
start()