// ============================================
// backend/src/routes/metal-rates.routes.ts
//
// Fastify Routes for Metal Rates, Gold Rate Board, Second-Hand Gold KYC
// Purchase, Melt/Scrap Movements, and Showcase/Safe Weight Reconciliations.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  goldMeltScrapRequestSchema,
  goldReconcileLocationRequestSchema,
  metalRateRecordSchema,
  secondHandGoldPurchaseRequestSchema,
} from '@hisabche/validation'
import { sendFailure } from '../errors/http-failure'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { MetalRatesService } from '../services/pricing/metal-rates.service'
import { readClientRequestId } from '../utils/client-request'

export async function metalRatesRoutes(fastify: FastifyInstance) {
  const service = new MetalRatesService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]
  // The rate board prices every gold piece: changing it is a price change
  // (product.write, manager), not a sale. Melt/scrap and a counted weight move
  // stock value, so they need stock.adjust. A seller still buys second-hand gold.
  const setPrice = [authenticate, requireWorkspaceContext, requireCapability('product.write')]
  const adjustStock = [authenticate, requireWorkspaceContext, requireCapability('stock.adjust')]

  const handle =
    (what: string, run: (request: FastifyRequest) => Promise<unknown>, status = 200) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.code(status).send({ data: await run(request) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, what)
      }
    }

  fastify.get(
    '/api/metal-rates/latest',
    { preHandler: read },
    handle('Failed to read latest metal rate', (r) =>
      service.getLatestMetalRate(r.tenancy.workspaceId),
    ),
  )

  fastify.get(
    '/api/metal-rates',
    { preHandler: read },
    handle('Failed to read metal rate history', (r) =>
      service.listMetalRates(r.tenancy.workspaceId),
    ),
  )

  fastify.post(
    '/api/metal-rates',
    { preHandler: setPrice },
    handle(
      'Failed to record metal rate',
      (r) => {
        const parsed = metalRateRecordSchema.parse(r.body)
        return service.recordMetalRate(r.tenancy.workspaceId, {
          rateDate: parsed.rateDate,
          rate24kMinorPerGram: parsed.rate24kMinorPerGram,
          setBy: r.tenancy.userId,
        })
      },
      201,
    ),
  )

  fastify.get(
    '/api/gold/operations',
    { preHandler: read },
    handle('Failed to list gold operations', (r) => service.listGoldOperations(r.tenancy)),
  )

  fastify.post(
    '/api/gold/second-hand-purchase',
    { preHandler: write },
    handle(
      'Failed to record second-hand gold purchase',
      (r) =>
        service.recordSecondHandPurchase(
          r.tenancy,
          secondHandGoldPurchaseRequestSchema.parse(r.body),
          readClientRequestId(r),
        ),
      201,
    ),
  )

  fastify.post(
    '/api/gold/melt-scrap',
    { preHandler: adjustStock },
    handle(
      'Failed to record gold melt/scrap movement',
      (r) =>
        service.recordMeltScrap(
          r.tenancy,
          goldMeltScrapRequestSchema.parse(r.body),
          readClientRequestId(r),
        ),
      201,
    ),
  )

  fastify.get(
    '/api/gold/reconciliations',
    { preHandler: read },
    handle('Failed to list gold location reconciliations', (r) =>
      service.listGoldReconciliations(r.tenancy),
    ),
  )

  fastify.post(
    '/api/gold/reconciliations',
    { preHandler: adjustStock },
    handle(
      'Failed to record gold location reconciliation',
      (r) =>
        service.reconcileLocation(
          r.tenancy,
          goldReconcileLocationRequestSchema.parse(r.body),
          readClientRequestId(r),
        ),
      201,
    ),
  )
}
