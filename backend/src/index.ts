// ============================================
// backend/src/index.ts — Hisabche API Server v2.4
// FIXED: workspaceRoutes import — use default import
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
import { memoryCache } from './utils/pagination'

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────
import { authRoutes } from './routes/auth.routes'
import { syncRoutes } from './routes/sync.routes'
import { invoiceRoutes } from './routes/invoice.routes'
import { invoicePdfRoutes } from './routes/invoice-pdf.routes'
import { productRoutes } from './routes/product.routes'
import { customerRoutes } from './routes/customer.routes'
import { transactionRoutes } from './routes/transaction.routes'
import { warehouseRoutes } from './routes/warehouse.routes'
import { humanResourcesRoutes } from './routes/human-resources.routes'
import { projectRoutes } from './routes/project.routes'
// ✅ FIX: workspaceRoutes را از فایل routes import کن (نه از services)
import {workspaceRoutes} from './routes/workspace.routes'
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

// ──────────────────────────────────────────────
// Plugins & Scheduler
// ──────────────────────────────────────────────
import { jobSchedulerPlugin } from './plugins/job-scheduler.plugin'
import { startScheduler } from './scheduler'

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
})

// ──────────────────────────────────────────────
// STARTUP LOGGING
// ──────────────────────────────────────────────
server.log.info(`🚀 Starting Hisabche API v2.4...`)
server.log.info(`📦 Environment: ${process.env.NODE_ENV || 'development'}`)

// ──────────────────────────────────────────────
// 1. PERFORMANCE MONITORING MIDDLEWARE
// ──────────────────────────────────────────────
server.addHook('onRequest', async (request) => {
  ;(request as any).startTime = Date.now()
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
// 2. AUTH MIDDLEWARE (قبل از کش)
// ──────────────────────────────────────────────
server.addHook('preHandler', async (request, reply) => {
  const url = request.url
  
  const publicPaths = [
    '/docs', '/live', '/ready', '/api', '/api/health', '/api/slo',
    '/api/auth/login', '/api/auth/signup', '/api/auth/forgot-password',
    '/api/auth/reset-password', '/api/auth/verify-email',
  ]
  
  if (publicPaths.some(p => url.startsWith(p))) return
  if (request.method === 'OPTIONS') return
  
  await authenticate(request, reply)
})

// ──────────────────────────────────────────────
// 3. CACHE MIDDLEWARE (بعد از Auth — با userId)
// ──────────────────────────────────────────────
server.addHook('preHandler', async (request, reply) => {
  // فقط GET درخواست‌ها
  if (request.method !== 'GET') return

  const skipPaths = ['/api/health', '/api/live', '/api/ready', '/docs', '/api', '/api/slo']
  if (skipPaths.some(p => request.url.startsWith(p))) return
  if (request.url.includes('auth')) return

  // ✅ FIX: userId را از request بگیر (بعد از auth)
  const userId = (request as any).userId || 'anonymous'
  
  // ✅ FIX: کلید کش شامل userId
  const cacheKey = `http:${userId}:${request.url}`
  
  try {
    const cached = await memoryCache.get(cacheKey)
    if (cached) {
      reply.header('x-cache', 'HIT')
      reply.header('x-user-id', userId.substring(0, 8))
      reply.header('Cache-Control', 'private, max-age=30')
      return reply.send(cached)
    }
    reply.header('x-cache', 'MISS')
    reply.header('x-user-id', userId.substring(0, 8))
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    request.log.error(`Cache error: ${errorMessage}`)
  }
})

// ذخیره پاسخ در کش (بعد از auth)
server.addHook('onSend', async (request, reply, payload) => {
  if (request.method === 'GET' && reply.statusCode === 200) {
    const skipPaths = ['/api/health', '/api/live', '/api/ready', '/docs', '/api', '/api/slo']
    if (!skipPaths.some(p => request.url.startsWith(p)) && !request.url.includes('auth')) {
      const userId = (request as any).userId || 'anonymous'
      const cacheKey = `http:${userId}:${request.url}`
      try {
        await memoryCache.set(cacheKey, payload, 60)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        request.log.error(`Cache set error: ${errorMessage}`)
      }
    }
  }
  return payload
})

// ──────────────────────────────────────────────
// 4. HEALTH CHECKS
// ──────────────────────────────────────────────
server.get('/api/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  env: process.env.NODE_ENV,
  version: '2.4.0',
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
  version: '2.4.0',
  status: 'complete',
  docs: '/docs',
  health: '/api/health',
  live: '/live',
  ready: '/ready',
}))

server.get('/api/slo', async () => ({
  service: 'Hisabche API',
  version: '2.4.0',
  slo: {
    availability: '99.9%',
    p95Latency: '< 200ms',
    p99Latency: '< 500ms',
    errorRate: '< 0.1%',
  },
  timestamp: new Date().toISOString(),
}))

// ──────────────────────────────────────────────
// 5. 404 HANDLER
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
// 6. ERROR HANDLER
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
// 7. START SERVER
// ──────────────────────────────────────────────
async function start() {
  try {
    // ─── 7.1 COMPRESSION ──────────────────────
    await server.register(compress, {
      global: true,
      threshold: 1024,
      encodings: ['gzip', 'deflate'],
    })

    // ─── 7.2 CORS ─────────────────────────────
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
    })

    // ─── 7.3 SWAGGER ──────────────────────────
    await server.register(swagger, {
      openapi: {
        info: {
          title: 'Hisabche API',
          description: 'Business Operating System API v2.4',
          version: '2.4.0',
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

    // ─── 7.4 RATE LIMIT ────────────────────────
    await server.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
      keyGenerator: (request) => {
        const userId = (request as any).userId
        return userId || request.ip || 'anonymous'
      },
      errorResponseBuilder: (_request, context) => {
        const afterMs = typeof context.after === 'number' ? context.after : parseInt(String(context.after), 10) || 60000
        return {
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil(afterMs / 1000),
          limit: context.max,
        }
      },
    })

    // ─── 7.5 REGISTER ROUTES ──────────────────
    server.log.info('📦 Registering routes...')

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
    // ✅ FIX: workspaceRoutes را از فایل routes ثبت کن
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

    server.log.info('✅ All routes registered successfully')

    // ─── 7.6 START LISTENING ──────────────────
    await server.listen({ port: PORT, host: HOST })
    
    console.log(`\n🚀 Server running on ${HOST}:${PORT} — v2.4 Fully Optimized`)
    console.log(`📚 Swagger UI: /docs`)
    console.log(`💚 Health: /api/health | /live | /ready`)
    console.log(`🔍 Cache: ${process.env.REDIS_URL ? '✅ Redis enabled' : '📦 Memory cache'}`)
    console.log(`🔒 Cache: User-specific (userId in cache key)`)
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}\n`)

    // ─── 7.7 START SCHEDULER ──────────────────
    startScheduler()
    
  } catch (err) {
    const error = err as Error
    server.log.error(error)
    process.exit(1)
  }
}

// ──────────────────────────────────────────────
// 8. GRACEFUL SHUTDOWN
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