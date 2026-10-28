// ============================================
// A returned unpaid invoice must not stay open for its full amount.
//
// `invoice_outstanding` is total − allocations. After a return on an unpaid
// invoice it still said «owed in full»: the invoice was offered for collection,
// aged as overdue and could take a payment for goods already sent back.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
let outstanding: Row[] = []
let returns: Row[] = []
let returnsError: { code: string; message: string } | null = null

function builder(table: string) {
  const chain: Record<string, unknown> = {}
  const result = () =>
    table === 'invoice_returns'
      ? { data: returnsError ? null : returns, error: returnsError }
      : { data: outstanding, error: null }
  const self = () => chain
  Object.assign(chain, {
    select: self,
    eq: self,
    in: self,
    gt: self,
    neq: self,
    order: self,
    range: self,
    then: (resolve: (value: unknown) => unknown) => resolve(result()),
  })
  return chain
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => builder(table) } }))

const invoiceRow = (over: Row = {}): Row => ({
  invoice_id: 'inv-1',
  invoice_number: 'INV-1',
  total: 100,
  allocated: 0,
  due_date: '2026-10-10',
  invoice_date: '2026-10-01',
  type: 'sale',
  customer_id: 'c-1',
  supplier_id: null,
  currency: 'AFN',
  ...over,
})

const returnRow = (over: Row = {}): Row => ({
  id: 'ret-1',
  original_invoice_id: 'inv-1',
  return_type: 'sale_return',
  return_number: 'RET-1',
  return_date: '2026-10-20',
  grand_total_minor: 30,
  ...over,
})

async function repo() {
  const { PaymentsRepository } = await import('../services/payments/payments.repository')
  return new PaymentsRepository()
}

beforeEach(() => {
  outstanding = []
  returns = []
  returnsError = null
})

describe('open invoices after returns', () => {
  it('a partial return leaves only the rest to collect', async () => {
    outstanding = [invoiceRow()]
    returns = [returnRow()]
    const [row] = await (await repo()).openInvoicesByIds('ws', ['inv-1'])
    expect(row?.total).toBe(70)
    expect(row!.total - row!.allocated).toBe(70)
  })

  it('a fully returned unpaid invoice is not open at all', async () => {
    outstanding = [invoiceRow()]
    returns = [returnRow({ grand_total_minor: 100 })]
    expect(await (await repo()).openInvoicesByIds('ws', ['inv-1'])).toEqual([])
    expect(await (await repo()).openInvoicesFor('ws', 'customer', 'c-1')).toEqual([])
  })

  it('a part-paid invoice keeps what is still owed after the return', async () => {
    outstanding = [invoiceRow({ allocated: 40 })]
    returns = [returnRow({ grand_total_minor: 30 })]
    const [row] = await (await repo()).openInvoicesFor('ws', 'customer', 'c-1')
    expect(row!.total - row!.allocated).toBe(30)
  })

  it('the aging report reads the same net amounts', async () => {
    outstanding = [invoiceRow()]
    returns = [returnRow({ grand_total_minor: 100 })]
    expect(await (await repo()).allOpenInvoices('ws', 'sale')).toEqual([])
  })

  it('an invoice with no return is untouched', async () => {
    outstanding = [invoiceRow({ invoice_id: 'inv-2' })]
    returns = [returnRow()] // another invoice's return
    const [row] = await (await repo()).openInvoicesByIds('ws', ['inv-2'])
    expect(row?.total).toBe(100)
  })

  it('a database without the returns table answers «no returns»', async () => {
    outstanding = [invoiceRow()]
    returnsError = { code: '42P01', message: 'relation does not exist' }
    const [row] = await (await repo()).openInvoicesByIds('ws', ['inv-1'])
    expect(row?.total).toBe(100)
  })
})
