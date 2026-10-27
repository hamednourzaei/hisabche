// ============================================
// packages/validation/src/schemas/universal-core/returns.domain.ts
//
// G-12: RETURNS DOCUMENT & PROPORTIONAL REVERSAL
//
// Document types `sale_return` and `purchase_return` referencing the original invoice.
// Proportional financial reversal and restock/scrap choice.
// ============================================

export type ReturnType = 'sale_return' | 'purchase_return'
export type RestockChoice = 'restock' | 'scrap'
export type ReturnReason =
  | 'defective'
  | 'wrong_item'
  | 'customer_change_of_mind'
  | 'damaged_in_transit'
  | 'expired'
  | 'other'

export interface OriginalInvoiceLine {
  readonly lineId: string
  readonly productId: string
  readonly quantity: number
  readonly unitPriceMinor: number
  readonly subtotalMinor: number
  readonly discountMinor: number
  readonly taxMinor: number
  readonly totalMinor: number
  readonly unitCostMinor?: number | null | undefined
}

export interface ReturnLineRequest {
  readonly originalLineId: string
  readonly returnQuantity: number
  readonly restockChoice: RestockChoice
  readonly reasonCode: ReturnReason
}

export interface ReturnLineCalculation {
  readonly originalLineId: string
  readonly productId: string
  readonly returnQuantity: number
  readonly restockChoice: RestockChoice
  readonly reasonCode: ReturnReason
  readonly returnRatio: number
  readonly subtotalMinor: number
  readonly discountMinor: number
  readonly taxMinor: number
  readonly totalMinor: number
  readonly restoredCostTotalMinor: number | null
}

export interface ReturnDocumentResult {
  readonly originalInvoiceId: string
  readonly returnType: ReturnType
  readonly lines: readonly ReturnLineCalculation[]
  readonly totalSubtotalMinor: number
  readonly totalDiscountMinor: number
  readonly totalTaxMinor: number
  readonly grandTotalMinor: number
  readonly totalRestoredCostMinor: number | null
}

/**
 * Calculate proportional return effects and validate quantities.
 * Vector: Sale return of 2 of 5 units restores 2 units at original layer cost,
 * reverses 2/5 of revenue and tax; refuses return once 5 are returned.
 */
export function calculateReturnDocument(
  originalInvoiceId: string,
  returnType: ReturnType,
  originalLines: readonly OriginalInvoiceLine[],
  requestedLines: readonly ReturnLineRequest[],
  priorReturnedQuantitiesByLine: Readonly<Record<string, number>> = {},
): ReturnDocumentResult {
  const lineMap = new Map(originalLines.map((l) => [l.lineId, l]))
  const calculatedLines: ReturnLineCalculation[] = []

  let totalSubtotalMinor = 0
  let totalDiscountMinor = 0
  let totalTaxMinor = 0
  let grandTotalMinor = 0
  let totalRestoredCostMinor: number | null = null

  for (const req of requestedLines) {
    const orig = lineMap.get(req.originalLineId)
    if (!orig) {
      throw new Error(
        `Original line ${req.originalLineId} not found in invoice ${originalInvoiceId}`,
      )
    }

    const prior = priorReturnedQuantitiesByLine[req.originalLineId] ?? 0
    const maxReturnable = Math.max(0, orig.quantity - prior)

    if (req.returnQuantity <= 0) {
      throw new Error(`Return quantity must be positive for line ${req.originalLineId}`)
    }

    if (req.returnQuantity > maxReturnable) {
      throw new Error(
        `RETURN_EXCEEDS_ORIGINAL: requested ${req.returnQuantity}, but only ${maxReturnable} remaining for line ${req.originalLineId}`,
      )
    }

    const returnRatio = req.returnQuantity / orig.quantity
    const subtotalMinor = Math.round(orig.subtotalMinor * returnRatio)
    const discountMinor = Math.round(orig.discountMinor * returnRatio)
    const taxMinor = Math.round(orig.taxMinor * returnRatio)
    const totalMinor = subtotalMinor - discountMinor + taxMinor

    let restoredCostTotalMinor: number | null = null
    if (
      req.restockChoice === 'restock' &&
      orig.unitCostMinor !== null &&
      orig.unitCostMinor !== undefined
    ) {
      restoredCostTotalMinor = Math.round(orig.unitCostMinor * req.returnQuantity)
      totalRestoredCostMinor = (totalRestoredCostMinor ?? 0) + restoredCostTotalMinor
    }

    totalSubtotalMinor += subtotalMinor
    totalDiscountMinor += discountMinor
    totalTaxMinor += taxMinor
    grandTotalMinor += totalMinor

    calculatedLines.push({
      originalLineId: req.originalLineId,
      productId: orig.productId,
      returnQuantity: req.returnQuantity,
      restockChoice: req.restockChoice,
      reasonCode: req.reasonCode,
      returnRatio,
      subtotalMinor,
      discountMinor,
      taxMinor,
      totalMinor,
      restoredCostTotalMinor,
    })
  }

  return {
    originalInvoiceId,
    returnType,
    lines: calculatedLines,
    totalSubtotalMinor,
    totalDiscountMinor,
    totalTaxMinor,
    grandTotalMinor,
    totalRestoredCostMinor,
  }
}
