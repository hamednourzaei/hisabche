// ============================================
// backend/src/routes/product.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  createProductSchema,
  updateProductSchema,
  productFiltersSchema,
  CreateProduct,
  UpdateProduct,
  ProductFilters,
} from '@hisabche/validation'
import { ProductService } from '../services/product.service'
import { authenticate } from '../middleware/auth.middleware'  // ✅ تغییر از verifyToken به authenticate
import { NotFoundError } from '../errors/database.error'

export async function productRoutes(fastify: FastifyInstance) {
  const productService = new ProductService()

  // ─── GET /api/products ──────────────────────────────────
  fastify.get('/api/products', {
    preHandler: [authenticate],  // ✅ تغییر از verifyToken به authenticate
    schema: {
      querystring: productFiltersSchema,
      response: {
        200: z.object({
          products: z.array(z.any()),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
        }),
        400: z.object({ error: z.string(), details: z.any().optional() }),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = productFiltersSchema.parse(request.query)
      const userId = (request as any).userId
      const result = await productService.list(userId, query)
      return reply.send(result)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: err.errors,
        })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch products' })
    }
  })

  // ─── GET /api/products/:id ─────────────────────────────
  fastify.get('/api/products/:id', {
    preHandler: [authenticate],  // ✅ تغییر از verifyToken به authenticate
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: z.any(),
        404: z.object({ error: z.string() }),
      },
    },
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
    preHandler: [authenticate],  // ✅ تغییر از verifyToken به authenticate
    schema: {
      body: createProductSchema,
      response: {
        201: z.any(),
        400: z.object({ error: z.string(), details: z.any().optional() }),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createProductSchema.parse(request.body)
      const userId = (request as any).userId
      const product = await productService.create(userId, body)
      return reply.code(201).send(product)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: err.errors,
        })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create product' })
    }
  })

  // ─── PATCH /api/products/:id ────────────────────────────
  fastify.patch('/api/products/:id', {
    preHandler: [authenticate],  // ✅ تغییر از verifyToken به authenticate
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: updateProductSchema,
      response: {
        200: z.any(),
        400: z.object({ error: z.string(), details: z.any().optional() }),
        404: z.object({ error: z.string() }),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const body = updateProductSchema.parse(request.body)
      const userId = (request as any).userId
      const product = await productService.update(id, userId, body)
      return reply.send(product)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: err.errors,
        })
      }
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update product' })
    }
  })

  // ─── DELETE /api/products/:id ───────────────────────────
  fastify.delete('/api/products/:id', {
    preHandler: [authenticate],  // ✅ تغییر از verifyToken به authenticate
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: {
        204: z.undefined(),
        404: z.object({ error: z.string() }),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const userId = (request as any).userId
      await productService.delete(id, userId)
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
    preHandler: [authenticate],  // ✅ تغییر از verifyToken به authenticate
    schema: {
      response: {
        200: z.array(z.any()),
      },
    },
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