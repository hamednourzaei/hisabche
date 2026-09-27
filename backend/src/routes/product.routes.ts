// ============================================
// backend/src/routes/product.routes.ts
// FIXED: Cache invalidation with userId
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { createProductSchema, updateProductSchema } from '@hisabche/validation'
import { ProductService } from '../services/product.service'
import {
  IdempotencyUnavailableError,
  readClientRequestId,
  sendCreated,
} from '../utils/client-request'
import { StockHistoryService } from '../services/inventory/stock-history.service'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { ConflictError, NotFoundError } from '../errors/database.error'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

// ✅ تنظیمات برای حذف $schema از خروجی
const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function productRoutes(fastify: FastifyInstance) {
  const productService = new ProductService()
  const stockHistoryService = new StockHistoryService()

  // ─── GET /api/products ──────────────────────────────────
  fastify.get(
    '/api/products',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'products' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as any

        const page = query.page ? parseInt(query.page, 10) : 1
        const limit = query.limit ? parseInt(query.limit, 10) : 20
        const search = query.search || ''
        const sortBy = query.sortBy || 'created_at'
        const sortDirection = query.sortDirection || 'desc'

        // requireWorkspaceContext has already answered 401/403 for a caller
        // without an authorized workspace, so `tenancy` is present.
        const result = await productService.list(request.tenancy, {
          page: Math.max(1, page),
          limit: Math.min(100, Math.max(1, limit)),
          search,
          sortBy,
          sortDirection,
          category: query.category,
          minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
          maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
          isActive:
            query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
          // ⚠️ THREE STATES, NOT TWO. This was `query.lowStock === 'true'`,
          // which turned an ABSENT parameter into `false` — and the service
          // reads `false` as «only products ABOVE their minimum». So every
          // plain list request hid every low, empty and negative product: the
          // warehouse page silently dropped exactly the items that needed
          // attention, while their own detail URLs still worked.
          lowStock:
            query.lowStock === 'true' ? true : query.lowStock === 'false' ? false : undefined,
          barcode: query.barcode,
          includeSummary: query.includeSummary === 'true' ? true : undefined,
        })

        return reply.send(result)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({
          error: 'Failed to fetch products',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    },
  )

  // ─── GET /api/products/by-barcode/:code ────────────────
  //
  // The scanner's lookup. Exact match, never cached (a price must be current),
  // and three distinct answers: 200 found, 409 ambiguous (the cashier picks —
  // never silently the first), 404 unknown. A failed query is a 500, never a
  // 404: «unknown barcode» invites creating a product that already exists.
  // Declared before /:id so the static segment wins.
  fastify.get(
    '/api/products/by-barcode/:code',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { code } = request.params as { code: string }
      try {
        const result = await productService.lookupByBarcode(request.tenancy, code)
        reply.header('cache-control', 'no-store')
        if (result.status === 'found') return reply.send({ product: result.product })
        if (result.status === 'ambiguous') {
          return reply
            .code(409)
            .send({
              error: 'BARCODE_AMBIGUOUS',
              code: 'BARCODE_AMBIGUOUS',
              products: result.products,
            })
        }
        return reply.code(404).send({ error: 'BARCODE_NOT_FOUND', code: 'BARCODE_NOT_FOUND' })
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to look up barcode' })
      }
    },
  )

  // ─── GET /api/products/:id ─────────────────────────────
  fastify.get(
    '/api/products/:id',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'product' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const product = await productService.getById(id, request.tenancy)
        return reply.send(product)
      } catch (err) {
        if (err instanceof NotFoundError) {
          return reply.code(404).send({ error: err.message })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch product' })
      }
    },
  )

  // ─── POST /api/products ─────────────────────────────────
  fastify.post(
    '/api/products',
    {
      preHandler: [authenticate, requireWorkspaceContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as any
        const { workspaceId } = request.tenancy
        const product = await productService.create(request.tenancy, body, {
          clientRequestId: readClientRequestId(request),
        })

        // Invalidation keys must match the cache identity exactly — these were
        // userId-keyed, which after the switch to workspace keys would leave
        // every stale entry in place forever.
        await clearCache(`products:${workspaceId}:*`)
        await clearCache(`low-stock:${workspaceId}:*`)

        return sendCreated(reply, product)
      } catch (err) {
        // Another product in this workspace already carries this barcode.
        // Named by field so the form takes the cashier straight to it.
        if (err instanceof ConflictError && err.message === 'BARCODE_TAKEN') {
          return reply.code(409).send({
            error: 'BARCODE_TAKEN',
            code: 'BARCODE_TAKEN',
            message: 'BARCODE_TAKEN',
            details: [{ path: ['barcode'], message: 'BARCODE_TAKEN' }],
          })
        }
        if (err instanceof IdempotencyUnavailableError) {
          return reply.code(503).send({ error: err.message, code: err.code })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to create product' })
      }
    },
  )

  // ─── PATCH /api/products/:id ────────────────────────────
  fastify.patch(
    '/api/products/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = request.body as any
        const { workspaceId } = request.tenancy
        const product = await productService.update(id, request.tenancy, body)

        // Invalidation keys must match the cache identity exactly — these were
        // userId-keyed, which after the switch to workspace keys would leave
        // every stale entry in place forever.
        await clearCache(`product:${workspaceId}:${id}`)
        await clearCache(`products:${workspaceId}:*`)
        await clearCache(`low-stock:${workspaceId}:*`)

        return reply.send(product)
      } catch (err) {
        // Another product in this workspace already carries this barcode.
        // Named by field so the form takes the cashier straight to it.
        if (err instanceof ConflictError && err.message === 'BARCODE_TAKEN') {
          return reply.code(409).send({
            error: 'BARCODE_TAKEN',
            code: 'BARCODE_TAKEN',
            message: 'BARCODE_TAKEN',
            details: [{ path: ['barcode'], message: 'BARCODE_TAKEN' }],
          })
        }
        if (err instanceof NotFoundError) {
          return reply.code(404).send({ error: err.message })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to update product' })
      }
    },
  )

  // ─── DELETE /api/products/:id ───────────────────────────
  fastify.delete(
    '/api/products/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const { workspaceId } = request.tenancy
        await productService.delete(id, request.tenancy)

        // Invalidation keys must match the cache identity exactly — these were
        // userId-keyed, which after the switch to workspace keys would leave
        // every stale entry in place forever.
        await clearCache(`product:${workspaceId}:${id}`)
        await clearCache(`products:${workspaceId}:*`)
        await clearCache(`low-stock:${workspaceId}:*`)

        return reply.code(204).send()
      } catch (err) {
        if (err instanceof NotFoundError) {
          return reply.code(404).send({ error: err.message })
        }
        if (err instanceof ConflictError) {
          // In use (sales / stock history): the code tells the client why.
          return reply.code(409).send({ error: err.message, code: err.message })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to delete product' })
      }
    },
  )

  // ─── GET /api/products/:id/stock-history ────────────────
  //
  // H4 — how this product's on-hand figure got to be what it is.
  //
  // Phase C made `stock_movements` the source of truth for quantity, and
  // nothing exposed them: the number users argue with most had no explanation
  // anywhere in the product.
  //
  // Uncached. An arrival or a sale changes this answer, and a stale history is
  // worse than a slow one when someone is checking why a count is wrong.
  fastify.get(
    '/api/products/:id/stock-history',
    {
      preHandler: [authenticate, requireWorkspaceContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const { limit } = request.query as { limit?: string }
        return reply.send(await stockHistoryService.get(request.tenancy, id, Number(limit) || 200))
      } catch (err) {
        if (err instanceof NotFoundError) {
          return reply.code(404).send({ error: 'Product not found' })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch the stock history' })
      }
    },
  )

  // ─── GET /api/products/low-stock ────────────────────────
  fastify.get(
    '/api/products/low-stock',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'low-stock' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const products = await productService.getLowStock(request.tenancy)
        return reply.send(products)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch low stock products' })
      }
    },
  )
}

export default productRoutes
