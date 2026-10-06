// ============================================
// backend/src/routes/warehouse.routes.ts
// FIXED: listwarehouses → listWarehouses
// ============================================

import { sendFailure } from '../errors/http-failure'
import { IdempotencyUnavailableError, readClientRequestId } from '../utils/client-request'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createwarehouseSchema,
  updatewarehouseSchema,
  stockTransferSchema,
} from '@hisabche/validation'
import { WarehouseService } from '../services/warehouse.service'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { BaseError } from '../errors/base.error'
import { invalidateMoneyCaches } from '../utils/money-cache'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function warehouseRoutes(fastify: FastifyInstance) {
  const warehouseService = new WarehouseService()

  // ─── GET /api/warehouses ──────────────────────────────────────
  fastify.get(
    '/api/warehouses',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'warehouses' }),
      ],
      schema: {
        response: {
          200: toJsonSchema(z.array(z.any())),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // ✅ FIX: listwarehouses → listWarehouses
        const warehouses = await warehouseService.listWarehouses(request.tenancy)
        return reply.send(warehouses)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch warehouses' })
      }
    },
  )

  // ─── POST /api/warehouses ─────────────────────────────────────
  fastify.post(
    '/api/warehouses',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        body: toJsonSchema(createwarehouseSchema),
        response: {
          201: toJsonSchema(z.any()),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createwarehouseSchema.parse(request.body)
        const warehouse = await warehouseService.createWarehouse(request.tenancy, data)
        await clearCache('warehouses:*')
        return reply.code(201).send(warehouse)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to create warehouse' })
      }
    },
  )

  // ─── PATCH /api/warehouses/:id ───────────────────────────────
  fastify.patch(
    '/api/warehouses/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updatewarehouseSchema),
        response: {
          200: toJsonSchema(z.any()),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const data = updatewarehouseSchema.parse(request.body)
        const warehouse = await warehouseService.updateWarehouse(request.tenancy, id, data)
        await clearCache(`warehouse:${id}`)
        await clearCache('warehouses:*')
        return reply.send(warehouse)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to update warehouse' })
      }
    },
  )

  // ─── DELETE /api/warehouses/:id ──────────────────────────────
  fastify.delete(
    '/api/warehouses/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        await warehouseService.deleteWarehouse(request.tenancy, id)
        await clearCache(`warehouse:${id}`)
        await clearCache('warehouses:*')
        return reply.code(204).send()
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to delete warehouse' })
      }
    },
  )

  // ─── POST /api/stock-transfers ───────────────────────────────
  fastify.post(
    '/api/stock-transfers',
    {
      // Moving goods is a stock write, like assigning them — it asked only for
      // membership.
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('product.write')],
      schema: {
        body: toJsonSchema(stockTransferSchema),
        response: {
          200: toJsonSchema(z.any()),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = stockTransferSchema.parse(request.body)
        const result = await warehouseService.transferStock(request.tenancy, data, {
          idempotencyKey: readClientRequestId(request),
        })
        await clearCache('warehouses:*')
        await clearCache('stock:*')
        return reply.send(result)
      } catch (err) {
        if (err instanceof IdempotencyUnavailableError) {
          return reply.code(503).send({ error: err.message, code: err.code })
        }
        // «Not enough stock» is a 409 and a bad warehouse a 400 — they were
        // all answered as a bare 500.
        return sendFailure(reply, fastify.log, err, 'Failed to transfer stock')
      }
    },
  )

  // ─── Multi-warehouse (request #90) ───────────────────────────
  // Not cached: stock figures change with every invoice.
  const failWarehouse = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.message, code: err.message })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  fastify.get(
    '/api/warehouses/overview',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await warehouseService.overview(request.tenancy))
      } catch (err) {
        return failWarehouse(reply, err, 'Failed to build the warehouse overview')
      }
    },
  )

  fastify.get(
    '/api/warehouses/:id/detail',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z
          .object({ id: z.union([z.string().uuid(), z.literal('unassigned')]) })
          .parse(request.params)
        return reply.send(await warehouseService.warehouseDetail(request.tenancy, id))
      } catch (err) {
        return failWarehouse(reply, err, 'Failed to fetch the warehouse stock')
      }
    },
  )

  fastify.get(
    '/api/products/:id/warehouse-breakdown',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        return reply.send(await warehouseService.productBreakdown(request.tenancy, id))
      } catch (err) {
        return failWarehouse(reply, err, 'Failed to read where the product is')
      }
    },
  )

  fastify.post(
    '/api/warehouses/:id/assign',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('product.write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const body = z
          .object({
            productId: z.string().uuid(),
            quantity: z.number().positive(),
            notes: z.string().max(500).optional(),
          })
          .strict()
          .parse(request.body)
        const result = await warehouseService.assignStock(request.tenancy, id, body)
        await invalidateMoneyCaches(request.tenancy.workspaceId)
        return reply.send(result)
      } catch (err) {
        return failWarehouse(reply, err, 'Failed to assign stock to the warehouse')
      }
    },
  )

  // ─── GET /api/warehouses/:id/stock ───────────────────────────
  fastify.get(
    '/api/warehouses/:id/stock',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'warehouse-stock' }),
      ],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: {
          200: toJsonSchema(z.array(z.any())),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const stock = await warehouseService.getStockByWarehouse(request.tenancy, id)
        return reply.send(stock)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch stock' })
      }
    },
  )
}

export default warehouseRoutes
