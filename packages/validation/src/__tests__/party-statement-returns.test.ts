// ============================================
// A sale return must show in the customer's statement and in their balance.
//
// Seen live (27 Oct 2026): INV-000099 (80 AFN, paid in full) was returned. The
// journal and the stock were right, but the customer file listed no return and
// still said «owed to the customer: 0». The statement and the summary only read
// invoices and payments.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  buildPartyLedger,
  buildPartySummary,
  saleReturnsOf,
  type PartyInvoiceRow,
  type PartyPaymentRow,
  type PartyReturnRow,
} from '../schemas/party-statement'

const BOOK = 'AFN'

const invoice = (over: Partial<PartyInvoiceRow> = {}): PartyInvoiceRow => ({
  id: 'inv-1',
  invoice_number: 'INV-000099',
  type: 'sale',
  status: 'paid',
  total: 80,
  paid_amount: 80,
  date: '2026-10-27',
  due_date: '2026-10-27',
  currency: 'AFN',
  ...over,
})

const payment = (over: Partial<PartyPaymentRow> = {}): PartyPaymentRow => ({
  id: 'pay-1',
  payment_number: 'PMT-1',
  direction: 'in',
  amount: 80,
  entry_date: '2026-10-27',
  currency: 'AFN',
  ...over,
})

// AFN has no fraction digits: 80 AFN is 80 minor units. USD has two: 80 USD is 8000.
const ret = (over: Partial<PartyReturnRow> = {}): PartyReturnRow => ({
  id: 'ret-1',
  original_invoice_id: 'inv-1',
  return_type: 'sale_return',
  return_number: 'RET-LIVE-0099',
  return_date: '2026-10-27',
  grand_total_minor: 80,
  currency: 'AFN',
  ...over,
})

const rows = (parts: {
  invoices?: PartyInvoiceRow[]
  payments?: PartyPaymentRow[]
  returns?: PartyReturnRow[]
}) => ({
  invoices: parts.invoices ?? [],
  payments: parts.payments ?? [],
  returns: parts.returns,
  openingBalance: 0,
})

const summary = (r: ReturnType<typeof rows>) =>
  buildPartySummary({ rows: r, bookCurrency: BOOK, asOf: '2026-10-28' })
const ledger = (r: ReturnType<typeof rows>) =>
  buildPartyLedger({ partyType: 'customer', partyId: 'c-1', rows: r, bookCurrency: BOOK })

describe('sale returns in the customer statement and balance', () => {
  it('the live case: a fully paid 80 AFN invoice, returned — we owe the customer 80', () => {
    const r = rows({ invoices: [invoice()], payments: [payment()], returns: [ret()] })
    const s = summary(r)
    const l = ledger(r)

    expect(s.totalReturned).toBe(80)
    expect(s.receivable).toBe(0)
    expect(s.netBalance).toBe(-80)

    const row = l.movements.find((m) => m.kind === 'return')
    expect(row).toMatchObject({
      reference: 'RET-LIVE-0099',
      amount: 80,
      sourceType: 'invoice',
      sourceId: 'inv-1',
    })
    expect(l.balance).toBe(-80)
  })

  it('an unpaid invoice that is returned owes nothing, and offers nothing to collect', () => {
    const r = rows({
      invoices: [invoice({ status: 'pending', paid_amount: 0, total: 100 })],
      returns: [ret({ grand_total_minor: 100 })],
    })
    const s = summary(r)
    expect(s.receivable).toBe(0)
    expect(s.netBalance).toBe(0)
    expect(ledger(r).balance).toBe(0)
  })

  it('a partial return lowers what is owed by exactly that amount', () => {
    const r = rows({
      invoices: [invoice({ status: 'pending', paid_amount: 0, total: 100 })],
      returns: [ret({ grand_total_minor: 30 })],
    })
    const s = summary(r)
    expect(s.receivable).toBe(70)
    expect(s.netBalance).toBe(70)
    expect(ledger(r).balance).toBe(70)
  })

  it('the statement balance and the summary net always agree', () => {
    const cases = [
      rows({ invoices: [invoice()], payments: [payment()], returns: [ret()] }),
      rows({
        invoices: [invoice({ status: 'pending', paid_amount: 0, total: 100 })],
        returns: [ret({ grand_total_minor: 30 })],
      }),
      rows({ invoices: [invoice()], payments: [payment()] }),
    ]
    for (const r of cases) expect(summary(r).netBalance).toBe(ledger(r).balance)
  })

  it('no returns: nothing changes', () => {
    const r = rows({ invoices: [invoice()], payments: [payment()] })
    const s = summary(r)
    expect(s.totalReturned).toBe(0)
    expect(s.netBalance).toBe(0)
    expect(ledger(r).movements.some((m) => m.kind === 'return')).toBe(false)
  })

  it('reads the minor amount with the invoice currency digits (USD has two, AFN none)', () => {
    const [usd] = saleReturnsOf([ret({ currency: 'USD', grand_total_minor: 8000 })])
    expect(usd?.amount).toBe(80)
    const [afn] = saleReturnsOf([ret({ currency: 'AFN', grand_total_minor: 80 })])
    expect(afn?.amount).toBe(80)
    // An invoice with no currency was returned with two digits.
    const [none] = saleReturnsOf([ret({ currency: '', grand_total_minor: 8000 })])
    expect(none?.amount).toBe(80)
  })

  it('a return in another currency moves that currency only', () => {
    const r = rows({
      invoices: [
        invoice(),
        invoice({
          id: 'inv-2',
          invoice_number: 'INV-USD',
          total: 50,
          paid_amount: 50,
          currency: 'USD',
        }),
      ],
      payments: [payment(), payment({ id: 'pay-2', amount: 50, currency: 'USD' })],
      returns: [
        ret({
          id: 'ret-2',
          original_invoice_id: 'inv-2',
          currency: 'USD',
          grand_total_minor: 2000,
        }),
      ],
    })
    const byCurrency = Object.fromEntries(summary(r).byCurrency.map((row) => [row.currency, row]))
    expect(byCurrency['AFN']?.netBalance).toBe(0)
    expect(byCurrency['USD']?.netBalance).toBe(-20)
    expect(byCurrency['USD']?.totalReturned).toBe(20)
  })

  it('a purchase return is not a sale return', () => {
    expect(saleReturnsOf([ret({ return_type: 'purchase_return' })])).toEqual([])
  })
})
