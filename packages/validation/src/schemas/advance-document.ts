// ============================================
// advances-03: a pre-sale / pre-purchase written in the full invoice builder
// (owner decision, 9 Nov 2026 — «advance + lines»).
//
// The document is the priced list of what was pre-sold or pre-bought. It
// books NOTHING by itself: no stock, no receivable, no revenue. The money is
// the advance (`amountMinor`), booked exactly as before. The document says
// what the advance is FOR, and caps it — an advance larger than the goods it
// pays for is refused.
//
// ⚠️ The SERVER computes every total here from the lines (rule 3: the amount
// comes from the lines, never from the client). Money is integer minor units
// of the books currency; a quantity may be fractional (2.5 kg), so each line
// total is rounded ONCE, half away from zero, at the line.
// ============================================

import { z } from 'zod'

export const ADVANCE_DOCUMENT_MAX_LINES = 200

export const advanceDocumentLineInputSchema = z
  .object({
    productId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(200),
    /** Major-unit quantity; positive. */
    quantity: z.number().finite().positive().max(1_000_000_000),
    unit: z.string().trim().min(1).max(32),
    /** Price of ONE unit, integer minor units of the books currency. */
    unitPriceMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    /** Discount on this line, integer minor units. */
    discountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .strict()

export const advanceDocumentInputSchema = z
  .object({
    lines: z.array(advanceDocumentLineInputSchema).min(1).max(ADVANCE_DOCUMENT_MAX_LINES),
    /** Discount on the whole document, integer minor units. */
    discountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    /** Percent, 0–100 (e.g. 9 = 9%). */
    taxRate: z.number().finite().min(0).max(100).optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()

export type AdvanceDocumentInput = z.infer<typeof advanceDocumentInputSchema>

export interface AdvanceDocumentLine {
  productId: string | null
  name: string
  quantity: number
  unit: string
  unitPriceMinor: number
  discountMinor: number
  totalMinor: number
}

/** What is stored on `order_deposits.document`. */
export interface AdvanceDocument {
  version: 1
  currency: string
  lines: AdvanceDocumentLine[]
  subtotalMinor: number
  discountMinor: number
  taxRate: number
  taxMinor: number
  totalMinor: number
  dueDate: string | null
  notes: string | null
}

export type AdvanceDocumentRuleCode =
  | 'ADVANCE_LINE_NEGATIVE'
  | 'ADVANCE_DISCOUNT_EXCEEDS_SUBTOTAL'
  | 'ADVANCE_DOCUMENT_EMPTY'
  | 'ADVANCE_DOCUMENT_TOO_LARGE'
  | 'ADVANCE_EXCEEDS_DOCUMENT'

/** Half away from zero — the way a shop rounds a receipt. */
function roundHalfAway(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

/**
 * The stored document, with every total computed here. `amountMinor` is the
 * advance being taken against it.
 */
export function advanceDocumentFrom(
  input: AdvanceDocumentInput,
  currency: string,
  amountMinor: number,
): { ok: true; document: AdvanceDocument } | { ok: false; code: AdvanceDocumentRuleCode } {
  if (input.lines.length === 0) return { ok: false, code: 'ADVANCE_DOCUMENT_EMPTY' }
  const lines: AdvanceDocumentLine[] = []
  let subtotal = 0
  for (const line of input.lines) {
    const gross = roundHalfAway(line.quantity * line.unitPriceMinor)
    const discount = line.discountMinor ?? 0
    const total = gross - discount
    if (total < 0) return { ok: false, code: 'ADVANCE_LINE_NEGATIVE' }
    subtotal += total
    lines.push({
      productId: line.productId ?? null,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      unitPriceMinor: line.unitPriceMinor,
      discountMinor: discount,
      totalMinor: total,
    })
  }
  const discount = input.discountMinor ?? 0
  if (discount > subtotal) return { ok: false, code: 'ADVANCE_DISCOUNT_EXCEEDS_SUBTOTAL' }
  const taxRate = input.taxRate ?? 0
  const taxable = subtotal - discount
  const tax = roundHalfAway((taxable * taxRate) / 100)
  const total = taxable + tax
  if (!Number.isSafeInteger(total)) return { ok: false, code: 'ADVANCE_DOCUMENT_TOO_LARGE' }
  if (amountMinor > total) return { ok: false, code: 'ADVANCE_EXCEEDS_DOCUMENT' }
  return {
    ok: true,
    document: {
      version: 1,
      currency,
      lines,
      subtotalMinor: subtotal,
      discountMinor: discount,
      taxRate,
      taxMinor: tax,
      totalMinor: total,
      dueDate: input.dueDate ?? null,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    },
  }
}
