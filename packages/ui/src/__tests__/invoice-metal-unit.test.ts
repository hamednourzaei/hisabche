// A gold invoice typed in kilograms reaches the books in grams — rate, price,
// equivalent and payload all crossing the unit the same way.
import { afterEach, describe, expect, it } from 'vitest'
import { setMetalDisplayUnit } from '@hisabche/formatting'

import { exchangeRateOf, inBooksAtRate, priceForInvoice } from '../lib/invoices/exchange-rate'
import { invoiceInStoredMetal } from '../lib/invoices/metal-amounts'

afterEach(() => setMetalDisplayUnit('g'))

describe('metal units on an invoice', () => {
  it('a rate typed per kilogram is stored per gram', () => {
    setMetalDisplayUnit('kg')
    // Books in gold, invoice in afghani: «7,500,000,000 afghani = 1 kg gold».
    const rate = exchangeRateOf('7500000000', '1', 'AFN', 'XAU')
    // 1 afghani = 1/7,500,000 GRAM.
    expect(rate).toBeCloseTo(1 / 7_500_000, 15)
  })

  it('25,000,000 afghani is 3.333 g of gold — shown as 0.003333 kg (to the milligram)', () => {
    setMetalDisplayUnit('kg')
    const rate = exchangeRateOf('7500000000', '1', 'AFN', 'XAU')
    expect(inBooksAtRate(25_000_000, rate, 'XAU', 'AFN')).toBe(0.003333)
  })

  it('a product priced in grams goes on a kilogram gold invoice divided by 1,000', () => {
    setMetalDisplayUnit('kg')
    expect(priceForInvoice('2500', 'XAU', 'XAU', null)).toBe('2.5')
  })

  it('the payload carries grams; an afghani invoice is untouched', () => {
    setMetalDisplayUnit('kg')
    const gold = invoiceInStoredMetal({
      currency: 'XAU',
      subtotal: 2,
      discountTotal: 0,
      taxTotal: 0,
      total: 2,
      paidAmount: 1,
      payments: [{ amount: 1 }],
      items: [{ unitPrice: 0.5, totalPrice: 2, details: [{ amount: 0.1 }] }],
    })
    expect(gold.total).toBe(2_000)
    expect(gold.paidAmount).toBe(1_000)
    expect(gold.payments?.[0]?.amount).toBe(1_000)
    expect(gold.items[0]?.unitPrice).toBe(500)
    expect(gold.items[0]?.details?.[0]?.amount).toBe(100)

    const afghani = {
      currency: 'AFN',
      subtotal: 2,
      discountTotal: 0,
      taxTotal: 0,
      total: 2,
      items: [],
    }
    expect(invoiceInStoredMetal(afghani)).toBe(afghani)
  })
})
