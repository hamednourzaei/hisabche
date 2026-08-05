// ============================================
// Invoice draft maths — pure, shared by the page and its tests.
// The payload is shaped by the shared createInvoiceSchema.
// ============================================

import type { CreateInvoice, InvoiceItem } from '@hisabche/validation'

import type { CurrencyCode } from '@/shared/lib/currency'

export interface DraftLine {
  key: string
  productId?: string | undefined
  productName: string
  quantity: number
  unitPrice: number
  discount: number
}

export function lineTotal(line: DraftLine): number {
  return line.quantity * line.unitPrice * (1 - line.discount / 100)
}

export function subtotalOf(lines: readonly DraftLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0)
}

function toItem(line: DraftLine): InvoiceItem {
  return {
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discount: line.discount,
    totalPrice: lineTotal(line),
  } as InvoiceItem
}

export function buildInvoice(
  lines: readonly DraftLine[],
  currency: CurrencyCode,
  customerId?: string | undefined
): CreateInvoice {
  const subtotal = subtotalOf(lines)

  return {
    type: 'sale',
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
