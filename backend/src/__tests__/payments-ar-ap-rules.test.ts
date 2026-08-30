// ============================================
// Payments, allocation, aging and the party balance.
//
// The sign test in "a party's balance" is the one that matters most: the
// balance this core replaces added RECEIPTS to a customer's debt, so taking
// 500 from a debtor made them owe 500 more.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  ageInvoices,
  autoAllocate,
  daysBetween,
  openInvoices,
  outstandingOf,
  partyBalance,
  runningLedger,
  unallocatedOf,
  validateAllocations,
  type LedgerMovement,
  type OpenInvoice,
} from '../services/payments/payments.domain'

const invoice = (
  id: string,
  total: number,
  allocated = 0,
  dueDate = '2026-01-01',
): OpenInvoice => ({
  invoiceId: id,
  invoiceNumber: id.toUpperCase(),
  total,
  allocated,
  dueDate,
  invoiceDate: dueDate,
})

describe('what an invoice still owes is derived, not stored', () => {
  it('is the total less everything allocated to it', () => {
    expect(outstandingOf(invoice('a', 1000, 300))).toBe(700)
  })

  it('is zero once fully allocated', () => {
    expect(outstandingOf(invoice('a', 1000, 1000))).toBe(0)
  })

  it('drops settled invoices from the open list', () => {
    const list = openInvoices([invoice('a', 100, 100), invoice('b', 100, 40)])
    expect(list.map((i) => i.invoiceId)).toEqual(['b'])
  })

  it('orders the open list by due date, oldest first', () => {
    const list = openInvoices([
      invoice('newer', 100, 0, '2026-06-01'),
      invoice('older', 100, 0, '2026-01-01'),
    ])
    expect(list.map((i) => i.invoiceId)).toEqual(['older', 'newer'])
  })
})

describe('automatic allocation', () => {
  const invoices = [invoice('old', 300, 0, '2026-01-01'), invoice('new', 400, 0, '2026-03-01')]

  it('settles the oldest bill first', () => {
    const { allocations } = autoAllocate(300, invoices)
    expect(allocations).toEqual([{ invoiceId: 'old', amount: 300 }])
  })

  it('spills into the next invoice when the payment is larger', () => {
    const { allocations } = autoAllocate(500, invoices)
    expect(allocations).toEqual([
      { invoiceId: 'old', amount: 300 },
      { invoiceId: 'new', amount: 200 },
    ])
  })

  it('keeps an overpayment as an advance instead of refusing it', () => {
    const { allocations, unallocated } = autoAllocate(1000, invoices)
    expect(allocations).toHaveLength(2)
    expect(unallocated).toBe(300)
  })

  it('allocates nothing when there is nothing open, and keeps the whole amount', () => {
    expect(autoAllocate(250, [])).toEqual({ allocations: [], unallocated: 250 })
  })

  it('never allocates more to an invoice than it owes', () => {
    const { allocations } = autoAllocate(1000, [invoice('a', 120, 20)])
    expect(allocations).toEqual([{ invoiceId: 'a', amount: 100 }])
  })
})

describe('allocation rules', () => {
  const invoices = [invoice('a', 500), invoice('b', 500)]

  it('accepts a payment split across two invoices', () => {
    const problems = validateAllocations(
      600,
      [
        { invoiceId: 'a', amount: 500 },
        { invoiceId: 'b', amount: 100 },
      ],
      invoices,
    )
    expect(problems).toEqual([])
  })

  it('refuses to allocate more than was paid', () => {
    const problems = validateAllocations(
      100,
      [
        { invoiceId: 'a', amount: 80 },
        { invoiceId: 'b', amount: 80 },
      ],
      invoices,
    )
    expect(problems).toContain('PAYMENT_OVER_ALLOCATED')
  })

  it('refuses to allocate more to an invoice than it owes', () => {
    const problems = validateAllocations(900, [{ invoiceId: 'a', amount: 900 }], invoices)
    expect(problems).toContain('PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING')
  })

  it('refuses an invoice that is not this party open list', () => {
    const problems = validateAllocations(
      100,
      [{ invoiceId: 'someone-else', amount: 100 }],
      invoices,
    )
    expect(problems).toContain('PAYMENT_ALLOCATION_INVOICE_UNKNOWN')
  })

  it('refuses two rows against the same invoice', () => {
    // Each would be checked against the same outstanding balance and together
    // exceed it.
    const problems = validateAllocations(
      600,
      [
        { invoiceId: 'a', amount: 300 },
        { invoiceId: 'a', amount: 300 },
      ],
      invoices,
    )
    expect(problems).toContain('PAYMENT_ALLOCATION_DUPLICATE')
  })

  it('refuses a payment of nothing', () => {
    expect(validateAllocations(0, [], invoices)).toContain('PAYMENT_AMOUNT_INVALID')
  })

  it('allows under-allocating — the rest is an advance', () => {
    expect(validateAllocations(1000, [{ invoiceId: 'a', amount: 100 }], invoices)).toEqual([])
  })

  it('reports what is left unapplied', () => {
    expect(unallocatedOf(1000, [{ invoiceId: 'a', amount: 250.5 }])).toBe(749.5)
  })
})

describe("a party's balance — positive means they owe us", () => {
  it('a sale increases what they owe', () => {
    expect(partyBalance([{ date: '', kind: 'sale', amount: 500, reference: '' }])).toBe(500)
  })

  it('MONEY RECEIVED REDUCES what they owe', () => {
    // The version this replaces added it. A debtor who paid 500 was recorded
    // as owing 500 more.
    const movements: LedgerMovement[] = [
      { date: '', kind: 'sale', amount: 500, reference: '' },
      { date: '', kind: 'payment_in', amount: 500, reference: '' },
    ]
    expect(partyBalance(movements)).toBe(0)
  })

  it('a return reduces what they owe', () => {
    const movements: LedgerMovement[] = [
      { date: '', kind: 'sale', amount: 500, reference: '' },
      { date: '', kind: 'return', amount: 200, reference: '' },
    ]
    expect(partyBalance(movements)).toBe(300)
  })

  it('a purchase from them means WE owe, so the balance goes negative', () => {
    expect(partyBalance([{ date: '', kind: 'purchase', amount: 800, reference: '' }])).toBe(-800)
  })

  it('paying a supplier settles our side back to zero', () => {
    const movements: LedgerMovement[] = [
      { date: '', kind: 'purchase', amount: 800, reference: '' },
      { date: '', kind: 'payment_out', amount: 800, reference: '' },
    ]
    expect(partyBalance(movements)).toBe(0)
  })

  it('carries a running balance down the statement in date order', () => {
    const rows = runningLedger([
      { date: '2026-03-01', kind: 'payment_in', amount: 300, reference: 'p1' },
      { date: '2026-01-01', kind: 'sale', amount: 1000, reference: 'i1' },
    ])
    expect(rows.map((r) => r.balance)).toEqual([1000, 700])
  })
})

describe('aging', () => {
  const asOf = '2026-06-30'

  it('counts whole days between two dates', () => {
    expect(daysBetween('2026-06-01', '2026-06-30')).toBe(29)
  })

  it('puts a bill that is not due yet in current', () => {
    const buckets = ageInvoices([invoice('a', 100, 0, '2026-07-15')], asOf)
    expect(buckets.current).toBe(100)
    expect(buckets.total).toBe(100)
  })

  it('sorts overdue amounts into the right bucket', () => {
    const buckets = ageInvoices(
      [
        invoice('a', 100, 0, '2026-06-15'), // 15 days
        invoice('b', 200, 0, '2026-05-15'), // 46 days
        invoice('c', 300, 0, '2026-04-15'), // 76 days
        invoice('d', 400, 0, '2026-01-01'), // 180 days
      ],
      asOf,
    )

    expect(buckets.days1to30).toBe(100)
    expect(buckets.days31to60).toBe(200)
    expect(buckets.days61to90).toBe(300)
    expect(buckets.over90).toBe(400)
    expect(buckets.total).toBe(1000)
  })

  it('ages only what is still unpaid', () => {
    const buckets = ageInvoices([invoice('a', 1000, 900, '2026-01-01')], asOf)
    expect(buckets.over90).toBe(100)
  })

  it('ignores a fully settled invoice', () => {
    expect(ageInvoices([invoice('a', 1000, 1000, '2026-01-01')], asOf).total).toBe(0)
  })

  it('measures from the due date, not the invoice date, when one is set', () => {
    // Billed in January on 90-day terms, due in June: not overdue at all.
    const onTerms: OpenInvoice = {
      invoiceId: 'a',
      invoiceNumber: 'A',
      total: 100,
      allocated: 0,
      invoiceDate: '2026-01-01',
      dueDate: '2026-07-01',
    }
    expect(ageInvoices([onTerms], asOf).current).toBe(100)
  })

  it('falls back to the invoice date when no due date is set', () => {
    const noDueDate: OpenInvoice = {
      invoiceId: 'a',
      invoiceNumber: 'A',
      total: 100,
      allocated: 0,
      invoiceDate: '2026-01-01',
      dueDate: '',
    }
    expect(ageInvoices([noDueDate], asOf).over90).toBe(100)
  })
})
