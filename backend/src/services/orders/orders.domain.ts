// ============================================
// backend/src/services/orders/orders.domain.ts
//
// The rules of sales orders, as pure functions. The lifecycle itself lives in
// the database (transition_sales_order) so no path can skip it; this file
// only maps its answers, shapes what the public may see, and turns a
// confirmed order into the invoice the existing invoice path creates.
// ============================================

import { toLatinDigits } from '@hisabche/formatting'
import type { CreateInvoice, OrderErrorCode, StorefrontSettings } from '@hisabche/validation'

/** Every refusal the order functions raise, and the status a route answers. */
export const ORDER_ERROR_STATUS = {
  ORDER_NOT_FOUND: 404,
  ORDER_TRANSITION_INVALID: 409,
  ORDER_INVOICE_REQUIRED: 409,
  ORDER_INSUFFICIENT_STOCK: 409,
  ORDER_CUSTOMER_AMBIGUOUS: 409,
  // No customer has this phone and the caller may not create one: pass customerId.
  ORDER_CUSTOMER_REQUIRED: 409,
  ORDER_PRODUCT_NOT_FOUND: 422,
  ORDER_PRODUCT_NOT_PRICED: 422,
  ORDER_QUANTITY_INVALID: 400,
  ORDER_ITEMS_REQUIRED: 400,
  ORDER_TOO_MANY_ITEMS: 400,
  ORDER_CUSTOMER_NAME_REQUIRED: 400,
  ORDER_CUSTOMER_PHONE_REQUIRED: 400,
  ORDER_SOURCE_INVALID: 400,
  ORDER_TOO_MANY_PENDING: 429,
} as const satisfies Record<OrderErrorCode, number>

export type { OrderErrorCode }

export class OrderError extends Error {
  readonly statusCode: number
  constructor(readonly code: OrderErrorCode) {
    super(code)
    this.name = 'OrderError'
    this.statusCode = ORDER_ERROR_STATUS[code]
  }
}

/** The database's refusal as an OrderError, or null for anything else. */
export function orderErrorFrom(message: string | undefined): OrderError | null {
  const code = message?.trim()
  return code && code in ORDER_ERROR_STATUS ? new OrderError(code as OrderErrorCode) : null
}

/**
 * The phone as stored: Latin digits, no spaces. «۰۷۹۹ ۰۰۰ ۰۰۰» and
 * «0799000000» are one contact — the per-contact limit and the customer
 * match both depend on it.
 */
export function normalizePhone(phone: string): string {
  return toLatinDigits(phone).replace(/[\s()-]/g, '')
}

// ─── What the public sees ────────────────────────────────────────────────────

export interface CatalogRow {
  id: string
  name: string
  unit: string | null
  sell_price: number | string | null
  quantity: number | string | null
  image_url: string | null
}

export interface PublicProduct {
  id: string
  name: string
  unit: string | null
  price: number
  imageUrl: string | null
  availability: 'in_stock' | 'out_of_stock'
  /** Present only when the owner chose to show numbers. */
  quantity?: number
}

/**
 * ⚠️ The ONLY shape a publishable key receives for a product. Cost, buy
 * price, supplier and barcode never appear — not because a client ignores
 * them, but because they are not in the object.
 */
export function publicProductView(
  row: CatalogRow,
  stockDisplay: StorefrontSettings['stockDisplay'],
): PublicProduct {
  const quantity = Number(row.quantity ?? 0)
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    price: Number(row.sell_price ?? 0),
    imageUrl: row.image_url,
    availability: quantity > 0 ? 'in_stock' : 'out_of_stock',
    ...(stockDisplay === 'quantity' ? { quantity: Math.max(0, quantity) } : {}),
  }
}

// ─── Order → invoice ─────────────────────────────────────────────────────────

export interface OrderLine {
  product_id: string
  product_name: string
  unit: string | null
  quantity: number | string
  unit_price: number | string
  line_total: number | string
}

/**
 * The invoice a confirmed order becomes. Prices are the order's — which the
 * database read from the products when the order was placed — and the
 * invoice service derives its own header totals from these lines anyway.
 */
export function invoiceFromOrder(input: {
  lines: readonly OrderLine[]
  customerId: string
  date: string
  orderNumber: string
}): CreateInvoice {
  const items = input.lines.map((line) => ({
    productId: line.product_id,
    productName: line.product_name,
    quantity: Number(line.quantity),
    unitPrice: Number(line.unit_price),
    totalPrice: Number(line.line_total),
  }))
  const total = items.reduce((sum, item) => sum + item.totalPrice, 0)
  return {
    type: 'sale',
    date: input.date,
    customerId: input.customerId,
    items,
    subtotal: total,
    total,
    notes: input.orderNumber,
  }
}

/** Idempotency key for the invoice of an order: a retry makes no second invoice. */
export function invoiceRequestIdFor(orderId: string): string {
  return `order-${orderId}`
}
