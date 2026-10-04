// ============================================
// backend/src/routes/compensation.routes.ts
//
// Capability #81 — what undoing an action will do, asked BEFORE it is done.
//
// `GET /api/compensation?route=DELETE /invoices/:id` answers with the plan for
// that command: whether it can be undone, whether the books are touched, and
// whether a person has to step in. The screen shows it in the confirmation,
// next to the button — telling someone afterwards is not a disclosure.
//
// Read-only and the same for every workspace: it describes what the product's
// own commands do, not anybody's data.
// ============================================

import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { compensationForRoute, requiresWarning } from '../services/workflow/compensation.service'

export async function compensationRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/compensation',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply) => {
      const parsed = z.object({ route: z.string().min(3).max(120) }).safeParse(request.query)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Bad Request', message: 'route is required' })
      }
      const plan = compensationForRoute(parsed.data.route)
      // ⚠️ An unknown route is `plan: null` WITH `warn: true` — never a default
      // plan. «We do not know what undoing this does» has to reach the person
      // about to do it.
      return reply.send({
        route: parsed.data.route,
        plan: plan
          ? {
              kind: plan.kind,
              strategy: plan.strategy,
              touchesBooks: plan.touchesBooks,
              needsHuman: plan.needsHuman,
            }
          : null,
        warn: requiresWarning(plan),
      })
    },
  )
}
