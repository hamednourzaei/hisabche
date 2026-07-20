// ============================================
// backend/src/routes/product.routes.ts
// FIXED: Cache invalidation with userId
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createProductSchema,
  updateProductSchema,
} from '@hisabche/validation'
import { ProductService } from '../services/product.service'
import { authenticate } from '../middleware/auth.middleware'
import { NotFoundError } from '../errors/database.error'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

// ✅ تنظیمات برای حذف $schema از خروجی
const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function productRoutes(fastify: FastifyInstance) {
  const productService = new ProductService()

  // ─── GET /api/products ──────────────────────────────────
  fastify.get('/api/products', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'products' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any
      
      const page = query.page ? parseInt(query.page, 10) : 1
      const limit = query.limit ? parseInt(query.limit, 10) : 20
      const search = query.search || ''
      const sortBy = query.sortBy || 'created_at'
      const sortDirection = query.sortDirection || 'desc'
      
      const userId = (request as any).userId
      
      if (!userId) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'User not authenticated',
        })
      }

      const result = await productService.list(userId, {
        page: Math.max(1, page),
        limit: Math.min(100, Math.max(1, limit)),
        search,
        sortBy,
        sortDirection,
        category: query.category,
        minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
        maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
        isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
        lowStock: query.lowStock === 'true',
        barcode: query.barcode,
      })
      
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ 
        error: 'Failed to fetch products',
        message: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  })

  // ─── GET /api/products/:id ─────────────────────────────
  fastify.get('/api/products/:id', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 120, keyPrefix: 'product' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const userId = (request as any).userId
      const product = await productService.getById(id, userId)
      return reply.send(product)
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch product' })
    }
  })

  // ─── POST /api/products ─────────────────────────────────
  fastify.post('/api/products', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any
      const userId = (request as any).userId
      const product = await productService.create(userId, body)
      
      // ✅ FIX: پاک کردن کش با userId
      await clearCache(`products:${userId}:*`)
      await clearCache(`low-stock:${userId}:*`)
      
      return reply.code(201).send(product)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create product' })
    }
  })

  // ─── PATCH /api/products/:id ────────────────────────────
  fastify.patch('/api/products/:id', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as any
      const userId = (request as any).userId
      const product = await productService.update(id, userId, body)
      
      // ✅ FIX: پاک کردن کش با userId
      await clearCache(`product:${userId}:${id}`)
      await clearCache(`products:${userId}:*`)
      await clearCache(`low-stock:${userId}:*`)
      
      return reply.send(product)
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update product' })
    }
  })

  // ─── DELETE /api/products/:id ───────────────────────────
  fastify.delete('/api/products/:id', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const userId = (request as any).userId
      await productService.delete(id, userId)
      
      // ✅ FIX: پاک کردن کش با userId
      await clearCache(`product:${userId}:${id}`)
      await clearCache(`products:${userId}:*`)
      await clearCache(`low-stock:${userId}:*`)
      
      return reply.code(204).send()
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to delete product' })
    }
  })

  // ─── GET /api/products/low-stock ────────────────────────
  fastify.get('/api/products/low-stock', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'low-stock' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId
      const products = await productService.getLowStock(userId)
      return reply.send(products)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch low stock products' })
    }
  })
}

export default productRoutes