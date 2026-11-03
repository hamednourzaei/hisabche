// ============================================
// packages/validation/src/schemas/draft-purchase-order.domain.ts
//
// ONE rule for «turn reorder suggestions into draft purchase orders».
//
// The server route and the offline engine each had their own copy and the
// copies disagreed: the server refused a line with no supplier or no price,
// the device invented a supplier called `default-supplier` and accepted a price
// of 0. A draft order with a guessed supplier or a free item is a purchase the
// owner never decided on (CLAUDE.md §12 — no guessing), so the rule lives here
// and both sides call it.
//
// This file decides WHAT may be drafted and HOW it is grouped. Writing the
// order — ids, status, persistence — stays with each side.
// ============================================

export interface DraftPurchaseSuggestion {
  readonly productId: string
  readonly supplierId?: string | null | undefined
  readonly suggestedQuantity: number
  readonly unitPrice?: number | undefined
}

export type DraftPurchaseLineIssue =
  'SUPPLIER_REQUIRED' | 'QUANTITY_INVALID' | 'UNIT_PRICE_REQUIRED'

export interface DraftPurchaseLine {
  readonly productId: string
  readonly quantity: number
  readonly unitPrice: number
}

export interface DraftPurchaseGroup {
  readonly supplierId: string
  readonly lines: readonly DraftPurchaseLine[]
}

export interface IncompleteDraftLine {
  readonly productId: string
  readonly issues: readonly DraftPurchaseLineIssue[]
}

export type DraftPurchasePlan =
  | { readonly ok: true; readonly groups: readonly DraftPurchaseGroup[] }
  | { readonly ok: false; readonly incomplete: readonly IncompleteDraftLine[] }

/** The error code both sides return, so a client translates it once. */
export const DRAFT_PURCHASE_LINE_INCOMPLETE = 'DRAFT_PO_LINE_INCOMPLETE'

function issuesOf(suggestion: DraftPurchaseSuggestion): DraftPurchaseLineIssue[] {
  const issues: DraftPurchaseLineIssue[] = []
  if (!suggestion.supplierId) issues.push('SUPPLIER_REQUIRED')
  if (!(Number.isFinite(suggestion.suggestedQuantity) && suggestion.suggestedQuantity > 0)) {
    issues.push('QUANTITY_INVALID')
  }
  if (!(typeof suggestion.unitPrice === 'number' && suggestion.unitPrice > 0)) {
    issues.push('UNIT_PRICE_REQUIRED')
  }
  return issues
}

/**
 * Validate every suggestion and group the good ones by supplier.
 *
 * All-or-nothing: one incomplete line refuses the whole batch, because a
 * half-drafted batch leaves the person guessing which suppliers got an order.
 * Suppliers keep first-seen order and lines keep their input order, so the
 * result is the same on every platform.
 */
export function planDraftPurchaseOrders(
  suggestions: readonly DraftPurchaseSuggestion[],
): DraftPurchasePlan {
  if (suggestions.length === 0) {
    return { ok: false, incomplete: [] }
  }

  const incomplete: IncompleteDraftLine[] = []
  for (const suggestion of suggestions) {
    const issues = issuesOf(suggestion)
    if (issues.length > 0) incomplete.push({ productId: suggestion.productId, issues })
  }
  if (incomplete.length > 0) return { ok: false, incomplete }

  const bySupplier = new Map<string, DraftPurchaseLine[]>()
  for (const suggestion of suggestions) {
    // `issuesOf` proved both are present and valid.
    const supplierId = suggestion.supplierId as string
    const lines = bySupplier.get(supplierId) ?? []
    lines.push({
      productId: suggestion.productId,
      quantity: suggestion.suggestedQuantity,
      unitPrice: suggestion.unitPrice as number,
    })
    bySupplier.set(supplierId, lines)
  }

  return {
    ok: true,
    groups: [...bySupplier].map(([supplierId, lines]) => ({ supplierId, lines })),
  }
}
