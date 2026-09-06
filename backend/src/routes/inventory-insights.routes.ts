// ============================================
// backend/src/routes/inventory-insights.routes.ts
//
// L3 + L4 — what to reorder, and what is not moving.
//
// Both are READ MODELS. Neither writes anything, and L3 explicitly creates no
// purchase order — the spec calls for a suggestion, not automation.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { ReorderService } from '../services/inventory/reorder.service'

export async function inventoryInsightsRoutes(fastify: FastifyInstance) {
  const reorderService = new ReorderService()

  // ─── L3 — GET /api/inventory/reorder-suggestions ────────
  //
  // Nothing is ordered. `/purchasing` has no create form anyway (open gap 11),
  // so this returns a list a person acts on.
  fastify.get(
    '/api/inventory/reorder-suggestions',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await reorderService.suggestions(request.tenancy))
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to compute reorder suggestions' })
      }
    },
  )

  // ─── L4 — GET /api/inventory/dead-stock?days=90 ─────────
  //
  // `days` is a QUERY PARAMETER, never a setting: a greengrocer and a machine-
  // parts dealer mean different things by «dead», and neither has told the
  // product which it is (G4).
  fastify.get(
    '/api/inventory/dead-stock',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { days } = request.query as { days?: string }
        const parsed = Number(days)
        // Clamped. A negative or absurd window is a typo, and answering it
        // with «everything is dead» is worse than answering the default.
        const window = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 3650) : undefined
        return reply.send(await reorderService.deadStock(request.tenancy, window))
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to compute dead stock' })
      }
    },
  )
}

export default inventoryInsightsRoutes
