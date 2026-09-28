// ============================================
// backend/src/routes/orders.routes.ts
//
// Sales orders for members of the workspace — and for integrations with a
// secret API key (read:orders / write:orders, see API_ROUTE_SCOPES).
//
//   GET  /api/orders                     list (exact count per status filter)
//   GET  /api/orders/:id
//   POST /api/orders                     place (prices set by the database)
//   POST /api/orders/:id/confirm | cancel | fulfill
//   POST /api/orders/:id/invoice         confirmed → invoiced, via the invoice path
//   GET  /api/storefront/settings        PUT for workspace managers
//
// «paid» has no route: it follows the order's invoice (a database trigger).
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { ORDER_STATUSES, orderCreateSchema, storefrontSettingsSchema } from '@hisabche/validation'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { NotConfiguredError } from '../services/developer/developer.repository'
import { OrderError } from '../services/orders/orders.domain'
import { ordersService, type OrdersService } from '../services/orders/orders.service'
import { readClientRequestId } from '../utils/client-request'

const idParams = z.object({ id: z.string().uuid() })
const listQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
const cancelBody = z.object({ reason: z.string().trim().max(300).optional() }).strict()
const invoiceBody = z.object({ customerId: z.string().uuid().optional() }).strict()

export function buildOrdersRoutes(orders: OrdersService) {
  return async function ordersRoutes(fastify: FastifyInstance) {
    const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
    const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]
    const manage = [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')]

    const fail = (reply: FastifyReply, err: unknown) => {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      if (err instanceof OrderError)
        return reply.code(err.statusCode).send({ error: err.code, code: err.code })
      if (err instanceof NotConfiguredError) {
        return reply
          .code(503)
          .send({ error: 'ORDERS_NOT_CONFIGURED', code: 'ORDERS_NOT_CONFIGURED' })
      }
      const status = (err as { statusCode?: number }).statusCode
      if (typeof status === 'number' && status >= 400 && status < 500) {
        return reply
          .code(status)
          .send({ error: (err as Error).message, code: (err as { code?: string }).code })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Internal Server Error' })
    }

    const handle =
      (fn: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          return await fn(request, reply)
        } catch (err) {
          return fail(reply, err)
        }
      }

    fastify.get(
      '/api/orders',
      { preHandler: read },
      handle(async (request, reply) => {
        const query = listQuery.parse(request.query)
        const { rows, total } = await orders.list(request.tenancy, query)
        return reply.send({ data: rows, total, limit: query.limit, offset: query.offset })
      }),
    )

    fastify.get(
      '/api/orders/:id',
      { preHandler: read },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        return reply.send(await orders.get(request.tenancy, id))
      }),
    )

    fastify.post(
      '/api/orders',
      { preHandler: write },
      handle(async (request, reply) => {
        const body = orderCreateSchema.parse(request.body)
        const { order, replay } = await orders.placeFromMember(
          request.tenancy,
          { apiKeyId: request.apiKey?.id ?? null },
          readClientRequestId(request),
          body,
        )
        return reply.code(replay ? 200 : 201).send({ ...order, replay })
      }),
    )

    fastify.post(
      '/api/orders/:id/confirm',
      { preHandler: write },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        return reply.send(await orders.confirm(request.tenancy, id))
      }),
    )

    fastify.post(
      '/api/orders/:id/cancel',
      { preHandler: write },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        const { reason } = cancelBody.parse(request.body ?? {})
        return reply.send(await orders.cancel(request.tenancy, id, reason ?? null))
      }),
    )

    fastify.post(
      '/api/orders/:id/fulfill',
      { preHandler: write },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        return reply.send(await orders.fulfill(request.tenancy, id))
      }),
    )

    fastify.post(
      '/api/orders/:id/invoice',
      { preHandler: write },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        const { customerId } = invoiceBody.parse(request.body ?? {})
        return reply.send(await orders.invoice(request.tenancy, id, { customerId }))
      }),
    )

    fastify.get(
      '/api/storefront/settings',
      { preHandler: manage },
      handle(async (request, reply) =>
        reply.send(await orders.settings(request.tenancy.workspaceId)),
      ),
    )

    fastify.put(
      '/api/storefront/settings',
      { preHandler: manage },
      handle(async (request, reply) => {
        const settings = storefrontSettingsSchema.parse(request.body)
        return reply.send(await orders.saveSettings(request.tenancy, settings))
      }),
    )
  }
}

export const ordersRoutes = buildOrdersRoutes(ordersService)
