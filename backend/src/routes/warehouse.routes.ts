// ============================================
// backend/src/routes/warehouse.routes.ts
// FIXED: listwarehouses → listWarehouses
// ============================================

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
      preHandler: [authenticate, requireWorkspaceContext],
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
        const result = await warehouseService.transferStock(request.tenancy, data)
        await clearCache('warehouses:*')
        await clearCache('stock:*')
        return reply.send(result)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to transfer stock' })
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
