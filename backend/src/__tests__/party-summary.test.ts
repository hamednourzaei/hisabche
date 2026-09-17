// Customer 360 money summary (payments.domain#summarizeParty) and the statement
// reader it depends on.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  summarizeParty,
  type SummaryInvoice,
  type SummaryPayment,
} from '../services/payments/payments.domain'

const inv = (over: Partial<SummaryInvoice>): SummaryInvoice => ({
  id: 'i',
  type: 'sale',
  status: 'pending',
  total: 0,
  paidAmount: 0,
  invoiceDate: '2026-09-01',
  dueDate: '',
  currency: 'IRR',
  ...over,
})
const pay = (over: Partial<SummaryPayment>): SummaryPayment => ({
  direction: 'in',
  amount: 0,
  entryDate: '2026-09-02',
  currency: 'IRR',
  ...over,
})

describe('summarizeParty', () => {
  const asOf = '2026-09-17'

  it('the reported case: a fully paid invoice leaves nothing receivable', () => {
    const summary = summarizeParty(
      [inv({ id: 'a', total: 3_000_000, paidAmount: 3_000_000 })],
      [pay({ amount: 3_000_000 })],
      asOf,
    )
    expect(summary.receivable).toBe(0)
    expect(summary.totalSales).toBe(3_000_000)
    expect(summary.totalReceived).toBe(3_000_000)
    expect(summary.openInvoiceCount).toBe(0)
  })

  it('splits what is owed into overdue, due today and due later', () => {
    const summary = summarizeParty(
      [
        inv({ id: 'a', total: 500, paidAmount: 100, dueDate: '2026-09-10' }),
        inv({ id: 'b', total: 200, dueDate: asOf }),
        inv({ id: 'c', total: 300, dueDate: '2026-10-01' }),
      ],
      [],
      asOf,
    )
    expect(summary).toMatchObject({
      receivable: 900,
      overdue: 400,
      dueToday: 200,
      dueLater: 300,
      overdueInvoiceCount: 1,
      openInvoiceCount: 3,
    })
    expect(summary.aging.days1to30).toBe(400)
    expect(summary.aging.total).toBe(900)
  })

  it('a cancelled invoice is not debt and is not counted', () => {
    const summary = summarizeParty(
      [inv({ id: 'a', total: 1000, status: 'cancelled' }), inv({ id: 'b', total: 50 })],
      [],
      asOf,
    )
    expect(summary.receivable).toBe(50)
    expect(summary.totalSales).toBe(50)
    expect(summary.invoiceCount).toBe(1)
  })

  it('keeps what they owe us apart from what we owe them', () => {
    const summary = summarizeParty(
      [inv({ id: 'a', total: 500 }), inv({ id: 'b', type: 'purchase', total: 80 })],
      [pay({ direction: 'out', amount: 0 })],
      asOf,
    )
    expect(summary).toMatchObject({ receivable: 500, payable: 80, netBalance: 420 })
  })

  it('includes the customer opening balance in what they owe', () => {
    const owes = summarizeParty([inv({ id: 'a', total: 100 })], [], asOf, 250)
    expect(owes).toMatchObject({ openingBalance: 250, receivable: 350, netBalance: 350 })
    // A negative opening balance is money we owe them.
    const credit = summarizeParty([], [], asOf, -40)
    expect(credit).toMatchObject({ receivable: 0, payable: 40, netBalance: -40 })
  })

  it('reports every currency so mixed totals are visible', () => {
    const summary = summarizeParty(
      [inv({ id: 'a', total: 1, currency: 'AFN' }), inv({ id: 'b', total: 1, currency: 'USD' })],
      [],
      asOf,
    )
    expect(summary.currencies).toEqual(['AFN', 'USD'])
  })

  it('latest sale and payment dates', () => {
    const summary = summarizeParty(
      [inv({ id: 'a', invoiceDate: '2026-08-01' }), inv({ id: 'b', invoiceDate: '2026-09-05' })],
      [pay({ entryDate: '2026-09-06' }), pay({ entryDate: '2026-07-01' })],
      asOf,
    )
    expect(summary.lastSaleAt).toBe('2026-09-05')
    expect(summary.lastPaymentAt).toBe('2026-09-06')
  })
})

describe('the statement reads every row', () => {
  const repo = readFileSync(join(__dirname, '../services/payments/payments.repository.ts'), 'utf8')
  const movements = repo.slice(repo.indexOf('async partyMovements('))

  it('pages instead of stopping at 1000', () => {
    expect(movements).not.toContain('.limit(1000)')
    expect(movements).toContain('.range(from, to)')
  })

  it('excludes cancelled invoices', () => {
    expect(movements).toContain(".neq('status', 'cancelled')")
  })
})

import { monthlyActivity, rankPartyProducts } from '../services/payments/payments.domain'

describe('monthlyActivity', () => {
  it('twelve months, oldest first, gaps kept, only sales and receipts', () => {
    const rows = monthlyActivity(
      [
        { type: 'sale', total: 100, invoiceDate: '2026-09-03' },
        { type: 'sale', total: 50, invoiceDate: '2026-09-20' },
        { type: 'purchase', total: 999, invoiceDate: '2026-09-05' },
        { type: 'sale', total: 70, invoiceDate: '2025-01-01' }, // outside the window
      ],
      [
        { direction: 'in', amount: 30, entryDate: '2026-08-15' },
        { direction: 'out', amount: 999, entryDate: '2026-08-15' },
      ],
      '2026-09-17',
    )
    expect(rows).toHaveLength(12)
    expect(rows[0]!.month).toBe('2025-10')
    expect(rows.at(-1)).toEqual({ month: '2026-09', sales: 150, receipts: 0 })
    expect(rows.at(-2)).toEqual({ month: '2026-08', sales: 0, receipts: 30 })
  })
})

describe('rankPartyProducts', () => {
  it('groups by product and unit, ranks by amount, counts invoices', () => {
    const dates = new Map([
      ['i1', '2026-09-01'],
      ['i2', '2026-09-10'],
    ])
    const products = rankPartyProducts(
      [
        { invoiceId: 'i1', productId: 'p1', name: 'Rice', unit: 'kg', quantity: 10, amount: 500 },
        { invoiceId: 'i2', productId: 'p1', name: 'Rice', unit: 'kg', quantity: 5, amount: 250 },
        { invoiceId: 'i2', productId: 'p1', name: 'Rice', unit: 'bag', quantity: 1, amount: 900 },
        {
          invoiceId: 'i1',
          productId: null,
          name: 'Delivery',
          unit: 'piece',
          quantity: 1,
          amount: 20,
        },
      ],
      dates,
    )
    expect(
      products.map((p) => [p.name, p.unit, p.quantity, p.amount, p.invoiceCount, p.lastSoldAt]),
    ).toEqual([
      ['Rice', 'bag', 1, 900, 1, '2026-09-10'],
      ['Rice', 'kg', 15, 750, 2, '2026-09-10'],
      ['Delivery', 'piece', 1, 20, 1, '2026-09-01'],
    ])
  })
})
