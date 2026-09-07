// ============================================
// backend/src/routes/units.routes.ts
//
// T2 — GET /api/units.
//
// Global reference data: `authenticate` but NOT `requireWorkspaceContext`.
// There is no workspace column on `units` to scope by, and demanding a
// workspace here would only be theatre — it would filter nothing. The auth
// check is what keeps the list off the open internet.
//
// Nothing here is per-tenant. The per-product conversion («1 carton = 24
// pieces») is workspace-scoped and lives behind the product-units routes.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { authenticate } from '../middleware/auth.middleware'
import { UnitsService } from '../services/inventory/units.service'

export async function unitsRoutes(fastify: FastifyInstance) {
  const service = new UnitsService()

  fastify.get(
    '/api/units',
    { preHandler: [authenticate] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { units, source } = await service.list()
        // `source` is reported rather than hidden: a client showing the seed
        // list because the migration has not been applied is a real state, and
        // silently serving it as if it came from the table is how the previous
        // hardcoded lists survived so long.
        return reply.send({ units, source })
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to load units' })
      }
    },
  )
}
