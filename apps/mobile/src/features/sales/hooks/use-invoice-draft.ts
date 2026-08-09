// ============================================
// Invoice draft — line-item maths kept out of the screen.
// Validated with the shared createInvoiceSchema before submit.
// ============================================

import { useCallback, useMemo, useState } from 'react'
import type { CreateInvoice, InvoiceItem } from '@hisabche/validation'
import type { CurrencyCode } from '@hisabche/store'

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

export interface DraftItem {
  key: string
  productId?: string | undefined
  productName: string
  quantity: number
  unitPrice: number
  discount: number
  unit?: DraftUnit | undefined
  /** Free text, only when `unit === 'custom'`. */
  unitLabel?: string | undefined
  /** Weight, deliberately NOT the same field as `quantity`. */
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
 * The one money rule for a line. Mirrors `computeItemTotal` in
 * @hisabche/validation.
 *
 * Components ADD to the line: "قند ۲٬۰۰۰ + سنگ امیتیس ۱٬۰۰۰" totals 3,000.
 * A line with no components is unchanged — base + 0.
 */
export function lineTotal(item: DraftItem): number {
  const gross = item.quantity * item.unitPrice + detailsSum(item.details)
  return gross * (1 - item.discount / 100)
}

export function subtotalOf(items: DraftItem[]): number {
  return items.reduce((sum, item) => sum + lineTotal(item), 0)
}

/** Pure payload builder — kept outside the hook so it is directly testable. */
export function buildInvoice(
  items: DraftItem[],
  currency: CurrencyCode,
  customerId?: string | undefined,
  type: TransactionType = 'sale',
): CreateInvoice {
  const subtotal = subtotalOf(items)

  return {
    // Sent explicitly from form state, never inferred from the route.
    type,
    date: new Date().toISOString(),
    customerId,
    items: items.map(toInvoiceItem),
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

export interface InvoiceDraft {
  items: DraftItem[]
  transactionType: TransactionType
  setTransactionType: (type: TransactionType) => void
  customerId: string | undefined
  customerName: string | undefined
  subtotal: number
  total: number
  addItem: (item: Omit<DraftItem, 'key'>) => void
  updateItem: (key: string, patch: Partial<DraftItem>) => void
  removeItem: (key: string) => void
  setCustomer: (id: string | undefined, name: string | undefined) => void
  build: (currency: CurrencyCode) => CreateInvoice
}

export function useInvoiceDraft(): InvoiceDraft {
  const [items, setItems] = useState<DraftItem[]>([])
  const [transactionType, setTransactionType] = useState<TransactionType>('sale')
  const [customerId, setCustomerId] = useState<string | undefined>(undefined)
  const [customerName, setCustomerName] = useState<string | undefined>(undefined)

  const subtotal = useMemo(() => subtotalOf(items), [items])

  const addItem = useCallback((item: Omit<DraftItem, 'key'>) => {
    setItems((prev) => [...prev, { ...item, key: `${Date.now()}-${prev.length}` }])
  }, [])

  const updateItem = useCallback((key: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }, [])

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key))
  }, [])

  const setCustomer = useCallback((id: string | undefined, name: string | undefined) => {
    setCustomerId(id)
    setCustomerName(name)
  }, [])

  const build = useCallback(
    (currency: CurrencyCode): CreateInvoice =>
      buildInvoice(items, currency, customerId, transactionType),
    [customerId, items, transactionType],
  )

  return {
    items,
    transactionType,
    setTransactionType,
    customerId,
    customerName,
    subtotal,
    total: subtotal,
    addItem,
    updateItem,
    removeItem,
    setCustomer,
    build,
  }
}

function toInvoiceItem(item: DraftItem): InvoiceItem {
  return {
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unit: item.unit ?? 'piece',
    ...(item.unit === 'custom' && item.unitLabel?.trim()
      ? { unitLabel: item.unitLabel.trim() }
      : {}),
    ...(item.weightGrams ? { weightGrams: item.weightGrams } : {}),
    unitPrice: item.unitPrice,
    discount: item.discount,
    totalPrice: lineTotal(item),
    details: (item.details ?? [])
      .filter((d) => d.title.trim())
      .map((d, index) => ({
        title: d.title.trim(),
        quantity: d.quantity,
        amount: d.amount,
        sortOrder: index,
      })),
  } as InvoiceItem
}
