// ============================================
// packages/local-engine/src/routes/tax.ts
//
// Offline tax calculation and preview for local engine.
// Uses shared @hisabche/validation pure tax domain.
// ============================================

import { computeDocument, roundMoney, type TaxComponent, type TaxRule } from '@hisabche/validation'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

export function registerTaxRoutes(router: Router) {
  // GET /tax/config
  router.get('/tax/config', async (ctx: RouteHandlerContext) => {
    return {
      settings: null,
      components: [],
      rules: [],
    }
  })

  // POST /tax/preview
  router.post('/tax/preview', async (ctx: RouteHandlerContext) => {
    const body = ctx.body as {
      date: string
      partyTaxCategory?: string | null
      lines: Array<{
        lineId: string
        productId?: string | null
        categoryId?: string | null
        quantity: number
        unitPrice: number
        discount?: number
      }>
    }

    const taxableLines = (body.lines ?? []).map((l) => ({
      lineId: l.lineId,
      quantity: l.quantity,
      unitPriceMinor: roundMoney(l.unitPrice),
      discountMinor: roundMoney(l.discount ?? 0),
      components: [] as TaxComponent[],
    }))

    const result = computeDocument(taxableLines)

    return {
      computed: result,
      snapshot: {
        components: [],
        rules: [],
        computedAt: new Date().toISOString(),
      },
    }
  })
}
