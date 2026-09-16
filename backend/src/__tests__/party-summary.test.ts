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
