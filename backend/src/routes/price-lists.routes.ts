// ============================================
// backend/src/routes/price-lists.routes.ts
//
// Capability #19 — price lists.
//
//   GET    /api/price-lists                              invoice.read
//   GET    /api/price-lists/:id                          invoice.read
//   GET    /api/price-lists/for-customer/:customerId     invoice.read  (a seller prices lines)
//   POST   /api/price-lists                              manager and up
//   PATCH  /api/price-lists/:id/active                   manager and up  { isActive }
//   PUT    /api/price-lists/:id/items                    manager and up  { items }
//   PUT    /api/price-lists/customers/:customerId        manager and up  { priceListId | null }
//
// Deciding what a customer pays is a manager's decision; applying it is not.
// There is no DELETE: a list, and a price on it, is retired.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { priceListService } from '../services/commerce/price-list.service'
import { requireRole } from '../services/tenancy.service'

const READ = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
const idParams = z.object({ id: z.string().uuid() })
const customerParams = z.object({ customerId: z.string().uuid() })

function fail(fastify: FastifyInstance, reply: FastifyReply, err: unknown, fallback: string) {
  if (err instanceof z.ZodError) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: err.errors[0]?.message ?? 'Validation failed',
      details: err.errors.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
  }
  if (err instanceof BaseError && (err.statusCode < 500 || err.statusCode === 503)) {
    return reply.code(err.statusCode).send({ error: err.name, message: err.message })
  }
  fastify.log.error(err)
  return reply.code(500).send({ error: 'Internal Server Error', message: fallback })
}

export async function priceListRoutes(fastify: FastifyInstance) {
  fastify.get('/api/price-lists', { preHandler: READ }, async (request: FastifyRequest, reply) => {
    try {
      return reply.send({ priceLists: await priceListService.list(request.tenancy) })
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to read price lists')
    }
  })

  fastify.get(
    '/api/price-lists/for-customer/:customerId',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { customerId } = customerParams.parse(request.params)
        return reply.send({
          priceList: await priceListService.forCustomer(request.tenancy, customerId),
        })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read the customer price list')
      }
    },
  )

  fastify.get(
    '/api/price-lists/:id',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        return reply.send(await priceListService.detail(request.tenancy, id))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read the price list')
      }
    },
  )

  fastify.post('/api/price-lists', { preHandler: READ }, async (request: FastifyRequest, reply) => {
    try {
      requireRole(request.tenancy, 'manager')
      return reply.code(201).send(await priceListService.create(request.tenancy, request.body))
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to save the price list')
    }
  })

  fastify.patch(
    '/api/price-lists/:id/active',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        const { isActive } = z.object({ isActive: z.boolean() }).parse(request.body)
        return reply.send(await priceListService.setActive(request.tenancy, id, isActive))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to update the price list')
      }
    },
  )

  fastify.put(
    '/api/price-lists/:id/items',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        return reply.send(await priceListService.setItems(request.tenancy, id, request.body))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to save the prices')
      }
    },
  )

  fastify.put(
    '/api/price-lists/customers/:customerId',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { customerId } = customerParams.parse(request.params)
        const { priceListId } = z
          .object({ priceListId: z.string().uuid().nullable() })
          .parse(request.body)
        return reply.send(
          await priceListService.assignCustomer(request.tenancy, customerId, priceListId),
        )
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to set the customer price list')
      }
    },
  )
}
