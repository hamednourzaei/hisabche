// ============================================
// backend/src/index.ts
// ============================================

import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import dotenv from 'dotenv'

// Routes
import { syncRoutes } from './routes/sync.routes'
import { invoiceRoutes } from './routes/invoice.routes'
import { productRoutes } from './routes/product.routes'
import { customerRoutes } from './routes/customer.routes'
import { authRoutes } from './routes/auth.routes'
import { transactionRoutes } from './routes/transaction.routes'
import { godamRoutes } from './routes/godam.routes'
import { invoicePdfRoutes } from './routes/invoice-pdf.routes'

/**
 * ============================================
 * ENV SETUP (PRODUCTION SAFE)
 * ============================================
 * - Render / Vercel: env vars are injected automatically
 * - local dev: uses .env file
 */
if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}

// ============================================
// Server Setup
// ============================================

const PORT = Number(process.env.PORT || 3001)
const HOST = '0.0.0.0'

const isProduction = process.env.NODE_ENV === 'production'

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

// ============================================
// START FUNCTION
// ============================================

async function start(): Promise<void> {
  try {
    // ----------------------------
    // Rate Limit
    // ----------------------------
    await server.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    })

    // ----------------------------
    // CORS (PRODUCTION SAFE)
    // ----------------------------
    await server.register(cors, {
      origin: isProduction
        ? [
            process.env.FRONTEND_URL || 'https://project-ro4vn-hisabche-s-projects.vercel.app',
          ]
        : [
            'https://project-ro4vn-hisabche-s-projects.vercel.app',
    'https://project-ro4vn.vercel.app',
    'http://localhost:3000',
          ],
      credentials: true,
    })

    // ----------------------------
    // HEALTH CHECK (IMPORTANT FOR RENDER)
    // ----------------------------
    server.get('/api/health', async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        env: process.env.NODE_ENV,
      }
    })

    // ----------------------------
    // API INFO
    // ----------------------------
    server.get('/api', async () => {
      return {
        name: 'Hisabche API',
        version: '0.0.1',
      }
    })

    // ----------------------------
    // ROUTES
    // ----------------------------
    await server.register(authRoutes, { prefix: '/api/auth' })
    await server.register(syncRoutes, { prefix: '/api/sync' })
    await server.register(invoiceRoutes, { prefix: '/api/invoices' })
    await server.register(invoicePdfRoutes, { prefix: '/api/invoices/pdf' })
    await server.register(productRoutes, { prefix: '/api/products' })
    await server.register(customerRoutes, { prefix: '/api/customers' })
    await server.register(transactionRoutes, { prefix: '/api/transactions' })
    await server.register(godamRoutes, { prefix: '/api/godam' })

    // ----------------------------
    // 404 HANDLER
    // ----------------------------
    server.setNotFoundHandler((_req, reply) => {
      reply.status(404).send({
        error: 'Not Found',
        message: 'Route does not exist',
        statusCode: 404,
      })
    })

    // ----------------------------
    // GLOBAL ERROR HANDLER
    // ----------------------------
    server.setErrorHandler((error, _req, reply) => {
      server.log.error(error)

      reply.status(error.statusCode || 500).send({
        error: error.name || 'Internal Server Error',
        message: error.message || 'Unexpected error',
        statusCode: error.statusCode || 500,
      })
    })

    // ----------------------------
    // START SERVER
    // ----------------------------
    await server.listen({
      port: PORT,
      host: HOST,
    })

    server.log.info(`🚀 Server running on ${HOST}:${PORT}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

// ============================================
// GRACEFUL SHUTDOWN (RENDER SAFE)
// ============================================

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