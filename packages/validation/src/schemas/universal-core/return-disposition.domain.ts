// ============================================
// packages/validation/src/schemas/universal-core/return-disposition.domain.ts
//
// M5 / C5 (owner, 2 Nov 2026): RETURN and SCRAP are two different business events.
//
//   Return + RESTOCK  the goods are sound and go back on the shelf -> the existing return permission (invoice.create). A
//                     seller needs nothing more for a sound return.
//   Return + SCRAP    the goods cannot be sold -> they leave stock and their purchase cost becomes a LOSS. That is a stock
//                     decision: `stock.adjust` (manager by default, delegable by the owner).
//   Not said          FAIL CLOSED. A line that names neither is refused whole - no stock, no cost, no ledger effect is
//                     invented for it (the server's SQL used to default to restock; the route no longer lets that through).
//
// ONE function for the server route and the device route; the permission engine is the existing one.
// ============================================

export const RETURN_DISPOSITIONS = ['restock', 'scrap'] as const
export type ReturnDisposition = (typeof RETURN_DISPOSITIONS)[number]

export interface ReturnDispositionPlan {
  /** Some line writes goods off: the caller must hold `stock.adjust`. */
  needsStockAdjust: boolean
  dispositions: ReturnDisposition[]
}

/**
 * What a return's lines say about their goods. A sale return needs EVERY line to say restock or scrap; a purchase return
 * moves nothing back into the shop's stock and is not decided here.
 * Throws `RETURN_DISPOSITION_REQUIRED` for a line that does not say - never defaults it.
 */
export function planReturnDisposition(input: {
  returnType: 'sale_return' | 'purchase_return'
  lines: ReadonlyArray<{ restockChoice?: string | null | undefined }>
}): ReturnDispositionPlan {
  if (input.returnType !== 'sale_return') return { needsStockAdjust: false, dispositions: [] }
  const dispositions = input.lines.map((line) => {
    const choice = line.restockChoice
    if (choice !== 'restock' && choice !== 'scrap') throw new Error('RETURN_DISPOSITION_REQUIRED')
    return choice
  })
  return { needsStockAdjust: dispositions.includes('scrap'), dispositions }
}
