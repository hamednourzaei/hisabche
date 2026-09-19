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

import { z } from 'zod'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { BaseError } from '../errors/base.error'
import { UnitsService } from '../services/inventory/units.service'

export async function unitsRoutes(fastify: FastifyInstance) {
  const service = new UnitsService()

  fastify.get(
    '/api/units',
    // Reads request.tenancy for the workspace's own units, so it declares the
    // workspace guard (workspace-guard-order.test.ts).
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // The workspace's own units come too, when the request carries one.
        const { units, source } = await service.list(request.tenancy?.workspaceId)
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

  // ─── POST /api/units ───────────────────────────────────
  // A unit this business invented («مثقال»), with its conversion. Stored in
  // `custom_units`, scoped to the workspace — see
  // docs/patch-02-custom-units-migration.sql.
  fastify.post(
    '/api/units',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('product.write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = z
          .object({
            name: z.string().min(1).max(60),
            symbol: z.string().max(12).optional(),
            // The conversion is required: a unit that cannot be converted is a
            // quantity no report can add up. See the service.
            dimension: z.enum(['weight', 'length', 'volume', 'count']),
            conversionFactor: z.number().positive().max(1e9),
          })
          .strict()
          .parse(request.body)
        return reply
          .code(201)
          .send(await service.create(request.tenancy.workspaceId, request.tenancy.userId, body))
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        if (err instanceof BaseError && err.statusCode < 500) {
          return reply.code(err.statusCode).send({ error: err.message, code: err.message })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to create the unit' })
      }
    },
  )
}
