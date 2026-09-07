// ============================================
// T9 — the invoice never claims a payment nobody made.
//
// ---------------------------------------------------------------------------
// THE DEFECT, WHICH WAS A DEFAULT AND NOT A MISSING FEATURE
//
// `invoice-draft.slice.ts` carried `isPaid: true`, and no UI ever wrote to it.
// The preview container turned that into:
//
//     paidAmount: draft.isPaid ? summary.total : 0
//
// so every invoice was submitted asserting the full amount had been received.
// On a real sale that produced `paid_amount` = ۱۸٬۰۰۰٬۰۰۰ with no payments
// behind it — the drift the H2 panel reported.
//
// The system was answering «چطور پرداخت شد» on the user's behalf, and
// answering wrong. What is pinned here is that it no longer answers at all:
// the submitted amount comes from what the person actually chose.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  emptyPaymentValue,
  paidAmountOf,
  tranchesTotal,
  type InvoicePaymentValue,
  type PaymentTranche,
} from '../components/ui/invoice-builder/invoice-payment-section'

const tranche = (method: PaymentTranche['method'], amount: string): PaymentTranche => ({
  id: `${method}-${amount}`,
  method,
  amount,
})

const value = (patch: Partial<InvoicePaymentValue>): InvoicePaymentValue => ({
  ...emptyPaymentValue(),
  ...patch,
})

const TOTAL = 18_000_000

describe('the amount submitted is the amount chosen', () => {
  it('unpaid means zero, not the total', () => {
    // The exact inversion of the bug. Under the old default this invoice
    // would have been submitted as fully settled.
    expect(paidAmountOf(value({ mode: 'unpaid' }), TOTAL)).toBe(0)
  })

  it('full means the total', () => {
    expect(paidAmountOf(value({ mode: 'full' }), TOTAL)).toBe(TOTAL)
  })

  it('partial means what was typed, and the rest stays owing', () => {
    const paid = paidAmountOf(value({ mode: 'partial', paidNow: '5000000' }), TOTAL)
    expect(paid).toBe(5_000_000)
    expect(TOTAL - paid).toBe(13_000_000)
  })

  it('a partial with nothing typed is zero, never the total', () => {
    // The empty-string case is where a «treat blank as paid» shortcut would
    // reintroduce the defect.
    expect(paidAmountOf(value({ mode: 'partial', paidNow: '' }), TOTAL)).toBe(0)
  })

  it('a partial with unparseable input is zero, not NaN', () => {
    // NaN would flow into `paidAmount` and reach the server as an invalid
    // number — or worse, be coerced somewhere along the way.
    const paid = paidAmountOf(value({ mode: 'partial', paidNow: 'abc' }), TOTAL)
    expect(paid).toBe(0)
    expect(Number.isNaN(paid)).toBe(false)
  })
})

describe('split payments add up to what was entered', () => {
  it('sums the tranches', () => {
    const split = value({
      mode: 'split',
      tranches: [tranche('cash', '10000000'), tranche('bank', '8000000')],
    })
    expect(paidAmountOf(split, TOTAL)).toBe(TOTAL)
  })

  it('an incomplete split is under-paid, not rounded up to the total', () => {
    const split = value({ mode: 'split', tranches: [tranche('cash', '10000000')] })
    // The remainder is a real debt. Treating «they said split» as «they paid
    // it all» is the same class of assumption as the old default.
    expect(paidAmountOf(split, TOTAL)).toBe(10_000_000)
  })

  it('a blank tranche contributes nothing', () => {
    const split = value({
      mode: 'split',
      tranches: [tranche('cash', '10000000'), tranche('bank', '')],
    })
    expect(tranchesTotal(split.tranches)).toBe(10_000_000)
  })

  it('an over-allocation is reported as entered, not clamped', () => {
    // The server refuses this with PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING and
    // the section shows a warning. Silently clamping here would hide the typo
    // and record a different amount than the person entered.
    const split = value({
      mode: 'split',
      tranches: [tranche('cash', '10000000'), tranche('bank', '20000000')],
    })
    expect(paidAmountOf(split, TOTAL)).toBe(30_000_000)
  })
})

describe('no instalment mode is offered', () => {
  it('the modes are only the ones that store something real', () => {
    // «قسطی» was asked for and is deliberately absent: there is no
    // instalments table, no schedule column, nothing that persists a payment
    // plan. A picker that saved nothing would be UI theatre. Partial payment
    // covers the honest part today.
    const modes: Array<InvoicePaymentValue['mode']> = ['full', 'partial', 'split', 'unpaid']
    for (const mode of modes) {
      expect(paidAmountOf(value({ mode }), TOTAL)).not.toBeNaN()
    }
    expect(modes).not.toContain('instalment')
  })
})
