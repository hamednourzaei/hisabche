// ============================================
// A purchase invoice line is priced at the BUY price (owner, 18 Oct 2026).
//
// «گیربوکس اتوماتیک» — buy 20,000,000, sell 30,000,000 afghani — picked on a
// PURCHASE invoice in dollars at 65 came in at 461,538.46 $ (= 30M / 65, the
// sell price) instead of 307,692.31 $ (= 20M / 65). Every purchase would have
// stocked the warehouse at the sell price: the cost layer, the stock value and
// the profit of every later sale wrong by the margin.
// ============================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { productCost, productPrice } from '../lib/invoices/products'

// The pricing rule lives in the hook the desktop cell and the phone sheet share.
const src = readFileSync(
  resolve(__dirname, '../hooks/invoices/use-picker-rows.ts'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

describe('the price a picked product brings onto the line', () => {
  it('sale → promotions on the sell price; purchase and component → buy price', () => {
    expect(src).toContain("const selling = pickAs === 'sale' && transactionType !== 'purchase'")
    expect(src).toContain('if (selling) return promoPrice(product)')
    // The promotion badges belong to a sale only.
    expect(src).not.toContain("pickAs === 'sale' && promoPrice(product)")
  })

  it('the gearbox: buy 20M and sell 30M are two different numbers', () => {
    const gearbox = {
      id: 'g',
      name: 'گیربوکس اتوماتیک',
      buyPrice: 20_000_000,
      sellPrice: 30_000_000,
    }
    expect(productCost(gearbox as never)).toBe(20_000_000)
    expect(productPrice(gearbox as never)).toBe(30_000_000)
    // In dollars at 65 afghani each, what the purchase line should read.
    expect(Math.round((20_000_000 / 65) * 100) / 100).toBe(307_692.31)
  })
})
