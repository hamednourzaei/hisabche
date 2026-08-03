// ============================================
// Invoice draft — line-item maths kept out of the screen.
// Validated with the shared createInvoiceSchema before submit.
// ============================================

import { useCallback, useMemo, useState } from 'react'
import type { CreateInvoice, InvoiceItem } from '@hisabche/validation'
import type { CurrencyCode } from '@hisabche/store'

export interface DraftItem {
  key: string
  productId?: string | undefined
  productName: string
  quantity: number
  unitPrice: number
  discount: number
}

export function lineTotal(item: DraftItem): number {
  return item.quantity * item.unitPrice * (1 - item.discount / 100)
}

export function subtotalOf(items: DraftItem[]): number {
  return items.reduce((sum, item) => sum + lineTotal(item), 0)
}

/** Pure payload builder — kept outside the hook so it is directly testable. */
export function buildInvoice(
  items: DraftItem[],
  currency: CurrencyCode,
  customerId?: string | undefined
): CreateInvoice {
  const subtotal = subtotalOf(items)

  return {
    type: 'sale',
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
    (currency: CurrencyCode): CreateInvoice => buildInvoice(items, currency, customerId),
    [customerId, items]
  )

  return {
    items,
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
    unitPrice: item.unitPrice,
    discount: item.discount,
    totalPrice: lineTotal(item),
  } as InvoiceItem
}
