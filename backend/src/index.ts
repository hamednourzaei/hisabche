// ============================================
// backend/src/index.ts — RATE LIMIT FIX
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

if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}

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

async function start(): Promise<void> {
  try {
    // ----------------------------
    // Rate Limit — Global
    // ----------------------------
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

    // ----------------------------
    // CORS
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
            'https://hisabche.com',
            'https://www.hisabche.com',
          ],
      credentials: true,
    })

    // ----------------------------
    // Health check
    // ----------------------------
    server.get('/api/health', async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      env: process.env.NODE_ENV,
    }))

    server.get('/api', async () => ({
      name: 'Hisabche API',
      version: '0.0.1',
    }))

    // ----------------------------
    // Routes
    // ----------------------------
    await server.register(authRoutes)
    await server.register(syncRoutes)
    await server.register(invoiceRoutes)
    await server.register(invoicePdfRoutes)
    await server.register(productRoutes)
    await server.register(customerRoutes)
    await server.register(transactionRoutes)
    await server.register(godamRoutes)

    // ----------------------------
    // 404
    // ----------------------------
    server.setNotFoundHandler((_req, reply) => {
      reply.status(404).send({
        error: 'Not Found',
        message: 'Route does not exist',
        statusCode: 404,
      })
    })

    // ----------------------------
    // Error handler
    // ----------------------------
    server.setErrorHandler((error, _req, reply) => {
      server.log.error(error)
      reply.status((error as any).statusCode || 500).send({
        error: (error as any).name || 'Internal Server Error',
        message: error.message || 'Unexpected error',
        statusCode: (error as any).statusCode || 500,
      })
    })

    await server.listen({ port: PORT, host: HOST })
    server.log.info(`🚀 Server running on ${HOST}:${PORT}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

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