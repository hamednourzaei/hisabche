// ============================================
// backend/src/index.ts — Hisabche API Server
// Complete: 23 Phases + v1.1 (Workflow + Notifications + Job Scheduler)
// ============================================

import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import dotenv from 'dotenv'

// ──────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────
import { authenticate } from './middleware/auth.middleware'

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
import { godamRoutes } from './routes/godam.routes'

// ──────────────────────────────────────────────
// Routes — Phase 15: HR
// ──────────────────────────────────────────────
import { hrRoutes } from './routes/hr.routes'

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
import {accountingRoutes} from './routes/accounting.routes'

// ──────────────────────────────────────────────
// Routes — Phase 24: CRM
// ──────────────────────────────────────────────
import {crmRoutes} from './routes/crm.routes'

// ──────────────────────────────────────────────
// Routes — Phase 25: Manufacturing
// ──────────────────────────────────────────────
import {manufacturingRoutes} from './routes/manufacturing.routes'

// ──────────────────────────────────────────────
// Routes — Phase 26: Purchasing
// ──────────────────────────────────────────────
import {purchasingRoutes} from './routes/purchasing.routes'

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
    // ─── Rate Limit ──────────────────────────
    await server.register(rateLimit, {
      max: 200,
      timeWindow: '1 minute',
      keyGenerator: (request) => request.ip,
      errorResponseBuilder: (_request: any, context: any) => ({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil(context.after / 1000),
      }),
    })

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

    // ─── Health Checks (Public) ─────────────
    server.get('/api/health', async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      env: process.env.NODE_ENV,
    }))

    server.get('/api', async () => ({
      name: 'Hisabche API',
      version: '1.1.0',
      phases: 23,
      status: 'complete',
    }))

    // ─── Auth Middleware ─────────────────────
    const PUBLIC_PATHS = ['/api/health', '/api', '/api/auth/login', '/api/auth/signup']

    server.addHook('preHandler', async (request, reply) => {
      const url = request.url
      if (PUBLIC_PATHS.some((p) => url === p || url.startsWith(p + '?'))) return
      if (request.method === 'OPTIONS') return
      await authenticate(request, reply)
    })

    // ═══════════════════════════════════════════════════════════════
    // REGISTER ALL ROUTES — 23 Phases + v1.1
    // ═══════════════════════════════════════════════════════════════

    // ─── Phase 1-9: Core ────────────────────
    await server.register(authRoutes)
    await server.register(syncRoutes)
    await server.register(invoiceRoutes)
    await server.register(invoicePdfRoutes)
    await server.register(productRoutes)
    await server.register(customerRoutes)
    await server.register(transactionRoutes)
    await server.register(godamRoutes)

    // ─── Phase 15: HR ──────────────────────
    await server.register(hrRoutes)

    // ─── Phase 16: Projects ─────────────────
    await server.register(projectRoutes)

    // ─── Phase 17: Workspace ───────────────
    await server.register(workspaceRoutes)

    // ─── Phase 18: Permissions ─────────────
    await server.register(permissionRoutes)

    // ─── Phase 19: Audit ────────────────────
    await server.register(auditRoutes)

    // ─── Phase 20: Event System ─────────────
    await server.register(eventRoutes)

    // ─── Phase 21: Analytics ────────────────
    await server.register(analyticsRoutes)

    // ─── Phase 22: AI Assistant ─────────────
    await server.register(aiRoutes)

    // ─── Phase 23: Accounting ───────────────
    await server.register(accountingRoutes)

    // ─── Phase 24: CRM ──────────────────────
    await server.register(crmRoutes)

    // ─── Phase 25: Manufacturing ────────────
    await server.register(manufacturingRoutes)

    // ─── Phase 26: Purchasing ───────────────
    await server.register(purchasingRoutes)

    // ─── v1.1: Workflow ─────────────────────
    await server.register(workflowRoutes)

    // ─── v1.1: Notification ─────────────────
    await server.register(notificationRoutes)

    // ─── v1.1: Job Scheduler ────────────────
    await server.register(jobSchedulerPlugin)

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
      server.log.error(error)
      reply.status((error as any).statusCode || 500).send({
        error: (error as any).name || 'Internal Server Error',
        message: error.message || 'Unexpected error',
        statusCode: (error as any).statusCode || 500,
      })
    })

    // ─── Start Server ───────────────────────
    await server.listen({ port: PORT, host: HOST })
    server.log.info(`🚀 Server running on ${HOST}:${PORT} — 23 phases + v1.1 (Workflow + Notifications + Jobs) loaded`)
  } catch (err) {
    server.log.error(err)
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
    server.log.error(err)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

start()