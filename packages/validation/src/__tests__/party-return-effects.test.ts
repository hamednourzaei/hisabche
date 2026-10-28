// ============================================
// What a return does to each invoice, and what the party owes afterwards.
// ============================================

import { describe, expect, it } from 'vitest'

import { returnEffectOfInvoice } from '../schemas/payments.domain'
import {
  buildPartySummary,
  type PartyInvoiceRow,
  type PartyReturnRow,
} from '../schemas/party-statement'

const BOOK = 'AFN'

const invoice = (over: Partial<PartyInvoiceRow>): PartyInvoiceRow => ({
  id: 'inv-1',
  type: 'sale',
  status: 'pending',
  total: 100,
  paid_amount: 0,
  date: '2026-10-01',
  due_date: '2026-10-10',
  currency: 'AFN',
  ...over,
})

const ret = (over: Partial<PartyReturnRow>): PartyReturnRow => ({
  id: 'ret-1',
  original_invoice_id: 'inv-1',
  return_type: 'sale_return',
  return_number: 'RET-1',
  return_date: '2026-10-20',
  grand_total_minor: 30,
  currency: 'AFN',
  ...over,
})

const summary = (invoices: PartyInvoiceRow[], returns: PartyReturnRow[], openingBalance = 0) =>
  buildPartySummary({
    rows: { invoices, payments: [], returns, openingBalance },
    bookCurrency: BOOK,
    asOf: '2026-10-28',
  })

describe('returnEffectOfInvoice', () => {
  it('splits a return into debt it cancels and credit it creates', () => {
    expect(returnEffectOfInvoice(100, 0, 30)).toEqual({ outstanding: 70, applied: 30, credit: 0 })
    expect(returnEffectOfInvoice(100, 100, 30)).toEqual({ outstanding: 0, applied: 0, credit: 30 })
    // 40 paid, 60 still owed, 80 returned: 60 of it cancels the debt, 20 is credit.
    expect(returnEffectOfInvoice(100, 40, 80)).toEqual({ outstanding: 0, applied: 60, credit: 20 })
    // No return: nothing changes.
    expect(returnEffectOfInvoice(100, 40, 0)).toEqual({ outstanding: 60, applied: 0, credit: 0 })
  })

  it('applied + credit always equals the returned amount', () => {
    for (const [total, paid, returned] of [
      [100, 0, 30],
      [100, 100, 30],
      [100, 40, 80],
      [80, 80, 80],
    ] as const) {
      const r = returnEffectOfInvoice(total, paid, returned)
      expect(r.applied + r.credit).toBeCloseTo(returned, 2)
    }
  })
})

describe('the party summary, invoice by invoice', () => {
  it('a returned unpaid invoice is no longer overdue and is not an open invoice', () => {
    const s = summary([invoice({})], [ret({ grand_total_minor: 100 })])
    expect(s.receivable).toBe(0)
    expect(s.overdue).toBe(0)
    expect(s.openInvoiceCount).toBe(0)
    expect(s.aging.total).toBe(0)
  })

  it('a partial return leaves the rest open and overdue', () => {
    const s = summary([invoice({})], [ret({})])
    expect(s.receivable).toBe(70)
    expect(s.overdue).toBe(70)
    expect(s.openInvoiceCount).toBe(1)
    expect(s.aging.total).toBe(70)
  })

  it('an unpaid invoice and a returned paid one stay separate: they owe A, we owe B', () => {
    const s = summary(
      [
        invoice({ id: 'A', total: 100, paid_amount: 0 }),
        invoice({ id: 'B', total: 50, paid_amount: 50, status: 'paid' }),
      ],
      [ret({ original_invoice_id: 'B', grand_total_minor: 30 })],
    )
    expect(s.receivable).toBe(100)
    expect(s.returnCredit).toBe(30)
    expect(s.weOwe).toBe(30)
    expect(s.netBalance).toBe(70)
  })

  it('«we owe» is the purchase payable plus the return credit', () => {
    const s = summary(
      [
        invoice({ id: 'S', total: 80, paid_amount: 80, status: 'paid' }),
        invoice({ id: 'P', type: 'purchase', total: 500, paid_amount: 200 }),
      ],
      [ret({ original_invoice_id: 'S', grand_total_minor: 80 })],
    )
    expect(s.payable).toBe(300)
    expect(s.returnCredit).toBe(80)
    expect(s.weOwe).toBe(380)
    expect(s.netBalance).toBe(-380)
  })

  it('no returns: the credit and «we owe» are just what they were', () => {
    const s = summary([invoice({ type: 'purchase', total: 500, paid_amount: 200 })], [])
    expect(s.returnCredit).toBe(0)
    expect(s.weOwe).toBe(s.payable)
  })

  it('a return in another currency changes that currency only', () => {
    const s = summary(
      [
        invoice({ id: 'U', currency: 'USD', total: 50, paid_amount: 50, status: 'paid' }),
        invoice({ id: 'F', currency: 'AFN', total: 100, paid_amount: 0 }),
      ],
      [ret({ original_invoice_id: 'U', currency: 'USD', grand_total_minor: 2000 })],
    )
    const by = Object.fromEntries(s.byCurrency.map((row) => [row.currency, row]))
    expect(by['USD']?.weOwe).toBe(20)
    expect(by['AFN']?.weOwe).toBe(0)
    expect(by['AFN']?.receivable).toBe(100)
  })
})
