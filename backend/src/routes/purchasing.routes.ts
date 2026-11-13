// ============================================
// backend/src/routes/purchasing.routes.ts
// ============================================

import { sendFailure } from '../errors/http-failure'
import { IdempotencyUnavailableError, readClientRequestId } from '../utils/client-request'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  createDraftFromSuggestionsSchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
} from '@hisabche/validation'
import PurchasingService from '../services/purchasing.service'
import { ConflictError, NotFoundError } from '../errors/database.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'
import { toJsonSchema } from '../utils/json-schema'

export async function purchasingRoutes(fastify: FastifyInstance) {
  const purchasingService = new PurchasingService()

  // ─── GET /api/purchase-orders ────────────────────────────
  fastify.get(
    '/api/purchase-orders',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'purchase-orders' }),
      ],
      schema: {
        response: {
          200: toJsonSchema(z.array(z.any())),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const orders = await purchasingService.listPurchaseOrders(request.tenancy)
        return reply.send(orders)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch purchase orders' })
      }
    },
  )

  // ─── GET /api/purchase-orders/:id ────────────────────────
  //
  // `getPurchaseOrder` existed in the service from the start; only the door was
  // missing, so `usePurchaseOrder(id)` 404'd and no purchase order could be
  // opened. Listed in KNOWN_MISSING until now.
  fastify.get(
    '/api/purchase-orders/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await purchasingService.getPurchaseOrder(id, request.tenancy))
      } catch (err) {
        fastify.log.error(err)
        // NotFound carries its own status; anything else is ours.
        const status = (err as { statusCode?: number })?.statusCode ?? 500
        return reply.code(status).send({ error: 'Failed to fetch the purchase order' })
      }
    },
  )

  // ─── POST /api/purchase-orders ───────────────────────────
  fastify.post(
    '/api/purchase-orders',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('purchase.write')],
      schema: {
        body: toJsonSchema(createPurchaseOrderSchema),
        response: {
          201: toJsonSchema(z.any()),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createPurchaseOrderSchema.parse(request.body)
        const order = await purchasingService.createPurchaseOrder(request.tenancy, data, {
          idempotencyKey: readClientRequestId(request),
        })
        await clearCache('purchase-orders:*')
        // A replay answers 200 with the first order, not a second 201.
        const replayed = (order as { idempotentReplay?: boolean }).idempotentReplay === true
        return reply.code(replayed ? 200 : 201).send(order)
      } catch (err) {
        if (err instanceof IdempotencyUnavailableError) {
          return reply.code(503).send({ error: err.message, code: err.code })
        }
        // BUDGET_EXCEEDED / BUDGET_APPROVAL_REQUIRED are 400s, not 500s.
        return sendFailure(reply, fastify.log, err, 'Failed to create purchase order')
      }
    },
  )

  // ─── PATCH /api/purchase-orders/:id ──────────────────────
  fastify.patch(
    '/api/purchase-orders/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('purchase.write')],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updatePurchaseOrderSchema),
        response: {
          200: toJsonSchema(z.any()),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const data = updatePurchaseOrderSchema.parse(request.body)
        const order = await purchasingService.updatePurchaseOrder(request.tenancy, id, data)
        await clearCache(`purchase-order:${id}`)
        await clearCache('purchase-orders:*')
        return reply.send(order)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        if (err instanceof ConflictError) return reply.code(409).send({ error: err.message })
        if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message })
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to update purchase order' })
      }
    },
  )

  // ─── POST /api/purchase-orders/:id/receive ──────────────
  fastify.post(
    '/api/purchase-orders/:id/receive',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('purchase.receive')],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: {
          200: toJsonSchema(z.any()),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = z
          .object({
            lines: z
              .array(z.object({ itemId: z.string().uuid(), quantity: z.number().positive() }))
              .optional(),
          })
          .optional()
          .parse(request.body ?? {})
        const result = await purchasingService.receiveGoods(
          request.tenancy,
          id,
          body?.lines ? { lines: body.lines } : undefined,
        )
        await clearCache(`purchase-order:${id}`)
        await clearCache('purchase-orders:*')
        return reply.send(result)
      } catch (err) {
        // Already received / cancelled, or another request received it first.
        if (err instanceof ConflictError) return reply.code(409).send({ error: err.message })
        if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message })
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to receive goods' })
      }
    },
  )

  // ─── POST /api/purchase-orders/from-suggestions ─────────
  fastify.post(
    '/api/purchase-orders/from-suggestions',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('purchase.write')],
      schema: {
        body: toJsonSchema(createDraftFromSuggestionsSchema),
        response: {
          201: toJsonSchema(z.any()),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createDraftFromSuggestionsSchema.parse(request.body)
        const result = await purchasingService.createDraftPurchaseOrdersFromSuggestions(
          request.tenancy,
          body,
          { idempotencyKey: readClientRequestId(request) },
        )
        await clearCache('purchase-orders:*')
        return reply.code(201).send(result)
      } catch (err) {
        if (err instanceof IdempotencyUnavailableError) {
          return reply.code(503).send({ error: err.message, code: err.code })
        }
        return sendFailure(
          reply,
          fastify.log,
          err,
          'Failed to draft purchase orders from suggestions',
        )
      }
    },
  )

  // ─── GET /api/purchase-orders/:id/three-way-match ───────
  fastify.get(
    '/api/purchase-orders/:id/three-way-match',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        querystring: toJsonSchema(z.object({ invoiceId: z.string().uuid().optional() })),
        response: {
          200: toJsonSchema(z.any()),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const { invoiceId } = (request.query ?? {}) as { invoiceId?: string }
        const result = await purchasingService.evaluateThreeWayMatchForPo(
          request.tenancy,
          id,
          invoiceId,
        )
        return reply.send(result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to evaluate three-way match')
      }
    },
  )

  // ─── GET /api/suppliers/scorecard ───────────────────────
  fastify.get(
    '/api/suppliers/scorecard',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        response: {
          200: toJsonSchema(z.array(z.any())),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const scorecard = await purchasingService.getSupplierScorecard(request.tenancy)
        return reply.send(scorecard)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to compute supplier scorecard')
      }
    },
  )

  // V61 B.2.13 & B.2.14 — RFQs, supplier quotations, long-term purchase contract prices
  fastify.get(
    '/api/rfqs',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { rfqContractsService } = await import('../services/purchasing/rfq-contracts.service')
        return reply.send({ data: await rfqContractsService.listRfqs(request.tenancy) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to list RFQs')
      }
    },
  )

  fastify.post(
    '/api/rfqs',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('purchase.write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { createRfqSchema } = await import('@hisabche/validation')
        const body = createRfqSchema.parse(request.body)
        const { rfqContractsService } = await import('../services/purchasing/rfq-contracts.service')
        return reply.code(201).send({
          data: await rfqContractsService.createRfq(request.tenancy, body.title),
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create RFQ')
      }
    },
  )

  fastify.post(
    '/api/rfqs/:id/quotations',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('purchase.write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const { createQuotationSchema } = await import('@hisabche/validation')
        const body = createQuotationSchema.parse(request.body)
        const { rfqContractsService } = await import('../services/purchasing/rfq-contracts.service')
        return reply.code(201).send({
          data: await rfqContractsService.addQuotation(request.tenancy, id, body),
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to submit quotation')
      }
    },
  )

  fastify.post(
    '/api/quotations/:id/choose',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('purchase.write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const { rfqContractsService } = await import('../services/purchasing/rfq-contracts.service')
        const { businessDayOf } = await import('../utils/local-day')
        // The business's own day — a quotation valid «until today» is still
        // valid at 23:00 in Kabul, which is already tomorrow in UTC.
        const businessDay = businessDayOf(new Date(), request.tenancy.timeZone)
        return reply.send({
          data: await rfqContractsService.chooseQuotation(request.tenancy, id, businessDay),
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to convert quotation to PO')
      }
    },
  )

  fastify.get(
    '/api/purchase-contracts/prices',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { supplierId } = request.query as { supplierId?: string }
        const { rfqContractsService } = await import('../services/purchasing/rfq-contracts.service')
        return reply.send({
          data: await rfqContractsService.listPurchaseContractPrices(request.tenancy, supplierId),
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to list contract prices')
      }
    },
  )

  fastify.post(
    '/api/purchase-contracts/prices',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('purchase.write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { createPurchaseContractPriceSchema } = await import('@hisabche/validation')
        const body = createPurchaseContractPriceSchema.parse(request.body)
        const { rfqContractsService } = await import('../services/purchasing/rfq-contracts.service')
        return reply.code(201).send({
          data: await rfqContractsService.upsertPurchaseContractPrice(request.tenancy, body),
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to save contract price')
      }
    },
  )
}
