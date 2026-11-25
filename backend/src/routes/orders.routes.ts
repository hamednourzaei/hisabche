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
import {
  ORDER_STATUSES,
  computeServiceChargeAndTip,
  orderConfirmSchema,
  orderCreateSchema,
  orderDeliveryCreateSchema,
  poolTipsEqually,
  splitTableBill,
  storefrontSettingsSchema,
} from '@hisabche/validation'

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
        const opts = orderConfirmSchema.parse(request.body ?? {})
        return reply.send(await orders.confirm(request.tenancy, id, opts))
      }),
    )

    fastify.post(
      '/api/orders/:id/accept-quote',
      { preHandler: write },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        const opts = orderConfirmSchema.parse(request.body ?? {})
        return reply.send(await orders.acceptQuote(request.tenancy, id, opts))
      }),
    )

    fastify.post(
      '/api/orders/:id/deliver',
      { preHandler: write },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        const body = orderDeliveryCreateSchema.parse(request.body)
        return reply.send(await orders.deliverPartial(request.tenancy, id, body))
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

    // G04 / G05 / G06: Table-service bill summary, service charge, tip pool, and seat split
    fastify.post(
      '/api/orders/table-service/bill-summary',
      { preHandler: read },
      handle(async (request, reply) => {
        const body = z
          .object({
            subtotalMinor: z.number().int().min(0),
            serviceChargeBps: z.number().int().min(0).max(5000).default(0),
            tipMinor: z.number().int().min(0).default(0),
            staffIds: z.array(z.string().min(1)).optional(),
            seatAmountsMinor: z.array(z.number().int().min(0)).optional(),
          })
          .strict()
          .parse(request.body)
        const summary = computeServiceChargeAndTip(
          body.subtotalMinor,
          body.serviceChargeBps,
          body.tipMinor,
        )
        const tipPool = body.staffIds ? poolTipsEqually(summary.tipMinor, body.staffIds) : null
        let seatSplit: number[] | null = null
        if (body.seatAmountsMinor) {
          seatSplit = splitTableBill(summary.grandTotalMinor, body.seatAmountsMinor)
          if (!seatSplit) {
            return reply.code(422).send({
              error: 'SEAT_SPLIT_MISMATCH',
              code: 'SEAT_SPLIT_MISMATCH',
            })
          }
        }
        return reply.send({
          data: {
            subtotalMinor: body.subtotalMinor,
            ...summary,
            tipPool,
            seatSplit,
          },
        })
      }),
    )

    // G03: Layaway / reserve-with-deposit schedule on the shared sales-order core
    fastify.post(
      '/api/orders/layaway',
      { preHandler: write },
      handle(async (request, reply) => {
        const body = z
          .object({
            orderId: z.string().uuid().optional(),
            totalMinor: z.number().int().min(1),
            depositMinor: z.number().int().min(1),
            installmentCount: z.number().int().min(1).max(36).default(3),
            currency: z.string().trim().min(3).max(3),
          })
          .strict()
          .parse(request.body)
        if (body.depositMinor > body.totalMinor) {
          return reply.code(422).send({
            error: 'DEPOSIT_EXCEEDS_TOTAL',
            code: 'DEPOSIT_EXCEEDS_TOTAL',
          })
        }
        const remainingMinor = body.totalMinor - body.depositMinor
        const baseInstallment = Math.floor(remainingMinor / body.installmentCount)
        const remainder = remainingMinor % body.installmentCount
        const installments = Array.from({ length: body.installmentCount }, (_, index) => ({
          sequence: index + 1,
          amountMinor: baseInstallment + (index === 0 ? remainder : 0),
        }))
        return reply.code(201).send({
          data: {
            mode: 'layaway',
            orderId: body.orderId ?? null,
            currency: body.currency.toUpperCase(),
            totalMinor: body.totalMinor,
            depositMinor: body.depositMinor,
            remainingMinor,
            installments,
          },
        })
      }),
    )
  }
}

export const ordersRoutes = buildOrdersRoutes(ordersService)
