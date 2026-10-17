// ============================================
// backend/src/routes/warehouse-map.routes.ts
//
// THE MAP OF A WAREHOUSE — «کالاها کجای انبار من هستند؟»
//
//   GET   /api/warehouses/:id/map          what is where, and how it moves
//   POST  /api/warehouses/:id/locations    put a shelf on the plan
//   PATCH /api/storage-locations/:id       rename, move or retire it
//   POST  /api/storage-locations/:id/place what a person recorded as sitting there
//
// ⚠️ TWO CAPABILITIES, AND THEY ARE DIFFERENT JOBS
//
//   inventory.read        reading the map — the same gate as the warehouse page
//   inventory.configure   deciding the PHYSICAL LAYOUT (owner-only, the same
//                         gate as «what a product's units mean»): where the
//                         racks are and what a location's code is
//   product.write         recording that goods are ON a shelf — a stock write,
//                         the same gate as assigning or transferring stock
//
// The server holds all three. The screen mirrors them so nobody is offered a
// button that will be refused.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import {
  createStorageLocationSchema,
  placeStorageLocationSchema,
  updateStorageLocationSchema,
} from '@hisabche/validation'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { DEAD_STOCK_DEFAULT_DAYS } from '../services/inventory/reorder.domain'
import {
  MAP_MAX_DAYS,
  MAP_MIN_DAYS,
  WarehouseMapService,
} from '../services/inventory/warehouse-map.service'

export async function warehouseMapRoutes(fastify: FastifyInstance) {
  const service = new WarehouseMapService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.message, code: err.message })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  const querySchema = z.object({
    days: z.coerce
      .number()
      .int()
      .min(MAP_MIN_DAYS)
      .max(MAP_MAX_DAYS)
      .default(DEAD_STOCK_DEFAULT_DAYS),
  })
  const idSchema = z.object({ id: z.string().uuid() })

  fastify.get(
    '/api/warehouses/:id/map',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = idSchema.parse(request.params)
        const { days } = querySchema.parse(request.query)
        return reply.send(await service.map(request.tenancy, id, days))
      } catch (err) {
        return fail(reply, err, 'Failed to build the warehouse map')
      }
    },
  )

  // Where one product sits, shelf by shelf (the product page).
  fastify.get(
    '/api/products/:id/storage-locations',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = idSchema.parse(request.params)
        return reply.send(await service.productLocations(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to read where the product is placed')
      }
    },
  )

  fastify.post(
    '/api/warehouses/:id/locations',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.configure')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = idSchema.parse(request.params)
        const body = createStorageLocationSchema.parse(request.body)
        return reply.code(201).send(await service.addLocation(request.tenancy, id, body))
      } catch (err) {
        return fail(reply, err, 'Failed to add the location')
      }
    },
  )

  fastify.patch(
    '/api/storage-locations/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.configure')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = idSchema.parse(request.params)
        const body = updateStorageLocationSchema.parse(request.body)
        return reply.send(await service.updateLocation(request.tenancy, id, body))
      } catch (err) {
        return fail(reply, err, 'Failed to save the location')
      }
    },
  )

  fastify.post(
    '/api/storage-locations/:id/place',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('product.write')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = idSchema.parse(request.params)
        const body = placeStorageLocationSchema.parse(request.body)
        return reply.send(await service.placeStock(request.tenancy, id, body))
      } catch (err) {
        return fail(reply, err, 'Failed to record what is in the location')
      }
    },
  )
}

export default warehouseMapRoutes
