'use client'

// Lines of a SALE that would take a warehouse product below zero.
//
// ⚠️ A WARNING, NOT A BLOCK. The owner asked to be TOLD when a sale drives a
// product negative — goods do get sold before the purchase is entered — so the
// save still goes through. What must not happen is it going through silently,
// which is how «kartoon» reached -98 with nobody noticing.
//
// ⚠️ ONE CHECK, TWO SCREENS. This used to live only on the preview page, so a
// quantity typed on /invoices/new above the stock showed nothing until "next"
// — and the check read `useProducts({ limit: 100 })`, so any product past the
// first hundred was never checked at all. The form and the preview now call
// this hook; stock comes from each linked product's own detail query.
//
// ⚠️ ONLY WHEN THE UNITS AGREE. A line in grams against stock counted in
// kilograms cannot be compared by raw number; rather than raise a false alarm,
// such a line is not judged. Lines for the same product are summed: two lines
// of 60 against a stock of 100 is an oversell neither line shows on its own.
import { useMemo } from 'react'
import { useProductsByIds } from '@hisabche/api'

export interface OversoldLine {
  productId: string
  name: string
  onHand: number
  after: number
}

interface LineLike {
  productId?: string | undefined
  productName: string
  quantity: number | string
  unit?: string | undefined
}

interface StockLike {
  quantity?: number | null
  unit?: string | null
}

/** Pure part, exported for tests. */
export function findOversoldLines(
  items: readonly LineLike[],
  stockById: ReadonlyMap<string, StockLike>,
): OversoldLine[] {
  const wanted = new Map<string, { name: string; quantity: number; unit: string | undefined }>()
  for (const item of items) {
    if (!item.productId) continue
    const current = wanted.get(item.productId)
    wanted.set(item.productId, {
      name: current?.name ?? item.productName,
      quantity: (current?.quantity ?? 0) + (Number(item.quantity) || 0),
      unit: item.unit,
    })
  }
  const result: OversoldLine[] = []
  for (const [productId, line] of wanted) {
    const product = stockById.get(productId)
    if (!product || typeof product.quantity !== 'number') continue
    if (line.unit && product.unit && line.unit !== product.unit) continue
    const after = product.quantity - line.quantity
    if (after < 0) result.push({ productId, name: line.name, onHand: product.quantity, after })
  }
  return result
}

export function useOversoldLines(
  items: readonly LineLike[],
  transactionType: string | undefined,
): OversoldLine[] {
  const ids = useMemo(
    () => [...new Set(items.map((item) => item.productId).filter((id): id is string => !!id))],
    [items],
  )
  const results = useProductsByIds(transactionType === 'purchase' ? [] : ids)
  if (transactionType === 'purchase') return []

  // A handful of lines — cheaper to recompute than to memoise on a query array
  // that is a new object every render.
  const stock = new Map<string, StockLike>()
  results.forEach((result, index) => {
    const id = ids[index]
    if (id && result.data) stock.set(id, result.data as StockLike)
  })
  return findOversoldLines(items, stock)
}
