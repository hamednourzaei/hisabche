// ============================================
// backend/src/routes/inventory-costing.routes.ts
//
// Registered with prefix '/api/inventory' in index.ts.
//
// These routes READ the costing core and configure it. None of them moves
// stock: goods move because a document moved them, so receipts and issues
// arrive through the sales and purchase paths, never through an endpoint of
// their own. An HTTP call that could consume a cost layer on its own would be
// a way to change reported profit without a document behind it.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { CostingService } from '../services/inventory-costing'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { cacheMiddleware } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

const settingsSchema = z.object({
  costingMethod: z.enum(['fifo', 'avco', 'standard']).optional(),
  negativeStock: z.enum(['block', 'allow']).optional(),
})

const previewQuerySchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  warehouseId: z.string().uuid().optional(),
})

export async function inventoryCostingRoutes(fastify: FastifyInstance) {
  const costingService = new CostingService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      const code = /^[A-Z][A-Z_]{6,}/.exec(err.message)?.[0]
      return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  // ─── GET /valuation ────────────────────────────────────
  // Σ(remaining × unit cost). This is the number the stock account in the
  // ledger must agree with — `quantity × buy_price` never did.
  fastify.get(
    '/valuation',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        // Valuation IS the cost of stock. A seller sells at the sell price and
        // has no reason to see what the shop paid.
        requireCapability('inventory.cost.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'inventory-valuation' }),
      ],
      schema: {
        querystring: toJsonSchema(z.object({ productId: z.string().uuid().optional() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { productId } = request.query as { productId?: string }
        return reply.send(await costingService.getValuation(request.tenancy, productId))
      } catch (err) {
        return fail(reply, err, 'Failed to value inventory')
      }
    },
  )

  // ─── GET /layers/:productId ────────────────────────────
  fastify.get(
    '/layers/:productId',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.cost.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { productId } = request.params as { productId: string }
        const { warehouseId } = request.query as { warehouseId?: string }
        return reply.send(await costingService.getLayers(request.tenancy, productId, warehouseId))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch cost layers')
      }
    },
  )

  // ─── GET /cost-trail/:consumerType/:consumerId ─────────
  // Why the profit on this document is what it is: which purchases its goods
  // came from, at what price, and whether any of it was estimated.
  fastify.get(
    '/cost-trail/:consumerType/:consumerId',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.cost.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { consumerType, consumerId } = request.params as {
          consumerType: string
          consumerId: string
        }
        const { revenue } = request.query as { revenue?: string }

        return reply.send(
          await costingService.explainDocumentCost(
            request.tenancy,
            consumerType as 'invoice',
            consumerId,
            revenue === undefined ? undefined : Number(revenue),
          ),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to fetch the cost trail')
      }
    },
  )

  // ─── GET /cost-preview ─────────────────────────────────
  // What an issue WOULD cost. Reads only; it consumes nothing.
  fastify.get(
    '/cost-preview',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.cost.read')],
      schema: {
        querystring: toJsonSchema(previewQuerySchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { productId, quantity, warehouseId } = previewQuerySchema.parse(request.query)
        return reply.send(
          await costingService.previewIssueCost(request.tenancy, productId, quantity, warehouseId),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to preview cost')
      }
    },
  )

  // ─── GET/PUT /settings ─────────────────────────────────
  fastify.get(
    '/settings',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await costingService.getSettings(request.tenancy))
      } catch (err) {
        return fail(reply, err, 'Failed to read inventory settings')
      }
    },
  )

  fastify.put(
    '/settings',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.configure')],
      schema: {
        body: toJsonSchema(settingsSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = settingsSchema.parse(request.body)
        return reply.send(await costingService.setSettings(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to save inventory settings')
      }
    },
  )
}
