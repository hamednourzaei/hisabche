// ============================================
// backend/src/routes/currencies.routes.ts
//
// PATCH 1 / L0.1 — GET /api/currencies.
//
// Global reference data: `authenticate` but NOT `requireWorkspaceContext`.
// `currencies` has no workspace column to scope by, and demanding a workspace
// would filter nothing — the same shape as `/api/units` (T2).
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { authenticate } from '../middleware/auth.middleware'
import { CurrenciesService } from '../services/currency/currencies.service'

export async function currenciesRoutes(fastify: FastifyInstance) {
  const service = new CurrenciesService()

  fastify.get(
    '/api/currencies',
    { preHandler: [authenticate] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        // ⚠️ ACTIVE ONLY. The table holds 162 currencies and the product can
        // format 25. Serving the rest would let someone pick a code with no
        // precision contract, which is a wrong amount rather than a missing
        // option — see the service header and rule 9.
        const { currencies, source } = await service.listActive()
        return reply.send({ currencies, source })
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to load currencies' })
      }
    },
  )
}
