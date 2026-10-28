// ============================================
// What sale returns did to each customer — the customers list's debt and credit.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
let returns: Row[] = []
let invoices: Row[] = []

function builder(table: string) {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  Object.assign(chain, {
    select: self,
    eq: self,
    in: self,
    neq: self,
    order: self,
    range: self,
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: table === 'invoice_returns' ? returns : invoices, error: null }),
  })
  return chain
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => builder(table) } }))

const ret = (over: Row): Row => ({
  id: 'r',
  original_invoice_id: 'i',
  return_type: 'sale_return',
  return_number: 'RET',
  return_date: '2026-10-20',
  grand_total_minor: 0,
  ...over,
})

const inv = (over: Row): Row => ({
  id: 'i',
  customer_id: 'c1',
  total: 100,
  paid_amount: 0,
  currency: 'AFN',
  ...over,
})

async function effects() {
  const { PaymentsRepository } = await import('../services/payments/payments.repository')
  return new PaymentsRepository().saleReturnEffects('ws')
}

beforeEach(() => {
  returns = []
  invoices = []
})

describe('saleReturnEffects', () => {
  it('answers nothing when there are no returns', async () => {
    invoices = [inv({})]
    expect(await effects()).toEqual([])
  })

  it('a return on a paid invoice is credit; on an unpaid one it cancels debt', async () => {
    invoices = [
      inv({ id: 'paid', customer_id: 'c1', total: 80, paid_amount: 80 }),
      inv({ id: 'open', customer_id: 'c2', total: 100, paid_amount: 0 }),
    ]
    returns = [
      ret({ id: 'r1', original_invoice_id: 'paid', grand_total_minor: 80 }),
      ret({ id: 'r2', original_invoice_id: 'open', grand_total_minor: 30 }),
    ]
    const rows = await effects()
    expect(rows.find((row) => row.customerId === 'c1')).toMatchObject({ applied: 0, credit: 80 })
    expect(rows.find((row) => row.customerId === 'c2')).toMatchObject({ applied: 30, credit: 0 })
  })

  it('adds up a customer’s returns per currency, reading minor units by that currency', async () => {
    invoices = [
      inv({ id: 'a', total: 80, paid_amount: 80, currency: 'AFN' }),
      inv({ id: 'b', total: 50, paid_amount: 50, currency: 'USD' }),
      inv({ id: 'c', total: 100, paid_amount: 100, currency: 'AFN' }),
    ]
    returns = [
      ret({ id: '1', original_invoice_id: 'a', grand_total_minor: 80 }),
      ret({ id: '2', original_invoice_id: 'b', grand_total_minor: 2000 }),
      ret({ id: '3', original_invoice_id: 'c', grand_total_minor: 20 }),
    ]
    const rows = await effects()
    expect(rows.find((row) => row.currency === 'AFN')?.credit).toBe(100)
    expect(rows.find((row) => row.currency === 'USD')?.credit).toBe(20)
  })

  it('ignores returns of invoices that are cancelled or have no customer', async () => {
    invoices = [inv({ id: 'walkin', customer_id: null })]
    returns = [ret({ original_invoice_id: 'walkin', grand_total_minor: 50 })]
    expect(await effects()).toEqual([])
  })
})
