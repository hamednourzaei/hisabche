// ============================================
// backend/src/routes/inventory-insights.routes.ts
//
// L3 + L4 — what to reorder, and what is not moving.
//
// Both are READ MODELS. Neither writes anything, and L3 explicitly creates no
// purchase order — the spec calls for a suggestion, not automation.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  DRAFT_PURCHASE_LINE_INCOMPLETE,
  planDraftPurchaseOrders,
  type DraftPurchaseSuggestion,
} from '@hisabche/validation'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { ReorderService } from '../services/inventory/reorder.service'
import { PurchasingService } from '../services/purchasing.service'

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

  interface DraftPOBody {
    suggestions?: DraftPurchaseSuggestion[]
  }

  // ─── Option 17: POST /api/inventory/reorder-suggestions/draft-po ───
  // Creates draft POs grouped by supplier from suggestions. None are placed.
  fastify.post(
    '/api/inventory/reorder-suggestions/draft-po',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('purchase.write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = (request.body ?? {}) as DraftPOBody
        // A draft order needs a supplier and a price the owner chose. Neither is
        // guessed from the suggestion: the SAME rule the offline engine applies
        // (`planDraftPurchaseOrders`) refuses an unknown supplier or price.
        const plan = planDraftPurchaseOrders(body.suggestions ?? [])
        if (!plan.ok) {
          return reply.code(400).send({
            error:
              'Every line needs productId, supplierId, suggestedQuantity > 0 and unitPrice > 0',
            code: DRAFT_PURCHASE_LINE_INCOMPLETE,
            incomplete: plan.incomplete.map((line) => line.productId),
          })
        }

        const purchasingService = new PurchasingService()
        const draftPOs = []
        const orderDate = new Date().toISOString().slice(0, 10)

        for (const { supplierId, lines } of plan.groups) {
          const po = await purchasingService.createPurchaseOrder(request.tenancy, {
            supplierId,
            orderDate,
            // Canonical: a suggestion creates a DRAFT (owner decision PO), the same status the
            // offline engine writes. `pending` is for a real approval/wait step.
            status: 'draft',
            items: lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              totalPrice: line.quantity * line.unitPrice,
            })),
          })
          draftPOs.push(po)
        }

        return reply.code(201).send({ draftPOs, count: draftPOs.length })
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to create draft purchase orders' })
      }
    },
  )
}

export default inventoryInsightsRoutes
