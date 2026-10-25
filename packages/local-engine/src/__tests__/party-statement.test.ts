// The party statement on the device: the four GET /payments/<kind>/:type/:id
// routes answer from SQLite through the SAME assembly the server uses
// (@hisabche/validation party-statement) — no second balance.
import { describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb } from './test-db'

async function seed() {
  const engine = createLocalEngine(createTestDb())
  const cust = await engine.request<{ id: string }>({
    method: 'POST',
    path: '/customers',
    body: { fullName: 'مشتری تست', openingBalance: 100 },
  })
  expect(cust.status).toBe(201)
  const customerId = cust.data.id
  const make = async (qty: number) =>
    (
      await engine.request<{ id: string }>({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'sale',
          currency: 'AFN',
          customerId,
          items: [{ productName: 'شکر', quantity: qty, unitPrice: 1000 }],
        },
      })
    ).data.id
  const first = await make(1)
  await make(2)
  const pay = await engine.request({
    method: 'POST',
    path: '/payments',
    body: {
      direction: 'in',
      partyType: 'customer',
      partyId: customerId,
      amount: 400,
      currency: 'AFN',
      allocations: [{ invoiceId: first, amount: 400 }],
    },
  })
  expect(pay.status).toBe(201)
  return { engine, customerId, first }
}

describe('party statement on the device', () => {
  it('open invoices: what is still owed, oldest due first', async () => {
    const { engine, customerId } = await seed()
    const res = await engine.request<Array<{ total: number; outstanding: number }>>({
      method: 'GET',
      path: `/payments/open-invoices/customer/${customerId}`,
    })
    expect(res.status).toBe(200)
    expect(res.data.map((i) => i.outstanding).sort()).toEqual([2000, 600])
  })

  it('ledger: running balance starts at the opening balance and foots to the summary', async () => {
    const { engine, customerId } = await seed()
    const ledger = await engine.request<{
      openingBalance: number
      balance: number
      movements: Array<{ kind: string; balance: number; sourceType: string }>
    }>({ method: 'GET', path: `/payments/ledger/customer/${customerId}` })
    expect(ledger.status).toBe(200)
    expect(ledger.data.openingBalance).toBe(100)
    expect(ledger.data.movements).toHaveLength(3)
    // 100 opening + 1000 + 2000 − 400 receipt
    expect(ledger.data.balance).toBe(2700)
    expect(ledger.data.movements.at(-1)?.balance).toBe(2700)

    const summary = await engine.request<{ bookCurrency: string; byCurrency: unknown[] }>({
      method: 'GET',
      path: `/payments/summary/customer/${customerId}`,
    })
    expect(summary.status).toBe(200)
    expect(summary.data.bookCurrency).toBe('AFN')
    expect(summary.data.byCurrency.length).toBeGreaterThan(0)
  })

  it('activity: ranks the products the customer buys', async () => {
    const { engine, customerId } = await seed()
    const res = await engine.request<{ monthly: unknown[]; products: Array<{ name: string }> }>({
      method: 'GET',
      path: `/payments/activity/customer/${customerId}`,
    })
    expect(res.status).toBe(200)
    expect(res.data.products[0]?.name).toBe('شکر')
  })

  it('refuses a party type that is neither customer nor supplier', async () => {
    const { engine, customerId } = await seed()
    const res = await engine.request({
      method: 'GET',
      path: `/payments/ledger/employee/${customerId}`,
    })
    expect(res.status).toBe(400)
  })

  it('customer accounting: every document with the entries that account for it', async () => {
    const { engine, customerId } = await seed()
    const res = await engine.request<{
      documents: { sourceType: string; unposted: boolean; entries: { lines: unknown[] }[] }[]
      postedCount: number
      unpostedCount: number
    }>({ method: 'GET', path: `/customers/${customerId}/accounting` })
    expect(res.status).toBe(200)
    // two invoices and one receipt, all booked by the engine
    expect(res.data.documents).toHaveLength(3)
    expect(res.data.postedCount).toBe(3)
    expect(res.data.unpostedCount).toBe(0)
    expect(
      res.data.documents.every((d) => d.entries.length > 0 && d.entries[0]!.lines.length > 0),
    ).toBe(true)

    const missing = await engine.request({
      method: 'GET',
      path: '/customers/9b2f4c1e-0000-4000-8000-0000000000ff/accounting',
    })
    expect(missing.status).toBe(404)
  })
})
