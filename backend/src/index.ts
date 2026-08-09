// ============================================
// backend/src/index.ts — Hisabche API Server v2.5
// FIXED: workspaceRoutes import — use default import
// FIXED: notificationRoutes — properly registered
// FIXED: debugRoutes — properly registered
// FIXED (v2.5): Removed global HTTP-level cache layer.
// FIXED (v2.6): accountingRoutes registered with prefix '/api/accounting'
//   to match what the frontend hooks actually request. Previously
//   accounting routes were defined as /api/accounts, /api/journal etc.
//   but the frontend requests /accounting/accounts, /accounting/journal
//   etc. (with baseURL /api). This prefix solves the mismatch without
//   touching any other route's registration pattern.
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
// Routes
// ──────────────────────────────────────────────
import { authRoutes } from './routes/auth.routes'
import { syncRoutes } from './routes/sync.routes'
import { invoiceRoutes } from './routes/invoice.routes'
import { invoicePdfRoutes } from './routes/invoice-pdf.routes'
import { invoicePublicRoutes } from './routes/invoice-public.routes'
import { productRoutes } from './routes/product.routes'
import { customerRoutes } from './routes/customer.routes'
import { transactionRoutes } from './routes/transaction.routes'
import { warehouseRoutes } from './routes/warehouse.routes'
import { humanResourcesRoutes } from './routes/human-resources.routes'
import { projectRoutes } from './routes/project.routes'
import { workspaceRoutes } from './routes/workspace.routes'
import { permissionRoutes } from './routes/permission.routes'
import auditRoutes from './routes/audit.routes'
import { eventRoutes } from './routes/event.routes'
import analyticsRoutes from './routes/analytics.routes'
import { aiRoutes } from './routes/ai.routes'
import { accountingRoutes } from './routes/accounting.routes'
import { crmRoutes } from './routes/crm.routes'
import { manufacturingRoutes } from './routes/manufacturing.routes'
import { purchasingRoutes } from './routes/purchasing.routes'
import { billingRoutes } from './routes/billing.routes'
import { workflowRoutes } from './routes/workflow.routes'
import { notificationRoutes } from './routes/notification.routes'
import { debugRoutes } from './routes/debug.routes'
// ✅ اضافه کردن Activity Routes
import { activityRoutes } from './routes/activity.routes'

// ──────────────────────────────────────────────
// Plugins & Scheduler
// ──────────────────────────────────────────────
import { jobSchedulerPlugin } from './plugins/job-scheduler.plugin'
import { startScheduler } from './scheduler'
import { getMetrics, enterMetricsContext } from './utils/request-metrics'

// ──────────────────────────────────────────────
// Environment
// ──────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}

const PORT = Number(process.env.PORT || 10000)
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
  connectionTimeout: 30000,
  // Logos and stamps are sent inline as base64 data URIs, which inflate the
  // payload by ~33%. Fastify's 1 MB default meant any photo over ~750 KB — an
  // ordinary phone camera shot — was rejected with a bare 413 before it ever
  // reached validation. 8 MB covers a full-resolution image with headroom.
  bodyLimit: 8 * 1024 * 1024,
})

// ──────────────────────────────────────────────
// STARTUP LOGGING
// ──────────────────────────────────────────────
server.log.info(`🚀 Starting Hisabche API v2.5...`)
server.log.info(`📦 Environment: ${process.env.NODE_ENV || 'development'}`)

// ──────────────────────────────────────────────
// 1. PERFORMANCE MONITORING MIDDLEWARE
// ──────────────────────────────────────────────
server.addHook('onRequest', async (request) => {
  ;(request as any).startTime = Date.now()
  // context شمارنده‌ی کوئری را برای این درخواست فعال می‌کند.
  enterMetricsContext()
})

server.addHook('onResponse', async (request, reply) => {
  // فاز ۰ — یک خط ساختاریافته به‌ازای هر درخواست، تا بتوان جدول
  // «Endpoint / تعداد Query / زمان DB / زمان کل» را مستقیماً از لاگ Render
  // ساخت. OPTIONS ها حذف می‌شوند چون نویز محض‌اند.
  if (request.method === 'OPTIONS') return

  const total = Date.now() - ((request as any).startTime || Date.now())
  const m = getMetrics()

  request.log.info(
    {
      perf: true,
      method: request.method,
      route: (request as any).routeOptions?.url ?? request.url.split('?')[0],
      status: reply.statusCode,
      totalMs: total,
      dbMs: m?.dbTimeMs ?? null,
      queries: m?.queryCount ?? null,
      // زمانی که در دیتابیس نگذشته: middleware، سریال‌سازی، شبکه‌ی داخلی
      overheadMs: m ? total - m.dbTimeMs : null,
      cacheHits: m?.cacheHits ?? null,
      cacheMisses: m?.cacheMisses ?? null,
      userId: (request as any).userId ?? null,
      workspaceId: (request as any).workspaceId ?? null,
    },
    '📊 perf',
  )
})

server.addHook('onSend', async (request, reply, payload) => {
  const duration = Date.now() - ((request as any).startTime || Date.now())

  reply.header('X-Response-Time-MS', duration.toString())
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('X-Frame-Options', 'DENY')
  reply.header('X-XSS-Protection', '1; mode=block')

  if (duration > 500) {
    request.log.warn(`⚠️ SLOW: ${request.method} ${request.url} - ${duration}ms`)
  }

  return payload
})

// ──────────────────────────────────────────────
// 2. AUTH MIDDLEWARE
// ──────────────────────────────────────────────
server.addHook('preHandler', async (request, reply) => {
  const url = request.url

  const publicPaths = [
    '/docs',
    '/live',
    '/ready',
    '/api',
    '/api/health',
    '/api/slo',
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
  ]

  if (publicPaths.some((p) => url.startsWith(p))) return
  if (request.method === 'OPTIONS') return

  await authenticate(request, reply)
})

// ──────────────────────────────────────────────
// 3. HEALTH CHECKS
// ──────────────────────────────────────────────
server.get('/api/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  env: process.env.NODE_ENV,
  version: '2.5.0',
  cache: process.env.REDIS_URL ? 'redis' : 'memory',
}))

server.get('/live', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}))

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

server.get('/api', async () => ({
  name: 'Hisabche API',
  version: '2.5.0',
  status: 'complete',
  docs: '/docs',
  health: '/api/health',
  live: '/live',
  ready: '/ready',
}))

server.get('/api/slo', async () => ({
  service: 'Hisabche API',
  version: '2.5.0',
  slo: {
    availability: '99.9%',
    p95Latency: '< 200ms',
    p99Latency: '< 500ms',
    errorRate: '< 0.1%',
  },
  timestamp: new Date().toISOString(),
}))

// ──────────────────────────────────────────────
// 4. 404 HANDLER
// ──────────────────────────────────────────────
server.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    statusCode: 404,
    error: 'Not Found',
    message: `Route ${request.method} ${request.url} not found`,
    path: request.url,
    method: request.method,
  })
})

// ──────────────────────────────────────────────
// 5. ERROR HANDLER
// ──────────────────────────────────────────────
server.setErrorHandler((error, request, reply) => {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  request.log.error({
    message: errorMessage,
    stack: errorStack,
    url: request.url,
    method: request.method,
  })

  const err = error as any
  const status = err.statusCode || 500
  const message = err.message || 'Internal Server Error'

  reply.status(status).send({
    statusCode: status,
    error: err.name || 'Error',
    message,
    path: request.url,
    method: request.method,
  })
})

// ──────────────────────────────────────────────
// 6. START SERVER
// ──────────────────────────────────────────────
async function start() {
  try {
    // ─── 6.1 COMPRESSION ──────────────────────
    await server.register(compress, {
      global: true,
      threshold: 1024,
      encodings: ['gzip', 'deflate'],
    })

    // ─── 6.2 CORS ─────────────────────────────
    await server.register(cors, {
      origin: isProduction
        ? [
            'https://hisabche.com',
            'https://www.hisabche.com',
            'https://app.hisabche.com',
            process.env.FRONTEND_URL || 'https://project-ro4vn-hisabche-s-projects.vercel.app',
          ].filter(Boolean)
        : [
            'https://project-ro4vn-hisabche-s-projects.vercel.app',
            'https://project-ro4vn.vercel.app',
            'http://localhost:3000',
            'http://localhost:3001',
            'https://hisabche.com',
            'https://www.hisabche.com',
          ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-client-id', 'Accept'],
      // ✅ FIX (کندی): بدون maxAge مرورگر برای هر درخواست یک OPTIONS جداگانه
      // می‌فرستد (در لاگ‌ها به‌وضوح دیده می‌شود). خود OPTIONS سریع است، اما
      // یک رفت‌وبرگشت شبکه‌ی کامل تا سرور اضافه می‌کند. با کش ۲۴ ساعته‌ی
      // preflight، این رفت‌وبرگشت از مسیر تمام درخواست‌های بعدی حذف می‌شود.
      maxAge: 86400,
    })

    // ─── 6.3 SWAGGER ──────────────────────────
    await server.register(swagger, {
      openapi: {
        info: {
          title: 'Hisabche API',
          description: 'Business Operating System API v2.5',
          version: '2.5.0',
          contact: {
            name: 'Hisabche Team',
            email: 'support@hisabche.com',
          },
        },
        servers: [
          {
            url: isProduction ? 'https://api.hisabche.com' : 'http://localhost:10000',
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
        },
        security: [{ bearerAuth: [] }],
      },
    })

    await server.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
        persistAuthorization: true,
      },
      staticCSP: true,
    })

    // ─── 6.4 RATE LIMIT ────────────────────────
    await server.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
      keyGenerator: (request) => {
        const userId = (request as any).userId
        return userId || request.ip || 'anonymous'
      },
      errorResponseBuilder: (_request, context) => {
        const afterMs =
          typeof context.after === 'number'
            ? context.after
            : parseInt(String(context.after), 10) || 60000
        return {
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil(afterMs / 1000),
          limit: context.max,
        }
      },
    })

    // ─── 6.5 REGISTER ROUTES ──────────────────
    server.log.info('📦 Registering routes...')

    await server.register(authRoutes)
    await server.register(syncRoutes)
    await server.register(invoiceRoutes)
    await server.register(invoicePdfRoutes)
    await server.register(invoicePublicRoutes)
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
    // ✅ FIXED (v2.6): accountingRoutes با prefix ثبت می‌شود
    await server.register(accountingRoutes, { prefix: '/api/accounting' })
    await server.register(crmRoutes)
    await server.register(manufacturingRoutes)
    await server.register(purchasingRoutes)
    await server.register(workflowRoutes)

    // ✅ ثبت Route‌های دیباگ (فقط برای دیباگ)
    await server.register(debugRoutes)

    // ✅ ثبت Route‌های Notification
    await server.register(notificationRoutes)

    // ✅ ثبت Route‌های Activity
    await server.register(activityRoutes)

    await server.register(jobSchedulerPlugin)
    await server.register(billingRoutes)

    server.log.info('✅ All routes registered successfully')

    // ─── 6.6 START LISTENING ──────────────────
    await server.listen({ port: PORT, host: HOST })

    console.log(`\n🚀 Server running on ${HOST}:${PORT} — v2.5`)
    console.log(`📚 Swagger UI: /docs`)
    console.log(`💚 Health: /api/health | /live | /ready`)
    console.log(
      `🔍 Cache: per-route only (cacheMiddleware), global HTTP cache layer removed in v2.5`,
    )
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}\n`)

    // ─── 6.7 START SCHEDULER ──────────────────
    startScheduler()
  } catch (err) {
    const error = err as Error
    server.log.error(error)
    process.exit(1)
  }
}

// ──────────────────────────────────────────────
// 7. GRACEFUL SHUTDOWN
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

// ─── Start ────────────────────────────────────
start()

export default server
