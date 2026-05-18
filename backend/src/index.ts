// ============================================
// backend/src/index.ts
// ============================================

import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import dotenv from 'dotenv'
import { syncRoutes } from './routes/sync.routes'
import { invoiceRoutes } from './routes/invoice.routes'
import { productRoutes } from './routes/product.routes'
import { customerRoutes } from './routes/customer.routes'
import { authRoutes } from './routes/auth.routes'
import { transactionRoutes } from './routes/transaction.routes'
import { godamRoutes } from './routes/godam.routes'
import { invoicePdfRoutes } from './routes/invoice-pdf.routes'

// Load environment variables
dotenv.config({ path: '../../.env' })

// ============================================
// Server Setup
// ============================================

const PORT = parseInt(process.env.PORT || '3001', 10)
const HOST = process.env.HOST || '0.0.0.0'

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
// Plugins & Routes
// ============================================

async function start(): Promise<void> {
  try {
    // Rate Limit — global
    await server.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    })

    // CORS
    await server.register(cors, {
      origin: isProduction
        ? ['https://hisabche.com']
        : [
            'http://localhost:3000',
            'http://localhost:19006',
            'http://localhost:8081',
            'http://127.0.0.1:8081',
          ],
      credentials: true,
    })

    // Health check
    server.get('/api/health', async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '0.0.1',
      }
    })

    // API info
    server.get('/api', async () => {
      return {
        name: 'Hisabche API',
        version: '0.0.1',
        documentation: '/api/docs',
      }
    })

    // Auth routes
    await server.register(authRoutes)

    // Business routes
    await server.register(syncRoutes)
    await server.register(invoiceRoutes)
    await server.register(invoicePdfRoutes)
    await server.register(productRoutes)
    await server.register(customerRoutes)
    await server.register(transactionRoutes)
    await server.register(godamRoutes)

    // 404 handler
    server.setNotFoundHandler((_request, reply) => {
      reply.status(404).send({
        error: 'Not Found',
        message: 'The requested resource does not exist',
        statusCode: 404,
      })
    })

    // Global error handler
    server.setErrorHandler((error, _request, reply) => {
      server.log.error(error.message || 'Unknown error')
      const statusCode = error.statusCode || 500
      reply.status(statusCode).send({
        error: error.name || 'Internal Server Error',
        message: error.message || 'An unexpected error occurred',
        statusCode,
      })
    })

    // Start server
    await server.listen({ port: PORT, host: HOST })
    server.log.info(`Server running on http://${HOST}:${PORT}`)
  } catch (err) {
    server.log.error(err instanceof Error ? err.message : 'Failed to start server')
    process.exit(1)
  }
}

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  server.log.info(`Received ${signal}. Shutting down gracefully...`)
  try {
    await server.close()
    server.log.info('Server closed')
    process.exit(0)
  } catch (err) {
    server.log.error(err instanceof Error ? err.message : 'Error during shutdown')
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

start()