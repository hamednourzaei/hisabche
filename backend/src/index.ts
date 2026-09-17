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

// MUST be first: `./db` reads SUPABASE_URL at import time, and imports are
// evaluated before any statement in this module's body. The `dotenv.config()`
// call further down therefore ran *after* db.ts had already thrown, so the
// server could never start from a local .env file — only from real environment
// variables, as on Render. Importing for side effects here loads .env before
// any other module is evaluated.
import 'dotenv/config'

import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import compress from '@fastify/compress'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

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
import { updatesRoutes } from './routes/updates.routes'
import { productRoutes } from './routes/product.routes'
import { customerRoutes } from './routes/customer.routes'
import { customerProfileRoutes } from './routes/customer-profile.routes'
import { transactionRoutes } from './routes/transaction.routes'
import { warehouseRoutes } from './routes/warehouse.routes'
import { cycleCountRoutes } from './routes/cycle-count.routes'
import { unitsRoutes } from './routes/units.routes'
import { aiChatRoutes } from './routes/ai-chat.routes'
import { productUnitsRoutes } from './routes/product-units.routes'
import { currenciesRoutes } from './routes/currencies.routes'
import { inventoryInsightsRoutes } from './routes/inventory-insights.routes'
import { intelligenceForecastRoutes } from './routes/intelligence-forecast.routes'
import { humanResourcesRoutes } from './routes/human-resources.routes'
import { projectRoutes } from './routes/project.routes'
import { workspaceRoutes } from './routes/workspace.routes'
import { permissionRoutes } from './routes/permission.routes'
import auditRoutes from './routes/audit.routes'
import { eventRoutes } from './routes/event.routes'
import analyticsRoutes from './routes/analytics.routes'
import { aiRoutes } from './routes/ai.routes'
import { accountingRoutes } from './routes/accounting.routes'
import { inventoryCostingRoutes } from './routes/inventory-costing.routes'
import { paymentsRoutes } from './routes/payments.routes'
import { conflictRoutes } from './routes/conflict.routes'
import { governanceRoutes } from './routes/governance.routes'
import { branchRoutes } from './routes/branch.routes'
import { supplierRoutes } from './routes/supplier.routes'
import { personalizationRoutes } from './routes/personalization.routes'
import { rulesRoutes } from './routes/rules.routes'
import { intelligenceRoutes } from './routes/intelligence.routes'
import { taxRoutes } from './routes/tax.routes'
import { posRoutes } from './routes/pos.routes'
import { financeOpsRoutes } from './routes/finance-ops.routes'
import { operationsRoutes } from './routes/operations.routes'
import { migrationRoutes } from './routes/migration.routes'
import { crmRoutes } from './routes/crm.routes'
import { manufacturingRoutes } from './routes/manufacturing.routes'
import { purchasingRoutes } from './routes/purchasing.routes'
import { billingRoutes } from './routes/billing.routes'
import { workflowRoutes } from './routes/workflow.routes'
import { notificationRoutes } from './routes/notification.routes'
import { debugRoutes } from './routes/debug.routes'
// ✅ اضافه کردن Activity Routes
import { activityRoutes } from './routes/activity.routes'
import adminRoutes from './routes/admin.routes'

// ──────────────────────────────────────────────
// Plugins & Scheduler
// ──────────────────────────────────────────────
import { jobSchedulerPlugin } from './plugins/job-scheduler.plugin'
import { startScheduler } from './scheduler'
import { getMetrics, enterMetricsContext } from './utils/request-metrics'
import { slowestCalls, waitingMs } from './utils/supabase-fetch-metrics'

// ──────────────────────────────────────────────
// Environment
// ──────────────────────────────────────────────
// .env is loaded by the `import 'dotenv/config'` at the top of this file — it
// has to happen before any other import, so it cannot live here. dotenv does
// nothing when no .env file exists, which is the case on Render.

const PORT = Number(process.env.PORT || 10000)
const HOST = '0.0.0.0'
const isProduction = process.env.NODE_ENV === 'production'

// ──────────────────────────────────────────────
// Server Instance
// ──────────────────────────────────────────────
const server = Fastify({
  logger: {
    // Tests drive the whole app through inject(); debug-level request logs
    // would bury the actual assertion output.
    level: process.env.VITEST ? 'silent' : isProduction ? 'info' : 'debug',
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
let inflightRequests = 0

server.addHook('onRequest', async (request) => {
  ;(request as any).startTime = Date.now()
  // context شمارنده‌ی کوئری را برای این درخواست فعال می‌کند.
  enterMetricsContext(inflightRequests)
  inflightRequests += 1
  ;(request as any).countedInflight = true
})

server.addHook('onResponse', async (request, reply) => {
  // فاز ۰ — یک خط ساختاریافته به‌ازای هر درخواست، تا بتوان جدول
  // «Endpoint / تعداد Query / زمان DB / زمان کل» را مستقیماً از لاگ Render
  // ساخت. OPTIONS ها حذف می‌شوند چون نویز محض‌اند.
  if ((request as any).countedInflight) {
    inflightRequests = Math.max(0, inflightRequests - 1)
    ;(request as any).countedInflight = false
  }
  if (request.method === 'OPTIONS') return

  const total = Date.now() - ((request as any).startTime || Date.now())
  const m = getMetrics()
  const db = m?.db

  request.log.info(
    {
      perf: true,
      method: request.method,
      route: (request as any).routeOptions?.url ?? request.url.split('?')[0],
      status: reply.statusCode,
      totalMs: total,
      dbMs: m?.dbTimeMs ?? null,
      queries: m?.queryCount ?? null,

      // `overheadMs` is only meaningful when the database time is measured.
      //
      // Nearly every read in this codebase goes through supabase-js, which is
      // an HTTP call to PostgREST and is NOT counted by `getMetrics()`. So a
      // request reporting `queries: 0` has not necessarily avoided the
      // database — it has avoided the INSTRUMENTED one.
      //
      // The old line subtracted zero and reported the whole 2,043 ms of
      // `GET /api/workspaces` as overhead, which reads as "the time is in
      // middleware or serialisation" and sends whoever acts on it to optimise
      // the wrong layer. Null says "not known", which is the truth.
      // Everything spent waiting on Supabase (PostgREST + RPC + GoTrue). The
      // calls of one request can run in parallel, so this may exceed totalMs.
      supabaseMs: db ? db.restMs + db.rpcMs + db.authMs + db.otherMs : null,
      restCalls: db?.restCalls ?? null,
      restMs: db?.restMs ?? null,
      rpcCalls: db?.rpcCalls ?? null,
      rpcMs: db?.rpcMs ?? null,
      authCalls: db?.authCalls ?? null,
      authMs: db?.authMs ?? null,
      newConnections: db?.newConnections ?? null,
      inflightAtStart: m?.inflightAtStart ?? null,
      slowest: m ? slowestCalls() : null,
      // Wall time with a Supabase call open (parallel calls counted once), and
      // what is left: our own code, serialisation, and waiting for a turn.
      waitingMs: db ? waitingMs() : null,
      overheadMs: db ? Math.max(0, total - waitingMs()) : null,
      dbInstrumented: Boolean(db),

      cacheHits: m?.cacheHits ?? null,
      cacheMisses: m?.cacheMisses ?? null,
      userId: (request as any).userId ?? null,

      // The resolved workspace lives on `request.tenancy`, set by
      // `requireWorkspaceContext`. Reading `request.workspaceId` — a property
      // nothing assigns — logged null on every request ever made, so the logs
      // could never show whether tenancy resolved or which shop a slow query
      // belonged to.
      workspaceId: (request as any).tenancy?.workspaceId ?? null,
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
    '/api/health',
    '/api/slo',
    '/api/auth/login',
    '/api/auth/signup',
    // ⚠️ The refresh token IS the credential here; there is no valid access
    // token by definition. Without this entry every renewal answered 401.
    '/api/auth/refresh',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
  ]

  // Exact-match public endpoints (no prefix matching: `/api/billing/plans` must
  // not open `/api/billing/plans/...` or anything else under billing).
  // The plan list is public by design — `usePlans()` is deliberately not
  // auth-gated so the landing page can quote the same prices `/billing` shows.
  // Without this entry every visitor's pricing section got a 401 and no price.
  const exactPublicPaths = ['/api/billing/plans']
  const path = url.split('?')[0]

  if (publicPaths.some((p) => url.startsWith(p))) return
  if (path !== undefined && exactPublicPaths.includes(path)) return
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
/**
 * Register every plugin and route on the server, without listening.
 *
 * Split out of `start()` so tests can build the real application in-process
 * and drive it with `server.inject()`. The previous smoke tests fetched
 * https://hisabche.onrender.com over the network, which made a unit-test run
 * depend on production being up and turned ordinary latency into flaky
 * failures.
 *
 * Registration order is unchanged — plugin order is behaviour in Fastify.
 */
export async function buildServer(): Promise<typeof server> {
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
          // The two Next dev servers, per their own `dev` scripts:
          // apps/web runs on 3039 and apps/admin on 3040. Both were missing,
          // so every browser call from either app failed preflight with
          // "No 'Access-Control-Allow-Origin' header is present" — including
          // the admin login, which made a CORS problem look like a broken
          // password. 3000/3001 are kept for any ad-hoc `next dev` that falls
          // back to the default port.
          'http://localhost:3039',
          'http://localhost:3040',
          'http://localhost:3000',
          'http://localhost:3001',
          // Expo's web dev server. Only the browser preview needs this — a
          // real device running through Expo Go is not a browser origin and
          // is never subject to CORS. Metro shifts to 8082/8083 when the
          // default port is busy, so the neighbours are listed too.
          'http://localhost:8081',
          'http://localhost:8082',
          'http://localhost:8083',
          'https://hisabche.com',
          'https://www.hisabche.com',
        ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    // ⚠️ Every custom header a client sends must be listed. `Idempotency-Key`
    // (packages/api/src/hooks/invoices.ts, read in utils/client-request.ts) was
    // missing: the browser's preflight rejected it and POST /api/invoices never
    // left the browser — creating an invoice on the web failed with a CORS error.
    // Guarded by __tests__/cors-allowed-headers.test.ts.
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-client-id',
      'Accept',
      'X-Auth-Transport',
      'Idempotency-Key',
    ],
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
  // The desktop update feed. Unauthenticated on purpose — see the module.
  await server.register(updatesRoutes)
  await server.register(productRoutes)
  await server.register(customerRoutes)
  await server.register(customerProfileRoutes)
  await server.register(transactionRoutes)
  await server.register(warehouseRoutes)
  await server.register(cycleCountRoutes)
  await server.register(unitsRoutes)
  await server.register(aiChatRoutes)
  await server.register(productUnitsRoutes)
  await server.register(currenciesRoutes)
  await server.register(inventoryInsightsRoutes)
  await server.register(intelligenceForecastRoutes)
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
  await server.register(inventoryCostingRoutes, { prefix: '/api/inventory' })
  await server.register(paymentsRoutes, { prefix: '/api/payments' })
  await server.register(conflictRoutes, { prefix: '/api/conflicts' })
  await server.register(governanceRoutes, { prefix: '/api/governance' })
  await server.register(branchRoutes, { prefix: '/api/branches' })
  await server.register(supplierRoutes, { prefix: '/api/suppliers' })
  await server.register(personalizationRoutes, { prefix: '/api/personalization' })
  await server.register(rulesRoutes, { prefix: '/api/rules' })
  await server.register(intelligenceRoutes, { prefix: '/api/intelligence' })
  await server.register(taxRoutes, { prefix: '/api/tax' })
  await server.register(posRoutes, { prefix: '/api/pos' })
  await server.register(financeOpsRoutes, { prefix: '/api/finance' })
  await server.register(operationsRoutes, { prefix: '/api/operations' })
  await server.register(migrationRoutes, { prefix: '/api/migrations' })
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
  await server.register(adminRoutes)

  server.log.info('✅ All routes registered successfully')

  return server
}

async function start() {
  try {
    await buildServer()

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
// Tests import this module to build the app and drive it with `inject()`;
// binding a port and starting the scheduler there would be both unnecessary and
// flaky. Production is untouched — `VITEST` is only ever set by the test runner.
if (!process.env.VITEST) {
  start()
}

export default server
