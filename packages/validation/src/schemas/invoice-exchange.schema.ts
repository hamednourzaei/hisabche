// ============================================
// packages/validation/src/schemas/invoice-exchange.schema.ts
//
// The body of `POST /api/invoices/:id/exchange` (V59.1 variant exchange: return lines of a
// sale and, optionally, sell replacements on a new invoice in the same request).
//
// 12 Nov 2026 audit (V60): the route read the body as a TypeScript cast — no check at all —
// wrote every return as «wrong item», and sold the replacement as a «cash» invoice with
// nothing paid unless told otherwise. The reason is now the caller's (default: change of
// mind, the same default the return form uses), and an unpaid replacement is «credit»: the
// return's credit and the new invoice settle against each other on the customer's account.
// ============================================

import { z } from 'zod'
import { uuidSchema } from './common.schema'
import { invoiceItemSchema } from './invoice.schema'
import type { ReturnReason } from './universal-core/returns.domain'
import { RETURN_CONDITIONS } from './universal-core/returns-settlement.domain'

const RETURN_REASON_CODES = [
  'defective',
  'wrong_item',
  'customer_change_of_mind',
  'damaged_in_transit',
  'expired',
  'other',
] as const satisfies readonly ReturnReason[]

export const invoiceExchangeSchema = z
  .object({
    returnNumber: z.string().trim().min(1).max(64),
    /** The day of the exchange (YYYY-MM-DD, or an instant whose first ten characters are). */
    returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
    reasonCode: z.enum(RETURN_REASON_CODES).default('customer_change_of_mind'),
    notes: z.string().max(2000).optional(),
    warehouseId: uuidSchema.optional(),
    returnedLines: z
      .array(
        z.object({
          originalLineId: uuidSchema,
          variantId: uuidSchema.optional(),
          quantity: z.number().positive(),
          restockChoice: z.enum(['restock', 'scrap']).optional(),
          conditionCode: z.enum(RETURN_CONDITIONS).optional(),
        }),
      )
      .min(1),
    replacementItems: z.array(invoiceItemSchema).default([]),
    paymentMethod: z.enum(['cash', 'bank', 'credit']).default('credit'),
    paidAmount: z.number().nonnegative().default(0),
  })
  .refine((body) => body.paymentMethod === 'credit' || body.paidAmount > 0, {
    // «Cash» with nothing paid is not a cash sale; say «credit» or say how much was paid.
    message: 'EXCHANGE_PAYMENT_UNSTATED',
    path: ['paidAmount'],
  })

export type InvoiceExchangeInput = z.infer<typeof invoiceExchangeSchema>

/** What a client sends — defaults not yet applied. */
export type InvoiceExchangeRequest = z.input<typeof invoiceExchangeSchema>
