// ============================================
// Invoice draft maths — pure, shared by the page and its tests.
// The payload is shaped by the shared createInvoiceSchema.
// ============================================

import { computeItemTotal, type CreateInvoice, type InvoiceItem } from '@hisabche/validation'

import type { CurrencyCode } from '@/shared/lib/currency'

/** sale | purchase. One engine, two semantics — never two systems. */
export type TransactionType = 'sale' | 'purchase'

/** Mirrors `unitSchema` in @hisabche/validation. */
export type DraftUnit =
  'piece' | 'gram' | 'kg' | 'meter' | 'liter' | 'box' | 'pack' | 'carton' | 'custom'

export const DRAFT_UNITS: readonly DraftUnit[] = [
  'piece',
  'gram',
  'kg',
  'carton',
  'box',
  'pack',
  'meter',
  'liter',
  'custom',
]

/** A component of a line — "گردنبند" made of زنجیر / سنگ / اجرت. */
export interface DraftDetail {
  key: string
  title: string
  quantity: number
  amount: number
}

export interface DraftLine {
  key: string
  productId?: string | undefined
  productName: string
  quantity: number
  unitPrice: number
  discount: number
  unit?: DraftUnit | undefined
  /** Free text, only when `unit === 'custom'`. */
  unitLabel?: string | undefined
  /**
   * Weight, deliberately NOT the same field as `quantity`.
   * "1 necklace weighing 12.5 g" is quantity=1, weightGrams=12.5.
   */
  weightGrams?: number | undefined
  /** Optional. An empty list is a completely valid, and the default, state. */
  details?: readonly DraftDetail[] | undefined
}

/** Sum of a line's components. */
export function detailsSum(details: readonly DraftDetail[] | undefined): number {
  if (!details?.length) return 0
  return details.reduce((sum, d) => sum + d.quantity * d.amount, 0)
}

/**
 * The one money rule for a line.
 *
 * Delegates to `computeItemTotal` in @hisabche/validation rather than
 * restating it. This used to be a second implementation of the same formula —
 * correct at the time, but a place where desktop could silently drift from the
 * server and every other renderer on how components affect a line total.
 *
 * Components ADD to the line: "قند ۲٬۰۰۰ + سنگ امیتیس ۱٬۰۰۰" totals 3,000.
 * A line with no components is unchanged — base + 0.
 */
export function lineTotal(line: DraftLine): number {
  return computeItemTotal({
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discount: line.discount,
    details: line.details ?? [],
  })
}

export function subtotalOf(lines: readonly DraftLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0)
}

function toItem(line: DraftLine): InvoiceItem {
  return {
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    unit: line.unit ?? 'piece',
    ...(line.unit === 'custom' && line.unitLabel?.trim()
      ? { unitLabel: line.unitLabel.trim() }
      : {}),
    ...(line.weightGrams ? { weightGrams: line.weightGrams } : {}),
    unitPrice: line.unitPrice,
    discount: line.discount,
    totalPrice: lineTotal(line),
    details: (line.details ?? [])
      .filter((d) => d.title.trim())
      .map((d, index) => ({
        title: d.title.trim(),
        quantity: d.quantity,
        amount: d.amount,
        sortOrder: index,
      })),
  } as InvoiceItem
}

export function buildInvoice(
  lines: readonly DraftLine[],
  currency: CurrencyCode,
  customerId?: string | undefined,
  type: TransactionType = 'sale',
): CreateInvoice {
  const subtotal = subtotalOf(lines)

  return {
    // Sent explicitly from form state, never inferred from the route.
    type,
    date: new Date().toISOString(),
    customerId,
    items: lines.map(toItem),
    subtotal,
    discountTotal: 0,
    discountType: 'fixed',
    taxRate: 0,
    taxTotal: 0,
    total: subtotal,
    paidAmount: 0,
    paymentMethod: 'cash',
    currency,
  } as CreateInvoice
}
