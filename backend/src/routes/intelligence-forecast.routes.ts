// ============================================
// backend/src/routes/intelligence-forecast.routes.ts
//
// N3 — cash forecast. N4 — opportunities that have gone quiet.
//
// Both READ ONLY. N3 in particular stores nothing: a persisted forecast
// becomes a number people reconcile against.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { ForecastService } from '../services/intelligence/forecast.service'

export async function intelligenceForecastRoutes(fastify: FastifyInstance) {
  const service = new ForecastService()

  // ─── N3 — GET /api/intelligence/cash-forecast ───────────
  fastify.get(
    '/api/intelligence/cash-forecast',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        // A cash forecast is a financial report and is gated like one.
        requireCapability('report.financial.read'),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await service.cashForecast(request.tenancy))
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to compute the cash forecast' })
      }
    },
  )

  // ─── N4 — GET /api/intelligence/stale-opportunities?days=14 ───
  fastify.get(
    '/api/intelligence/stale-opportunities',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('customer.read')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { days } = request.query as { days?: string }
        const parsed = Number(days)
        const window = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 3650) : undefined
        return reply.send(await service.staleOpportunities(request.tenancy, window))
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to read stale opportunities' })
      }
    },
  )
}

export default intelligenceForecastRoutes
