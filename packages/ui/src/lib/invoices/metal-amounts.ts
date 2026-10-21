// ============================================
// An invoice in a metal, from the unit TYPED in to the gram the books keep.
//
// On a gold invoice shown in kilograms, a person types «2.5» for 2,500 g. The
// draft holds what was typed; the server — the ledger, the cost layers, the
// payments — holds grams. This is the one place the invoice crosses from one
// to the other, at submit. Every money field is scaled; quantities, weights
// and percentages are not money and are left alone.
//
// A non-metal invoice (factor 1) is returned untouched.
// ============================================

import { metalFactor } from '@hisabche/formatting'

interface MoneyBearingInvoice {
  currency: string
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  paidAmount?: number | undefined
  payments?: { amount: number }[] | undefined
  items: {
    unitPrice: number
    totalPrice?: number | undefined
    details?: { amount: number }[] | undefined
  }[]
}

export function invoiceInStoredMetal<T extends MoneyBearingInvoice>(invoice: T): T {
  const factor = metalFactor(invoice.currency)
  if (factor === 1) return invoice
  const scale = (value: number) => value * factor
  return {
    ...invoice,
    subtotal: scale(invoice.subtotal),
    discountTotal: scale(invoice.discountTotal),
    taxTotal: scale(invoice.taxTotal),
    total: scale(invoice.total),
    ...(invoice.paidAmount !== undefined ? { paidAmount: scale(invoice.paidAmount) } : {}),
    ...(invoice.payments
      ? {
          payments: invoice.payments.map((payment) => ({
            ...payment,
            amount: scale(payment.amount),
          })),
        }
      : {}),
    items: invoice.items.map((item) => ({
      ...item,
      unitPrice: scale(item.unitPrice),
      ...(item.totalPrice !== undefined ? { totalPrice: scale(item.totalPrice) } : {}),
      ...(item.details
        ? { details: item.details.map((detail) => ({ ...detail, amount: scale(detail.amount) })) }
        : {}),
    })),
  }
}
