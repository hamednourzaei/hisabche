// ============================================
// packages/validation/src/schemas/price-list-view.ts
//
// Price lists and promotions as the screens read them — one rule, two runtimes.
// The server (`PriceListService`, `PromotionService`, rows from Postgres) and
// the device (the local engine's `routes/pricing.ts`, rows from SQLite) hand
// their rows to these functions; neither re-derives a hundredths conversion, a
// retire-not-delete change set, or the shape of a saved list.
//
// ⚠️ THE API SPEAKS THE PRODUCT'S UNIT (a price, like `products.sell_price`);
// the tables store integer hundredths. The conversion is here and nowhere else.
// ============================================

import { minor } from './money'
import type { CustomerPriceList, PromotionInput, SavedPriceList, SavedPromotion } from './pricing'

type Loose = string | number | null | undefined

export interface PriceListRow {
  id: string
  name: string
  currency: string
  valid_from: string | null
  valid_to: string | null
  /** Postgres boolean, SQLite 0/1. */
  is_active: boolean | number
  created_at: string
}

export interface PriceListItemRow {
  price_list_id: string
  product_id: string
  unit_price_minor: number | string
  is_active: boolean | number
}

export interface PromotionRow {
  id: string
  name: string
  kind: 'percentage' | 'fixed_amount'
  value: number | string
  currency: string | null
  stacking: 'exclusive' | 'stacking'
  /** A Postgres array, or the JSON text SQLite keeps. */
  product_ids: string[] | string | null
  customer_ids: string[] | string | null
  valid_from: string | null
  valid_to: string | null
  is_active: boolean | number
  created_at: string
}

const day = (value: string | null | undefined) => (value ? String(value).slice(0, 10) : null)
export const fromHundredths = (value: Loose) => Number(value) / 100

function idList(value: string[] | string | null): string[] | null {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : null
  } catch {
    return null
  }
}

export const toSavedPriceList = (
  row: PriceListRow,
  itemCount: number,
  customerCount: number,
): SavedPriceList => ({
  id: row.id,
  name: row.name,
  currency: row.currency,
  validFrom: day(row.valid_from),
  validTo: day(row.valid_to),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  itemCount,
  customerCount,
})

export interface PriceListDetail extends SavedPriceList {
  items: {
    productId: string
    name: string
    unit: string | null
    ownPrice: number
    unitPrice: number
  }[]
  customers: { id: string; name: string }[]
}

/** The list, every product priced on it (beside its own price), and who buys on it. */
export function buildPriceListDetail(input: {
  list: PriceListRow
  items: readonly PriceListItemRow[]
  products: ReadonlyMap<string, { name: string; unit: string | null; sell_price: unknown }>
  customers: readonly { id: string; full_name: string }[]
}): PriceListDetail {
  const { products } = input
  return {
    ...toSavedPriceList(input.list, input.items.length, input.customers.length),
    // A price whose product can no longer be read is not shown as a nameless row.
    items: input.items
      .filter((item) => products.has(item.product_id))
      .map((item) => {
        const product = products.get(item.product_id)!
        return {
          productId: item.product_id,
          name: product.name,
          unit: product.unit,
          ownPrice: Number(product.sell_price),
          unitPrice: fromHundredths(item.unit_price_minor),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
    customers: input.customers.map((customer) => ({ id: customer.id, name: customer.full_name })),
  }
}

/** The list a customer buys on, with its live prices — what a line is priced from. */
export function buildCustomerPriceList(
  list: PriceListRow,
  items: readonly PriceListItemRow[],
): CustomerPriceList {
  return {
    id: list.id,
    name: list.name,
    currency: list.currency,
    validFrom: day(list.valid_from),
    validTo: day(list.valid_to),
    isActive: Boolean(list.is_active),
    prices: items.map((item) => ({
      productId: item.product_id,
      unitPrice: fromHundredths(item.unit_price_minor),
    })),
  }
}

export type PriceListChangeRefusal = 'PRICE_LIST_PRODUCT_TWICE' | 'PRICE_LIST_PRICE_TOO_SMALL'

/**
 * Set or remove prices. `unitPrice: null` takes a product off the list: the
 * row is kept, retired, with the price it had. A removal of a product that was
 * never on the list changes nothing.
 */
export function planPriceListChanges(
  items: readonly { productId: string; unitPrice: number | null }[],
  existing: ReadonlyMap<string, number>,
):
  | { refusal: PriceListChangeRefusal }
  | { rows: { product_id: string; unit_price_minor: number; is_active: boolean }[] } {
  const ids = new Set(items.map((item) => item.productId))
  if (ids.size !== items.length) return { refusal: 'PRICE_LIST_PRODUCT_TWICE' }

  const rows: { product_id: string; unit_price_minor: number; is_active: boolean }[] = []
  for (const item of items) {
    if (item.unitPrice === null) {
      const kept = existing.get(item.productId)
      // Nothing to take off: the product was never on the list.
      if (kept === undefined) continue
      rows.push({ product_id: item.productId, unit_price_minor: kept, is_active: false })
      continue
    }
    const hundredths = minor(item.unitPrice)
    // 0.004 is a positive number and zero hundredths; a free product is not a price.
    if (hundredths <= 0) return { refusal: 'PRICE_LIST_PRICE_TOO_SMALL' }
    rows.push({ product_id: item.productId, unit_price_minor: hundredths, is_active: true })
  }
  return { rows }
}

export const toSavedPromotion = (row: PromotionRow): SavedPromotion => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  value: Number(row.value),
  currency: row.currency,
  stacking: row.stacking,
  productIds: idList(row.product_ids),
  customerIds: idList(row.customer_ids),
  validFrom: day(row.valid_from),
  validTo: day(row.valid_to),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
})

/** The stored columns of a promotion input; a percentage has no currency. */
export const promotionColumns = (input: PromotionInput) => ({
  name: input.name,
  kind: input.kind,
  value: input.value,
  currency: input.kind === 'fixed_amount' ? input.currency : null,
  stacking: input.stacking,
  product_ids: input.productIds,
  customer_ids: input.customerIds,
  valid_from: input.validFrom,
  valid_to: input.validTo,
})
