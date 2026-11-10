// ============================================
// packages/validation/src/schemas/stock-waste.ts
//
// «ثبت ضایعات» — goods that left the shelf without being sold (QA report,
// Weighted Retail DNA: «سند ضایعات»; 10 Nov 2026). A nut seller loses some
// kilos to spoilage every month; before this the only way to say so was to
// overwrite the stock figure on the product form, which erased the WHY.
//
// A waste record is a stock movement OUT, with its reason, from one
// warehouse. It is not a sale: no invoice, no customer, no revenue.
// ============================================

import { z } from 'zod'

export const STOCK_WASTE_REASONS = ['spoiled', 'damaged', 'expired', 'lost', 'other'] as const
export type StockWasteReason = (typeof STOCK_WASTE_REASONS)[number]

export const stockWasteSchema = z.object({
  /** In the product's own unit; decimals allowed (0.25 kg). */
  quantity: z.number().positive().max(1_000_000_000),
  /** Required when the business has several warehouses (stockEditWarehouse). */
  warehouseId: z.string().uuid().nullable().optional(),
  reason: z.enum(STOCK_WASTE_REASONS),
  note: z.string().trim().max(500).optional(),
})
export type StockWasteInput = z.infer<typeof stockWasteSchema>

/** The movement's note: the reason first, so the stock history reads it. */
export function wasteMovementNote(input: Pick<StockWasteInput, 'reason' | 'note'>): string {
  return input.note ? `waste:${input.reason} — ${input.note}` : `waste:${input.reason}`
}
