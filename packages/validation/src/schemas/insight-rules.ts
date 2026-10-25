// ============================================
// packages/validation/src/schemas/insight-rules.ts
//
// The dashboard's smart suggestions — the RULES, once.
//
// ⚠️ ONE RULE, TWO READERS. The server (`AIService.getInsights`) reads Postgres
// and the offline engine reads the device's SQLite; both hand the rows to
// `buildInsights`, so a suggestion can never be worded or counted differently
// on the device than in the cloud (the same shape of fix as the role rule and
// the branch domain).
//
// Each suggestion is a CODE with numbers and the books currency — never a
// sentence. The screen writes it in the reader's language and digits (live
// audit #74). Money sums are sales in the books currency only: a dollar invoice
// is never added to an afghani one.
// ============================================

import type { AIInsight } from './ai.schema'

export interface InsightProduct {
  name: string
  quantity: number | string | null
  min_stock_level: number | string | null
  buy_price: number | string | null
}

export interface InsightSale {
  total: number | string | null
  paid_amount?: number | string | null
  currency?: string | null
}

export interface InsightInput {
  /** Active products. */
  products: readonly InsightProduct[]
  /** Every sale that is not cancelled. */
  sales: readonly InsightSale[]
  /** The sales of the last seven days. */
  weekSales: readonly InsightSale[]
  /** The books currency — the only one money is summed in. */
  booksCurrency: string
}

const n = (value: number | string | null | undefined): number => Number(value) || 0

export function buildInsights(input: InsightInput): AIInsight[] {
  const { products, sales, weekSales, booksCurrency } = input
  const insights: AIInsight[] = []

  const inBooks = (row: { currency?: string | null }) =>
    !row.currency || row.currency === booksCurrency
  const money = (code: string, type: AIInsight['type'], action: string, amount: number) =>
    insights.push({
      type,
      code,
      title: code,
      description: code,
      action,
      values: { amount },
      currency: booksCurrency,
    } as AIInsight)
  const count = (
    code: string,
    type: AIInsight['type'],
    action: string,
    total: number,
    extra: Record<string, number | string> = {},
  ) =>
    insights.push({
      type,
      code,
      title: code,
      description: code,
      action,
      values: { count: total, ...extra },
    } as AIInsight)

  const lowStock = products.filter((p) => n(p.quantity) <= n(p.min_stock_level))
  if (lowStock.length > 0) count('lowStock', 'warning', '/warehouse', lowStock.length)

  const owed = (sale: InsightSale) => Math.max(0, n(sale.total) - n(sale.paid_amount))
  const unpaidCount = sales.filter((sale) => owed(sale) > 0).length
  if (unpaidCount > 0) count('unpaid', 'info', '/invoices', unpaidCount)

  const weekTotal = weekSales.filter(inBooks).reduce((sum, sale) => sum + n(sale.total), 0)
  if (weekTotal > 0) money('weekSales', 'tip', '/dashboard', weekTotal)

  const salesInBooks = sales.filter(inBooks)
  const outstanding = salesInBooks.reduce((sum, sale) => sum + owed(sale), 0)
  if (outstanding > 0) money('outstanding', 'warning', '/customers', outstanding)

  const outOfStock = products.filter((p) => n(p.quantity) <= 0)
  if (outOfStock.length > 0) {
    count('outOfStock', 'warning', '/warehouse', outOfStock.length, {
      names: outOfStock
        .slice(0, 3)
        .map((p) => p.name)
        .join('، '),
    })
  }

  // Valued at what was PAID for it (buy price), never the selling price.
  const stockValue = products.reduce(
    (sum, p) => sum + Math.max(0, n(p.quantity)) * n(p.buy_price),
    0,
  )
  if (stockValue > 0) money('stockValue', 'info', '/warehouse', stockValue)

  if (salesInBooks.length > 0) {
    const average = salesInBooks.reduce((sum, sale) => sum + n(sale.total), 0) / salesInBooks.length
    money('averageSale', 'tip', '/invoices', average)
  }

  insights.push({
    type: 'tip',
    code: 'tip',
    title: 'tip',
    description: 'tip',
    action: '/accounting',
  } as AIInsight)

  return insights
}
