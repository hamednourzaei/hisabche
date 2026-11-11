// ============================================
// packages/validation/src/schemas/procurement-match.ts
//
// V60 Slice 10 — Procurement planning (P5), Three-Way Match & Supplier Scorecard.
//
// Pure domain rules extending:
//   - `draft-purchase-order.domain.ts` (`planDraftPurchaseOrders`)
//   - `supplier-intelligence.domain.ts` (`scoreSupplier`, `MIN_PURCHASES_FOR_A_SCORE`)
//
// Guarantees:
//   1. Reorder suggestions round UP to purchase pack/unit (`purchasePackSize`) and
//      produce a DRAFT purchase plan for human approval — never auto-ordered.
//   2. Three-way match compares PO line vs goods receipt vs supplier invoice by
//      `(productId, variantId)` quantity and unit price. Any mismatch is returned
//      explicitly and blocks payment approval (`mayApprovePayment: false`), never
//      silently adjusted.
//   3. Supplier scorecard delegates scoring to `scoreSupplier()` from
//      `supplier-intelligence.domain.ts` (keeping one scale across the repo).
// ============================================

import { z } from 'zod'
import {
  planDraftPurchaseOrders,
  type DraftPurchasePlan,
  type DraftPurchaseSuggestion,
} from './draft-purchase-order.domain'
import {
  scoreSupplier,
  type PurchaseRecord,
  type SupplierFacts,
  type SupplierRisk,
} from './supplier-intelligence.domain'

export const reorderSuggestionInputSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().optional(),
  supplierId: z.string().uuid().nullable().optional(),
  onHand: z.number().finite(),
  reservedQuantity: z.number().finite().min(0).optional(),
  openPoQuantity: z.number().finite().min(0).default(0),
  reorderLevel: z.number().finite().min(0),
  demandForecastDaily: z.number().finite().min(0).optional(),
  leadTimeDays: z.number().finite().min(0).optional(),
  purchasePackSize: z.number().finite().positive().optional(),
  unitPrice: z.number().finite().nonnegative().optional(),
})

export type ReorderSuggestionInput = z.infer<typeof reorderSuggestionInputSchema>

export const createDraftFromSuggestionsSchema = z.object({
  suggestions: z.array(reorderSuggestionInputSchema).min(1).max(200),
  notes: z.string().max(1000).optional(),
  expectedDeliveryDate: z.string().optional(),
})

export type CreateDraftFromSuggestionsInput = z.infer<typeof createDraftFromSuggestionsSchema>

export interface RoundedReorderLine {
  readonly productId: string
  readonly rawDeficit: number
  readonly packSize: number
  readonly roundedQuantity: number
  readonly packsCount: number
}

export interface ReorderDraftPlanResult {
  readonly lines: readonly RoundedReorderLine[]
  readonly draftPlan: DraftPurchasePlan
  /** Draft POs created here always wait for human approval; never auto-ordered. */
  readonly requiresHumanApproval: true
}

/**
 * Round each positive reorder deficit up to a multiple of `purchasePackSize`,
 * accounting for open purchase orders and stock already reserved, then delegate
 * validation and supplier grouping to `planDraftPurchaseOrders`.
 */
export function planReordersWithPackRounding(
  inputs: readonly ReorderSuggestionInput[],
): ReorderDraftPlanResult {
  const lines: RoundedReorderLine[] = []
  const suggestions: DraftPurchaseSuggestion[] = []

  for (const item of inputs) {
    const reserved = item.reservedQuantity ?? 0
    const available = item.onHand - reserved + item.openPoQuantity
    const forecastDemand =
      item.demandForecastDaily !== undefined
        ? item.demandForecastDaily * (item.leadTimeDays ?? 7)
        : 0
    const targetStock = Math.max(item.reorderLevel, forecastDemand)
    const rawDeficit = Math.max(0, targetStock - available)
    const packSize = item.purchasePackSize && item.purchasePackSize > 0 ? item.purchasePackSize : 1

    if (rawDeficit <= 0) {
      lines.push({
        productId: item.productId,
        rawDeficit: 0,
        packSize,
        roundedQuantity: 0,
        packsCount: 0,
      })
      continue
    }

    const packsCount = Math.ceil(rawDeficit / packSize)
    const roundedQuantity = packsCount * packSize
    lines.push({
      productId: item.productId,
      rawDeficit,
      packSize,
      roundedQuantity,
      packsCount,
    })

    suggestions.push({
      productId: item.productId,
      supplierId: item.supplierId ?? null,
      suggestedQuantity: roundedQuantity,
      unitPrice: item.unitPrice,
    })
  }

  return {
    lines,
    draftPlan: planDraftPurchaseOrders(suggestions),
    requiresHumanApproval: true,
  }
}

// ─── Three-Way Match ─────────────────────────────────────────────────────────

export interface ThreeWayOrderLine {
  readonly productId: string
  readonly variantId?: string | null | undefined
  readonly quantity: number
  readonly unitPriceMinor: number
}

export interface ThreeWayReceiptLine {
  readonly productId: string
  readonly variantId?: string | null | undefined
  readonly quantity: number
}

export interface ThreeWayInvoiceLine {
  readonly productId: string
  readonly variantId?: string | null | undefined
  readonly quantity: number
  readonly unitPriceMinor: number
}

export type ThreeWayMismatchCode =
  | 'QTY_SHORT'
  | 'OVER_RECEIPT'
  | 'PRICE_DRIFT'
  | 'VARIANT_MISMATCH'
  | 'UNORDERED_ITEM'
  | 'INVOICE_MISSING'

export interface ThreeWayMismatch {
  readonly code: ThreeWayMismatchCode
  readonly productId: string | null
  readonly variantId: string | null
  readonly orderedQty: number
  readonly receivedQty: number
  readonly invoicedQty: number
  readonly orderedUnitPriceMinor: number | null
  readonly invoicedUnitPriceMinor: number | null
  readonly detail: string
}

export interface ThreeWayMatchResult {
  readonly matched: boolean
  readonly mayApprovePayment: boolean
  readonly mismatches: readonly ThreeWayMismatch[]
  readonly summary: {
    readonly orderedQtyTotal: number
    readonly receivedQtyTotal: number
    readonly invoicedQtyTotal: number
  }
}

function keyOf(productId: string, variantId?: string | null | undefined): string {
  return `${productId}::${variantId ?? ''}`
}

/**
 * Compare PO lines, goods receipt lines, and supplier invoice lines by
 * `(productId, variantId)` quantity and minor-unit price.
 *
 * Never auto-adjusts differences: every variance produces a structured
 * `ThreeWayMismatch` and forces `mayApprovePayment = false`.
 */
export function evaluateThreeWayMatch(input: {
  readonly poLines: readonly ThreeWayOrderLine[]
  readonly receiptLines: readonly ThreeWayReceiptLine[]
  readonly invoiceLines: readonly ThreeWayInvoiceLine[]
}): ThreeWayMatchResult {
  const orderedByKey = new Map<
    string,
    { productId: string; variantId: string | null; qty: number; unitPriceMinor: number }
  >()
  const orderedVariantsByProduct = new Map<string, Set<string>>()

  for (const line of input.poLines) {
    const k = keyOf(line.productId, line.variantId)
    const prev = orderedByKey.get(k)
    orderedByKey.set(k, {
      productId: line.productId,
      variantId: line.variantId ?? null,
      qty: (prev?.qty ?? 0) + line.quantity,
      unitPriceMinor: line.unitPriceMinor,
    })
    const set = orderedVariantsByProduct.get(line.productId) ?? new Set<string>()
    set.add(line.variantId ?? '')
    orderedVariantsByProduct.set(line.productId, set)
  }

  const receivedByKey = new Map<
    string,
    { productId: string; variantId: string | null; qty: number }
  >()
  for (const line of input.receiptLines) {
    const k = keyOf(line.productId, line.variantId)
    const prev = receivedByKey.get(k)
    receivedByKey.set(k, {
      productId: line.productId,
      variantId: line.variantId ?? null,
      qty: (prev?.qty ?? 0) + line.quantity,
    })
  }

  const invoicedByKey = new Map<
    string,
    { productId: string; variantId: string | null; qty: number; unitPriceMinor: number }
  >()
  for (const line of input.invoiceLines) {
    const k = keyOf(line.productId, line.variantId)
    const prev = invoicedByKey.get(k)
    invoicedByKey.set(k, {
      productId: line.productId,
      variantId: line.variantId ?? null,
      qty: (prev?.qty ?? 0) + line.quantity,
      unitPriceMinor: line.unitPriceMinor,
    })
  }

  const mismatches: ThreeWayMismatch[] = []
  const allKeys = new Set<string>([
    ...orderedByKey.keys(),
    ...receivedByKey.keys(),
    ...invoicedByKey.keys(),
  ])

  for (const k of allKeys) {
    const po = orderedByKey.get(k)
    const rc = receivedByKey.get(k)
    const inv = invoicedByKey.get(k)
    const productId = (po ?? rc ?? inv)!.productId
    const variantId = (po ?? rc ?? inv)!.variantId
    const orderedQty = po?.qty ?? 0
    const receivedQty = rc?.qty ?? 0
    const invoicedQty = inv?.qty ?? 0
    const orderedUnitPriceMinor = po ? po.unitPriceMinor : null
    const invoicedUnitPriceMinor = inv ? inv.unitPriceMinor : null

    if (!po) {
      const hasProductOnPo = orderedVariantsByProduct.has(productId)
      mismatches.push({
        code: hasProductOnPo ? 'VARIANT_MISMATCH' : 'UNORDERED_ITEM',
        productId,
        variantId,
        orderedQty,
        receivedQty,
        invoicedQty,
        orderedUnitPriceMinor,
        invoicedUnitPriceMinor,
        detail: hasProductOnPo
          ? 'Received or billed variant differs from the variant on the purchase order'
          : 'Received or billed item was not on the purchase order',
      })
      continue
    }

    if (receivedQty > orderedQty) {
      mismatches.push({
        code: 'OVER_RECEIPT',
        productId,
        variantId,
        orderedQty,
        receivedQty,
        invoicedQty,
        orderedUnitPriceMinor,
        invoicedUnitPriceMinor,
        detail: `Received quantity (${receivedQty}) exceeds ordered quantity (${orderedQty})`,
      })
    } else if (receivedQty < orderedQty || invoicedQty > receivedQty) {
      mismatches.push({
        code: 'QTY_SHORT',
        productId,
        variantId,
        orderedQty,
        receivedQty,
        invoicedQty,
        orderedUnitPriceMinor,
        invoicedUnitPriceMinor,
        detail:
          invoicedQty > receivedQty
            ? `Invoiced quantity (${invoicedQty}) exceeds goods received (${receivedQty})`
            : `Received quantity (${receivedQty}) is below ordered quantity (${orderedQty})`,
      })
    }

    if (inv && po.unitPriceMinor !== inv.unitPriceMinor) {
      mismatches.push({
        code: 'PRICE_DRIFT',
        productId,
        variantId,
        orderedQty,
        receivedQty,
        invoicedQty,
        orderedUnitPriceMinor,
        invoicedUnitPriceMinor,
        detail: `Supplier invoice unit price (${inv.unitPriceMinor}) differs from PO unit price (${po.unitPriceMinor})`,
      })
    }
  }

  if (input.poLines.length > 0 && input.invoiceLines.length === 0) {
    mismatches.push({
      code: 'INVOICE_MISSING',
      productId: null,
      variantId: null,
      orderedQty: input.poLines.reduce((s, l) => s + l.quantity, 0),
      receivedQty: input.receiptLines.reduce((s, l) => s + l.quantity, 0),
      invoicedQty: 0,
      orderedUnitPriceMinor: null,
      invoicedUnitPriceMinor: null,
      detail: 'No supplier invoice linked to this purchase order yet',
    })
  }

  const orderedQtyTotal = input.poLines.reduce((s, l) => s + l.quantity, 0)
  const receivedQtyTotal = input.receiptLines.reduce((s, l) => s + l.quantity, 0)
  const invoicedQtyTotal = input.invoiceLines.reduce((s, l) => s + l.quantity, 0)

  const matched =
    mismatches.length === 0 && input.poLines.length > 0 && input.invoiceLines.length > 0

  return {
    matched,
    mayApprovePayment: matched,
    mismatches,
    summary: { orderedQtyTotal, receivedQtyTotal, invoicedQtyTotal },
  }
}

// ─── Supplier Scorecard Adapter ──────────────────────────────────────────────

export interface SupplierScorecardRow extends SupplierRisk {
  readonly name: string
}

/**
 * Evaluate supplier reliability using the repository's canonical `scoreSupplier`
 * rules and `MIN_PURCHASES_FOR_A_SCORE` threshold.
 */
export function buildSupplierScorecard(
  suppliers: readonly (SupplierFacts & { readonly name: string })[],
  purchases: readonly PurchaseRecord[],
  asOf: string,
): SupplierScorecardRow[] {
  return suppliers.map((s) => ({
    ...scoreSupplier(s, purchases, asOf),
    name: s.name,
  }))
}
