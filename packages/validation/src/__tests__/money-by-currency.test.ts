// ============================================
// Money is added currency by currency — never one figure across them.
//
// ⚠️ WHY THIS FILE EXISTS. The supplier 360 screen reported «total purchased» as
// `Σ total` over every purchase invoice and «outstanding» as `Σ outstanding`
// over every open one, whichever currency each carried. A supplier invoiced
// 1,000 AFN and 100 USD was shown «1,100» — a number that belongs to no
// currency and cannot be paid, reconciled or audited.
//
// The fixtures use TWO currencies on purpose, and the numbers are asserted
// exactly: a tolerance on money hides the defect it is meant to catch.
// ============================================

import { describe, expect, it } from 'vitest'

import { bookCurrencyTotalOf, sumMoneyByCurrency } from '../schemas/payments.domain'

describe('sumMoneyByCurrency', () => {
  it('never adds two currencies into one figure', () => {
    const buckets = sumMoneyByCurrency(
      [
        { currency: 'AFN', amount: 1000 },
        { currency: 'USD', amount: 100 },
        { currency: 'AFN', amount: 250 },
      ],
      'AFN',
    )

    expect(buckets).toEqual([
      { currency: 'AFN', total: 1250 },
      { currency: 'USD', total: 100 },
    ])
    // The whole point: there is no bucket that sums to 1350.
    expect(buckets.some((bucket) => bucket.total === 1350)).toBe(false)
  })

  it('treats a row with no currency as the books currency', () => {
    const buckets = sumMoneyByCurrency([{ currency: null, amount: 40 }, { amount: 60 }], 'AFN')
    expect(buckets).toEqual([{ currency: 'AFN', total: 100 }])
  })

  it('always answers for the books currency, even when nothing happened in it', () => {
    // A zero in the books currency is an ANSWER («nothing owed here»); an absent
    // bucket would read as «could not be read», which is a different thing.
    const buckets = sumMoneyByCurrency([{ currency: 'USD', amount: 70 }], 'AFN')
    expect(buckets).toEqual([
      { currency: 'AFN', total: 0 },
      { currency: 'USD', total: 70 },
    ])
  })

  it('rounds each currency once, at the end', () => {
    const buckets = sumMoneyByCurrency(
      [
        { currency: 'AFN', amount: 0.005 },
        { currency: 'AFN', amount: 0.005 },
        { currency: 'AFN', amount: 0.005 },
      ],
      'AFN',
    )
    // 0.015 rounded once is 0.02. Rounding each row first gives 0.03 — a real
    // difference a per-row round would introduce on a year of invoices.
    expect(buckets).toEqual([{ currency: 'AFN', total: 0.02 }])
  })
})

describe('bookCurrencyTotalOf', () => {
  it('reads the books-currency bucket and nothing else', () => {
    const buckets = [
      { currency: 'AFN', total: 1250 },
      { currency: 'USD', total: 100 },
    ]
    expect(bookCurrencyTotalOf(buckets, 'AFN')).toBe(1250)
    expect(bookCurrencyTotalOf(buckets, 'USD')).toBe(100)
  })

  it('answers zero for a currency that has no bucket, never a guess', () => {
    expect(bookCurrencyTotalOf([{ currency: 'USD', total: 100 }], 'AFN')).toBe(0)
  })
})
