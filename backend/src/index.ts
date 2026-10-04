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
import cors, { type FastifyCorsOptions } from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { SharedRateLimitStore } from './utils/shared-rate-limit-store'
import { cacheService } from './services/cache.service'
import {
  registerInstanceAdminRoutes,
  registerSystemMetricsRoutes,
} from './routes/system-metrics.routes'
import { startInstanceHeartbeat } from './services/instance-registry'
import { MONITOR_BANNER_CSS, MONITOR_BANNER_JS } from './docs/monitor-banner'
import compress from '@fastify/compress'
import { constants as zlibConstants } from 'node:zlib'
import { COMPRESSIBLE_TYPES } from './utils/compress-types'
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
import { syncStreamRoutes } from './routes/sync-stream.routes'
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
import { automationRoutes } from './routes/automation.routes'
import { escalationRoutes } from './routes/escalation.routes'
import { compensationRoutes } from './routes/compensation.routes'
import { savedViewsRoutes } from './routes/saved-views.routes'
import { analysisRoutes } from './routes/analysis.routes'
import { installmentRoutes } from './routes/installments.routes'
import { attendanceRoutes } from './routes/attendance.routes'
import { promotionRoutes } from './routes/promotions.routes'
import { priceListRoutes } from './routes/price-lists.routes'
import { lateFeeRoutes } from './routes/late-fees.routes'
import { translateRoutes } from './routes/translate.routes'
import { ingestRoutes } from './routes/ingest.routes'
import { notesRoutes } from './routes/notes.routes'
import { financingRoutes } from './routes/financing.routes'
import { customFieldRoutes } from './routes/custom-fields.routes'
import { customReportRoutes } from './routes/custom-reports.routes'
import { snapshotRoutes } from './routes/snapshots.routes'
import { mcpRoutes } from './routes/mcp.routes'
import { campaignRoutes } from './routes/campaigns.routes'
import { purchasingRoutes } from './routes/purchasing.routes'
import { billingRoutes } from './routes/billing.routes'
import { walletRoutes } from './routes/wallet.routes'
import { marketRoutes } from './routes/market.routes'
import { marketPublicRoutes } from './routes/market-public.routes'
import { productImagesRoutes } from './routes/product-images.routes'
import { referralRoutes } from './routes/referral.routes'
import { blogRoutes, isPublicBlogRequest } from './routes/blog.routes'
import { workflowRoutes } from './routes/workflow.routes'
import { notificationRoutes } from './routes/notification.routes'
import { debugRoutes } from './routes/debug.routes'
// ✅ اضافه کردن Activity Routes
import { activityRoutes } from './routes/activity.routes'
import adminRoutes from './routes/admin.routes'
import { developerRoutes } from './routes/developer.routes'
import { ordersRoutes } from './routes/orders.routes'
import { isPublicApiPath, storefrontRoutes } from './routes/storefront.routes'
import { customerPortalRoutes } from './routes/customer-portal.routes'
import { oauthRoutes } from './routes/oauth.routes'
import { marketplaceRoutes } from './routes/marketplace.routes'
import { sandboxRoutes } from './routes/sandbox.routes'
import { PUBLISHABLE_KEY_HEADER } from '@hisabche/validation'
import {
  API_KEY_RATE_LIMIT_PER_MINUTE,
  isApiKeyBucket,
  rateLimitBucket,
} from './services/developer/developer.domain'
import { developerService } from './services/developer/developer.service'

// ──────────────────────────────────────────────
// Plugins & Scheduler
// ──────────────────────────────────────────────
import { jobSchedulerPlugin } from './plugins/job-scheduler.plugin'
import { startScheduler } from './scheduler'
import { getMetrics, enterMetricsContext } from './utils/request-metrics'
import { slowestCalls, waitingMs } from './utils/supabase-fetch-metrics'
import { trustedProxies } from './utils/trusted-proxies'

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
  // The real client address behind Render's load balancer and Cloudflare —
  // and ONLY behind them. See utils/trusted-proxies.ts.
  trustProxy: trustedProxies(),
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

/**
 * Uncount a request exactly once, however it ended.
 *
 * ⚠️ onResponse DOES NOT RUN for a reply that was hijacked (the /docs metrics
 * stream) or whose client went away mid-request (a closed tab, a cancelled
 * query). Counted only there, every such request stayed «in flight» forever:
 * the counter only grew, and inflightAtStart in the perf log — 14 on a quiet
 * server — was mostly ghosts. The raw response's 'close' fires in every case.
 */
function releaseInflight(request: { countedInflight?: boolean }): void {
  if (!request.countedInflight) return
  request.countedInflight = false
  inflightRequests = Math.max(0, inflightRequests - 1)
}

server.addHook('onRequest', async (request, reply) => {
  ;(request as any).startTime = Date.now()
  // context شمارنده‌ی کوئری را برای این درخواست فعال می‌کند.
  enterMetricsContext(inflightRequests)
  inflightRequests += 1
  ;(request as any).countedInflight = true
  reply.raw.once('close', () => releaseInflight(request as { countedInflight?: boolean }))
})

server.addHook('onResponse', async (request, reply) => {
  // فاز ۰ — یک خط ساختاریافته به‌ازای هر درخواست، تا بتوان جدول
  // «Endpoint / تعداد Query / زمان DB / زمان کل» را مستقیماً از لاگ Render
  // ساخت. OPTIONS ها حذف می‌شوند چون نویز محض‌اند.
  releaseInflight(request as { countedInflight?: boolean })
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

// Every request made WITH AN API KEY is written to the key's request log
// (docs/developer-platform-02-migration.sql): route PATTERN, status, duration.
// Fire-and-forget — a log must never slow down or fail the response.
server.addHook('onResponse', async (request, reply) => {
  const key = request.apiKey
  if (!key) return
  developerService.recordRequest({
    workspaceId: key.workspaceId,
    keyId: key.id,
    method: request.method,
    route: request.routeOptions.url ?? 'unmatched',
    status: reply.statusCode,
    durationMs: Math.round(reply.elapsedTime),
  })
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
    // ⚠️ A CRAWLER CANNOT AUTHENTICATE.
    //
    // Search Console reported `robots.txt` on this host as «Blocked due to
    // unauthorized request (401)» — the global auth hook below was answering
    // the one file whose entire purpose is to be readable by anonymous
    // machines. A robots.txt that cannot be fetched is not a permissive
    // robots.txt: Google treats a 401 as «unknown», which is why the API host
    // sat in the report as a crawl error for weeks.
    '/robots.txt',
    '/api/health',
    '/api/slo',
    // Live CPU/RAM percentages for the /docs bar — public by decision (routes/system-metrics.routes.ts).
    '/api/system/metrics',
    '/api/auth/login',
    '/api/auth/signup',
    // ⚠️ The refresh token IS the credential here; there is no valid access
    // token by definition. Without this entry every renewal answered 401.
    '/api/auth/refresh',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
    // ⚠️ Deliberately public, and ONLY what is registered under it: the
    // tokenised invoice view (invoice-public.routes.ts), the tokenised CRM task
    // link (crm.routes.ts) and the storefront (storefront.routes.ts), each with
    // its own check. Before this entry the global hook answered 401 to every
    // one of them — the /public-invoice and /public-task pages have never
    // worked for the person the link was sent to (BUG-077). A route added here
    // must be public by design: storefront-orders.test.ts lists them all.
    '/api/public/',
  ]

  // Exact-match public endpoints (no prefix matching: `/api/billing/plans` must
  // not open `/api/billing/plans/...` or anything else under billing).
  // The plan list is public by design — `usePlans()` is deliberately not
  // auth-gated so the landing page can quote the same prices `/billing` shows.
  // Without this entry every visitor's pricing section got a 401 and no price.
  // `/api/oauth/token` is called by an app's SERVER with its client secret and
  // a one-time code — there is no user session by definition (RFC 6749 §4.1.3).
  // `/mcp` authenticates the integration credential ITSELF (mcp.routes.ts): this
  // hook would hold an API key to the route allowlist, and the gateway is not a
  // Public API route — it is the door to them. Every tool call it makes goes
  // back through this hook, on a route the allowlist does name.
  const exactPublicPaths = ['/api/billing/plans', '/api/oauth/token', '/api/oauth/revoke', '/mcp']
  const path = url.split('?')[0]

  if (publicPaths.some((p) => url.startsWith(p))) return
  if (path !== undefined && exactPublicPaths.includes(path)) return
  // The public blog: reading it, and the view beacon. Signed-in blog routes
  // (comment, like, stars, «me») authenticate in their own preHandler.
  if (path !== undefined && isPublicBlogRequest(request.method, path)) return
  if (request.method === 'OPTIONS') return

  await authenticate(request, reply)
})

// ──────────────────────────────────────────────
// 3. HEALTH CHECKS
// ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
// robots.txt
//
// ⚠️ NOTHING ON THIS HOST BELONGS IN A SEARCH INDEX.
//
// It is an API: every path either needs a token or returns somebody's data.
// A crawler that indexes it wastes crawl budget the marketing site needs, and
// any endpoint that ever answers without auth becomes a public search result.
//
// `Disallow: /` is the whole policy, stated once. There is deliberately no
// sitemap line — there is nothing here to find.
// ══════════════════════════════════════════════════════════════════════════
const API_ROBOTS = ['User-agent: *', 'Disallow: /', ''].join('\n')

server.get('/robots.txt', async (_request, reply) =>
  reply
    .type('text/plain; charset=utf-8')
    // A day: long enough to stop re-fetching, short enough that a change to
    // this policy is not stuck in caches for a week.
    .header('Cache-Control', 'public, max-age=86400')
    .send(API_ROBOTS),
)

server.get('/api/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  env: process.env.NODE_ENV,
  version: '2.5.0',
  // The exact build this instance runs (Render sets it per deploy). During a
  // rolling deploy two instances can differ — this is how to tell.
  commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null,
  // ⚠️ Configured, not connected: REDIS_URL being set says nothing about
  // whether this instance reached Redis. `redisConnected` does.
  cache: process.env.REDIS_URL ? 'redis' : 'memory',
  redisConnected: cacheService.isShared,
}))

registerSystemMetricsRoutes(server, () => inflightRequests)
registerInstanceAdminRoutes(server)

server.get('/live', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}))

// The load balancer's question: can this instance serve? It reads the STATUS
// CODE, not the body — so a database it cannot reach is a 503.
//
// ⚠️ This answered 200 with `database: 'disconnected'` in the body: a health
// check would have kept sending traffic to an instance with no database.
// Redis is deliberately NOT part of it: every instance shares the one Redis,
// and without it the backend still serves correctly (uncached, rate limit per
// instance) — failing readiness on it would take every instance out at once.
server.get('/ready', async (_request, reply) => {
  let connected = false
  try {
    const { error } = await supabase.from('products').select('id').limit(1)
    connected = !error
  } catch {
    connected = false
  }
  return reply.status(connected ? 200 : 503).send({
    status: connected ? 'ok' : 'error',
    database: connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  })
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
    // Brotli first for clients that accept it (every browser, Electron, RN's
    // fetch). Quality 4, not the library's maximum 11: measured on a 500-row
    // sync page, q11 costs ~80–380 ms per response against ~2 ms for q4, for
    // a size q4 already brings within a few percent (wire-codec.test.ts).
    encodings: ['br', 'gzip', 'deflate'],
    brotliOptions: { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } },
    // The library defaults plus Hisabche Sync Binary. event-stream stays
    // excluded: a compressed SSE stream is buffered and stops being live.
    customTypes: COMPRESSIBLE_TYPES,
  })

  // ─── 6.2 CORS ─────────────────────────────
  const APP_CORS: FastifyCorsOptions = {
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
  }

  // ⚠️ /api/public/ IS CALLED FROM CUSTOMERS' OWN WEBSITES.
  // The storefront, and the invoice / portal / task views a shop may embed.
  // Their origins cannot be listed here: a publishable key carries its own
  // list (storefront.routes.ts), and a token-addressed view is protected by
  // the token, not by who asks. So these paths — and only these — answer any
  // origin, WITHOUT credentials (no cookie or session ever rides along).
  const STOREFRONT_CORS: FastifyCorsOptions = {
    origin: true,
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key', PUBLISHABLE_KEY_HEADER],
    maxAge: 86400,
  }

  await server.register(cors, {
    delegator: (request, callback) =>
      callback(null, isPublicApiPath(request.url ?? '') ? STOREFRONT_CORS : APP_CORS),
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
    // The live CPU/RAM bar at the top (docs/monitor-banner.ts). Theme files are
    // served from /docs itself, so the strict CSP above allows them.
    theme: {
      css: [{ filename: 'monitor.css', content: MONITOR_BANNER_CSS }],
      js: [{ filename: 'monitor.js', content: MONITOR_BANNER_JS }],
    },
  })

  // ─── 6.4 RATE LIMIT ────────────────────────
  await server.register(rateLimit, {
    // One budget across all instances (Redis), not one per process.
    store: SharedRateLimitStore,
    // An API key has its own bucket and budget (developer.domain.ts).
    max: (_request, key) => (isApiKeyBucket(key) ? API_KEY_RATE_LIMIT_PER_MINUTE : 100),
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      const userId = (request as any).userId
      return rateLimitBucket(request.headers.authorization, userId || request.ip || 'anonymous')
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
  await server.register(syncStreamRoutes)
  await server.register(invoiceRoutes)
  await server.register(invoicePdfRoutes)
  await server.register(invoicePublicRoutes)
  // The desktop update feed. Unauthenticated on purpose — see the module.
  await server.register(updatesRoutes)
  await server.register(productRoutes)
  await server.register(productImagesRoutes)
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
  await server.register(automationRoutes)
  await server.register(escalationRoutes)
  await server.register(compensationRoutes)
  await server.register(savedViewsRoutes)
  await server.register(analysisRoutes)
  await server.register(installmentRoutes)
  await server.register(attendanceRoutes)
  await server.register(promotionRoutes)
  await server.register(priceListRoutes)
  await server.register(lateFeeRoutes)
  await server.register(translateRoutes)
  await server.register(ingestRoutes)
  await server.register(notesRoutes)
  await server.register(financingRoutes)
  await server.register(customFieldRoutes)
  await server.register(customReportRoutes)
  await server.register(snapshotRoutes)
  await server.register(mcpRoutes)
  await server.register(campaignRoutes)
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
  await server.register(walletRoutes)
  await server.register(marketRoutes)
  await server.register(marketPublicRoutes)
  await server.register(referralRoutes)
  await server.register(blogRoutes)
  // API keys and outbound webhooks (docs/developer-platform-migration.sql).
  await server.register(developerRoutes)
  // Sales orders + storefront settings; and the public storefront API.
  await server.register(ordersRoutes)
  await server.register(storefrontRoutes)
  // Customer portal links, and the portal itself (public, by token).
  await server.register(customerPortalRoutes)
  // OAuth apps, consent, the token endpoint, the marketplace and its review.
  await server.register(oauthRoutes)
  await server.register(marketplaceRoutes)
  await server.register(sandboxRoutes)
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
    // The admin «servers» page reads these (services/instance-registry.ts).
    startInstanceHeartbeat(() => inflightRequests)
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
