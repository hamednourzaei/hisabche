// ============================================
// backend/src/routes/product.routes.ts
// FIXED: Cache invalidation with userId
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { createProductSchema, unitSchema, updateProductSchema } from '@hisabche/validation'
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
import { ValidationError } from '../errors/validation.error'
import { invalidateMoneyCaches } from '../utils/money-cache'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

// ✅ تنظیمات برای حذف $schema از خروجی
const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

/** Which field a product refusal is about, so the form can point at it. */
const REFUSAL_FIELD: Record<string, string> = {
  PRODUCT_WAREHOUSE_REQUIRED: 'warehouseId',
  PRODUCT_WAREHOUSE_NOT_FOUND: 'warehouseId',
  PRODUCT_QUANTITY_INVALID: 'quantity',
}

function sendRefusal(reply: FastifyReply, err: ValidationError) {
  const field = REFUSAL_FIELD[err.message]
  return reply.code(400).send({
    error: err.message,
    code: err.message,
    message: err.message,
    ...(field ? { details: [{ path: [field], message: err.message }] } : {}),
  })
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
        // `unit`: an extra code that sells in its own unit (the carton's code).
        if (result.status === 'found') {
          return reply.send(
            result.unit
              ? { product: result.product, unit: result.unit }
              : { product: result.product },
          )
        }
        if (result.status === 'ambiguous') {
          return reply.code(409).send({
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

  // ─── Extra barcodes of a product (docs/product-barcodes-migration.sql) ───
  const barcodeBody = z.object({
    barcode: z.string().trim().min(1).max(128),
    // A unit the product model knows. Not «custom»: that carries a free label
    // and no conversion, so «this code sells a custom» would mean nothing.
    unit: unitSchema.exclude(['custom']).nullable().optional(),
  })
  const barcodeFailure = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof ConflictError && err.message === 'BARCODE_TAKEN') {
      return reply.code(409).send({
        error: 'BARCODE_TAKEN',
        code: 'BARCODE_TAKEN',
        message: 'BARCODE_TAKEN',
        details: [{ path: ['barcode'], message: 'BARCODE_TAKEN' }],
      })
    }
    if (err instanceof ConflictError) {
      return reply.code(409).send({ error: err.message, code: err.message })
    }
    if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message })
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  fastify.get(
    '/api/products/:id/barcodes',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send({ barcodes: await productService.listBarcodes(request.tenancy, id) })
      } catch (err) {
        return barcodeFailure(reply, err, 'Failed to read barcodes')
      }
    },
  )

  fastify.post(
    '/api/products/:id/barcodes',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = barcodeBody.parse(request.body)
        const created = await productService.addBarcode(request.tenancy, id, body)
        await clearCache(`products:${request.tenancy.workspaceId}:*`)
        return reply.code(201).send(created)
      } catch (err) {
        return barcodeFailure(reply, err, 'Failed to add the barcode')
      }
    },
  )

  fastify.delete(
    '/api/products/:id/barcodes/:barcodeId',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, barcodeId } = request.params as { id: string; barcodeId: string }
        await productService.removeBarcode(request.tenancy, id, barcodeId)
        await clearCache(`products:${request.tenancy.workspaceId}:*`)
        return reply.code(204).send()
      } catch (err) {
        return barcodeFailure(reply, err, 'Failed to remove the barcode')
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

        // Opening stock moves the stock figures and their value: every cached
        // view of them goes (money-cache.ts owns the key shapes).
        await invalidateMoneyCaches(workspaceId)

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
        if (err instanceof ValidationError) return sendRefusal(reply, err)
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

        // ⚠️ `product:<ws>:<id>` matched NOTHING: the middleware keys the page
        // as `product:<ws>:/api/products/<id>`, so after a stock edit the
        // product page served the old quantity for two minutes. The one place
        // that knows the key shapes clears them (BUG-008, BUG-080).
        await invalidateMoneyCaches(workspaceId)

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
        // A rule refused the edit (which warehouse, a bad quantity): a 400
        // with its reason — it used to fall through to a bare 500.
        if (err instanceof ValidationError) return sendRefusal(reply, err)
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

        // Same as an edit: the hand-built `product:<ws>:<id>` matched nothing.
        await invalidateMoneyCaches(workspaceId)

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
