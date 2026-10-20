// ============================================
// The payments rules — allocation, posting and party balances, as the shared
// package computes them.
//
// ⚠️ WHY THIS FILE EXISTS. Phase 2 of the offline edition moved these rules out
// of `backend/src/services/payments/payments.domain.ts` so the device can settle
// a payment with no server to ask. If the device and the server disagree by one
// unit, a customer's debt is wrong on one of them and nobody can tell which.
//
// ⚠️ EVERY MONEY FIXTURE USES TWO CURRENCIES, and the results are asserted as
// exact numbers — never with a tolerance. A one-unit tolerance on a balance is
// a bug that reports as «equal».
//
// The two currencies are deliberately NOT both 2-decimal: AFN is written with
// no minor unit and IQD with three, so a fixture that only ever used USD would
// hide a rounding boundary the other two actually have.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  autoAllocate,
  majorToTillMinor,
  minor,
  openInvoices,
  outstandingOf,
  partyBalancesByCurrency,
  paymentPosting,
  settlesInCurrency,
  tillAmountMinor,
  tillMinorToMajor,
  unallocatedOf,
  validateAllocations,
  type LedgerMovement,
  type OpenInvoice,
} from '../schemas/payments.domain'

/** An open invoice, in the currency named. Two helpers, because two is the point. */
const afn = (id: string, total: number): OpenInvoice => ({
  invoiceId: id,
  invoiceNumber: id,
  total,
  allocated: 0,
  dueDate: '2026-10-01',
  invoiceDate: '2026-09-01',
  currency: 'AFN',
})

const usd = (id: string, total: number): OpenInvoice => ({
  invoiceId: id,
  invoiceNumber: id,
  total,
  allocated: 0,
  dueDate: '2026-10-02',
  invoiceDate: '2026-09-02',
  currency: 'USD',
})

describe('settlesInCurrency — 100 afghani does not pay a 100-dollar debt', () => {
  it('refuses a payment in another currency', () => {
    expect(settlesInCurrency({ currency: 'USD' }, 'AFN', 'AFN')).toBe(false)
    expect(settlesInCurrency({ currency: 'AFN' }, 'USD', 'USD')).toBe(false)
  })

  it('accepts it in the invoice’s own currency', () => {
    expect(settlesInCurrency({ currency: 'USD' }, 'USD', 'AFN')).toBe(true)
    expect(settlesInCurrency({ currency: 'AFN' }, 'AFN', 'USD')).toBe(true)
  })

  it('treats an invoice with no currency as the books currency', () => {
    expect(settlesInCurrency({ currency: null }, 'AFN', 'AFN')).toBe(true)
    expect(settlesInCurrency({ currency: null }, 'USD', 'AFN')).toBe(false)
    expect(settlesInCurrency({}, 'IQD', 'IQD')).toBe(true)
  })
})

describe('outstandingOf and the open list', () => {
  it('is total minus everything allocated, never the stored paid_amount', () => {
    const invoice = { ...usd('i1', 1000), allocated: 250 }
    expect(outstandingOf(invoice)).toBe(750)
    // A payment that over-settles leaves nothing owed, not a negative debt.
    expect(outstandingOf({ ...afn('i2', 1000), allocated: 1000 })).toBe(0)
  })

  it('orders by due date and keeps only what is still owed', () => {
    const later = { ...usd('later', 50), dueDate: '2026-11-01' }
    const earlier = { ...afn('earlier', 50), dueDate: '2026-10-01' }
    const settled = { ...afn('settled', 50), allocated: 50, dueDate: '2026-09-01' }
    expect(openInvoices([later, settled, earlier]).map((i) => i.invoiceId)).toEqual([
      'earlier',
      'later',
    ])
  })
})

describe('autoAllocate — «he paid me 500»', () => {
  it('empties the oldest first and leaves the rest as an advance', () => {
    const result = autoAllocate(500, [afn('a', 300), afn('b', 300)])
    expect(result.allocations).toEqual([
      { invoiceId: 'a', amount: 300 },
      { invoiceId: 'b', amount: 200 },
    ])
    expect(result.unallocated).toBe(0)

    const advance = autoAllocate(500, [usd('a', 300)])
    expect(advance.allocations).toEqual([{ invoiceId: 'a', amount: 300 }])
    expect(advance.unallocated).toBe(200)
    expect(minor(advance.unallocated)).toBe(20000)
  })

  it('counts an unapplied part exactly, in minor units', () => {
    expect(unallocatedOf(500, [{ invoiceId: 'a', amount: 300 }])).toBe(200)
    expect(unallocatedOf(0.3, [{ invoiceId: 'a', amount: 0.1 }])).toBe(0.2)
  })
})

describe('validateAllocations — every reason it may not be recorded', () => {
  const invoices = [afn('a', 1000), usd('b', 500)]

  it('accepts a legal, fully-allocated payment in either currency', () => {
    expect(validateAllocations(1000, [{ invoiceId: 'a', amount: 1000 }], invoices)).toEqual([])
    expect(validateAllocations(500, [{ invoiceId: 'b', amount: 500 }], invoices)).toEqual([])
  })

  it('refuses two rows against one invoice', () => {
    expect(
      validateAllocations(
        1000,
        [
          { invoiceId: 'a', amount: 600 },
          { invoiceId: 'a', amount: 400 },
        ],
        invoices,
      ),
    ).toEqual(['PAYMENT_ALLOCATION_DUPLICATE'])
  })

  it('refuses an allocation larger than the invoice is owed', () => {
    expect(validateAllocations(2000, [{ invoiceId: 'a', amount: 1500 }], invoices)).toEqual([
      'PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING',
    ])
  })

  it('refuses a total larger than the payment', () => {
    expect(
      validateAllocations(
        500,
        [
          { invoiceId: 'a', amount: 300 },
          { invoiceId: 'b', amount: 300 },
        ],
        invoices,
      ),
    ).toEqual(['PAYMENT_OVER_ALLOCATED'])
  })

  it('refuses an amount that is not money at all', () => {
    // The payment is zero AND the allocation is more than the payment: both
    // defects are reported, because both are true.
    expect(validateAllocations(0, [{ invoiceId: 'a', amount: 1 }], invoices)).toEqual([
      'PAYMENT_AMOUNT_INVALID',
      'PAYMENT_OVER_ALLOCATED',
    ])
  })

  it('names an unknown invoice and an invalid amount with different codes', () => {
    expect(validateAllocations(100, [{ invoiceId: 'zz', amount: 1 }], invoices)).toEqual([
      'PAYMENT_ALLOCATION_INVOICE_UNKNOWN',
    ])
    expect(validateAllocations(100, [{ invoiceId: 'a', amount: 0 }], invoices)).toEqual([
      'PAYMENT_ALLOCATION_AMOUNT_INVALID',
    ])
  })
})

describe('paymentPosting — the exchange difference is its own line', () => {
  it('books a gain when the payment rate is above the invoice rate (AFN books)', () => {
    // A 100 USD invoice was booked at 70 (7,000 AFN); the money arrives at 72.
    const posting = paymentPosting({
      direction: 'in',
      amount: 100,
      paymentRate: 72,
      allocations: [{ amount: 100, rate: 70 }],
    })
    expect(posting).toEqual({ cash: 7200, party: 7000, difference: 200, fee: 0 })
    // The books currency is AFN: a whole number, not a fraction of an afghani.
    expect(posting.cash).toBe(7200)
  })

  it('books a loss when it is below (USD books, EUR payment)', () => {
    const posting = paymentPosting({
      direction: 'in',
      amount: 200,
      paymentRate: 1.05,
      allocations: [{ amount: 200, rate: 1.1 }],
    })
    expect(posting.cash).toBe(210)
    expect(posting.party).toBe(220)
    expect(posting.difference).toBe(-10)
    expect(minor(posting.difference)).toBe(-1000)
  })

  it('money out flips the sign of the difference', () => {
    const gain = paymentPosting({
      direction: 'out',
      amount: 100,
      paymentRate: 68,
      allocations: [{ amount: 100, rate: 70 }],
    })
    // We owed 7,000 and paid 6,800: 200 saved.
    expect(gain).toEqual({ cash: 6800, party: 7000, difference: 200, fee: 0 })

    const loss = paymentPosting({
      direction: 'out',
      amount: 100,
      paymentRate: 72,
      allocations: [{ amount: 100, rate: 70 }],
    })
    expect(loss).toEqual({ cash: 7200, party: 7000, difference: -200, fee: 0 })
  })

  it('a fee is a cost, never folded into the exchange difference', () => {
    const posting = paymentPosting({
      direction: 'in',
      amount: 100,
      paymentRate: 70,
      fee: 3,
      allocations: [{ amount: 100, rate: 70 }],
    })
    // Cash moves by 100 − 3 dollars; the debt is still closed by the full 100.
    expect(posting).toEqual({ cash: 6790, party: 7000, difference: 0, fee: 210 })
  })

  it('an advance has no earlier rate to differ from, so it claims no difference', () => {
    const posting = paymentPosting({
      direction: 'in',
      amount: 150,
      paymentRate: 72,
      allocations: [{ amount: 100, rate: 70 }],
    })
    // 100 settled at the invoice's 70 plus 50 of advance at the payment's 72.
    expect(posting.party).toBe(10600)
    expect(posting.cash).toBe(10800)
    expect(posting.difference).toBe(200)
  })

  it('when every rate is the same, rounding line by line invents nothing', () => {
    const posting = paymentPosting({
      direction: 'in',
      amount: 0.1,
      paymentRate: 1,
      allocations: [{ amount: 0.1, rate: 1 }],
    })
    expect(posting).toEqual({ cash: 0.1, party: 0.1, difference: 0, fee: 0 })
  })

  it('a null allocation rate closes at the payment’s rate', () => {
    const posting = paymentPosting({
      direction: 'in',
      amount: 100,
      paymentRate: 70,
      allocations: [{ amount: 100, rate: null }],
    })
    expect(posting.difference).toBe(0)
    expect(posting.party).toBe(7000)
  })
})

describe('partyBalancesByCurrency — never one figure across currencies', () => {
  const movements: LedgerMovement[] = [
    { date: '2026-09-01', kind: 'sale', amount: 1000, reference: 's1', currency: 'AFN' },
    { date: '2026-09-02', kind: 'sale', amount: 100, reference: 's2', currency: 'USD' },
    { date: '2026-09-03', kind: 'payment_in', amount: 400, reference: 'p1', currency: 'AFN' },
  ]

  it('groups by currency and puts the books currency first', () => {
    const balances = partyBalancesByCurrency(movements, 'AFN')
    expect(balances).toEqual([
      { currency: 'AFN', balance: 600 },
      { currency: 'USD', balance: 100 },
    ])
    // ⚠️ The defect this replaces: 1,100 — a number of nothing.
    expect(balances.map((b) => b.balance)).not.toContain(1100)
  })

  it('a movement naming no currency is in the books currency', () => {
    const balances = partyBalancesByCurrency(
      [
        { date: '2026-09-01', kind: 'sale', amount: 500, reference: 's1' },
        { date: '2026-09-02', kind: 'sale', amount: 100, reference: 's2', currency: 'USD' },
      ],
      'AFN',
    )
    expect(balances).toEqual([
      { currency: 'AFN', balance: 500 },
      { currency: 'USD', balance: 100 },
    ])
  })

  it('the opening balance belongs to the books currency', () => {
    const balances = partyBalancesByCurrency(
      [{ date: '2026-09-02', kind: 'sale', amount: 100, reference: 's2', currency: 'USD' }],
      'AFN',
      250,
    )
    expect(balances).toEqual([
      { currency: 'AFN', balance: 250 },
      { currency: 'USD', balance: 100 },
    ])
  })

  it('a receipt reduces what they owe — it never increases it', () => {
    const balances = partyBalancesByCurrency(
      [
        { date: '2026-09-01', kind: 'sale', amount: 1000, reference: 's1', currency: 'USD' },
        { date: '2026-09-02', kind: 'payment_in', amount: 1000, reference: 'p1', currency: 'USD' },
      ],
      'USD',
    )
    expect(balances).toEqual([{ currency: 'USD', balance: 0 }])
  })
})

describe('till amount — in the till’s own minor units', () => {
  it('counts an afghani till in afghanis, not in hundredths', () => {
    // ⚠️ The live defect (14 Oct): a 2,000 AFN cash payment became 200,000.
    expect(majorToTillMinor(2000, 'AFN')).toBe(2000)
    expect(majorToTillMinor(100, 'USD')).toBe(10000)
    expect(majorToTillMinor(1005, 'IQD')).toBe(1005000)
    expect(tillMinorToMajor(1005000, 'IQD')).toBe(1005)
  })

  it('converts a foreign payment into a books-currency till at its rate', () => {
    // 100 USD at 70 into an AFN drawer: 7,000 afghani in the drawer.
    expect(
      tillAmountMinor({
        amount: 100,
        currency: 'USD',
        tillCurrency: 'AFN',
        bookCurrency: 'AFN',
        rate: 70,
      }),
    ).toBe(7000)
  })

  it('puts a payment straight into a till of its own currency', () => {
    expect(
      tillAmountMinor({
        amount: 100,
        currency: 'USD',
        tillCurrency: 'USD',
        bookCurrency: 'AFN',
        rate: 70,
      }),
    ).toBe(10000)
  })

  it('refuses to put a toman payment in a dollar drawer', () => {
    // There is no rate between two foreign currencies here, and inventing one
    // would put a made-up figure in a drawer somebody counts.
    expect(
      tillAmountMinor({
        amount: 100,
        currency: 'IRT',
        tillCurrency: 'USD',
        bookCurrency: 'AFN',
        rate: 70,
      }),
    ).toBeNull()
    expect(
      tillAmountMinor({
        amount: 0,
        currency: 'USD',
        tillCurrency: 'USD',
        bookCurrency: 'AFN',
        rate: 70,
      }),
    ).toBeNull()
  })
})
