// ============================================
// packages/local-engine/src/__tests__/package-fx-ledger-device.test.ts
//
// M5 / C2 (owner, 2 Nov 2026): the LEDGER is the truth of money, in the books currency, at a VALID exchange rate.
//
//   100 USD x 65 = 6 500 AFN, and the invoice keeps the chain currency -> rate -> ledger amount.
//   No rate = FAIL CLOSED: no default, no 1:1, no raw USD in an AFN ledger, nothing written.
//   Deferred revenue, revenue recognition, reversal: converted ONCE (at the sale); a delivery never converts again.
//   Profit reads the ledger: an invoice with no posted entry is a reference, not a figure.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

const ws = TEST_WORKSPACE_ID
const CUST = '44444444-4444-4444-8444-444444444444'
const SERVICE = '55555555-5555-4555-8555-555555555555'
const PACKAGE = '66666666-6666-4666-8666-666666666666'
const GOODS = '77777777-7777-4777-8777-777777777777'

const headers = {
  'x-workspace-id': ws,
  'x-user-id': TEST_USER_ID,
  'x-user-role': 'owner',
  'x-hisabche-queue': '1',
}

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

const count = (sql: string) => db.all<{ n: number }>(`SELECT COUNT(*) AS n ${sql}`)[0]!.n

const sell = (body: Record<string, unknown>) =>
  engine.request<{ id: string; code?: string }>({
    method: 'POST',
    path: '/invoices',
    headers,
    body: { type: 'sale', customerId: CUST, date: '2026-11-01', ...body },
  })

const lines = (sourceType = 'invoice') =>
  db.all<{ role: string; debit: number; credit: number }>(
    `SELECT a.role, jl.debit, jl.credit FROM journal_entry je JOIN journal_line jl ON jl.journal_id = je.id
       JOIN account a ON a.id = jl.account_id WHERE je.source_type = ? ORDER BY a.role`,
    [sourceType],
  )

async function deliverOne(date = '2026-11-02') {
  const session = await engine.request<{ id: string }>({
    method: 'POST',
    path: '/service-delivery/sessions',
    headers,
    body: {
      workspaceId: ws,
      customerId: CUST,
      serviceOfferingId: SERVICE,
      sessionDate: date,
      startTime: '10:00',
      endTime: '11:00',
      settlementMethod: 'package_credit',
    },
  })
  expect(session.status, JSON.stringify(session.data)).toBe(201)
  const res = await engine.request({
    method: 'POST',
    path: `/service-delivery/sessions/${session.data.id}/deliver`,
    headers,
    body: { packageProductId: PACKAGE },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(200)
  return session.data.id
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
  db.run(
    `INSERT OR REPLACE INTO customer (id, workspace_id, full_name, created_at, updated_at) VALUES (?, ?, 'Zahra', '2026-11-01', '2026-11-01')`,
    [CUST, ws],
  )
  for (const [id, type] of [
    [SERVICE, 'service'],
    [PACKAGE, 'package'],
    [GOODS, 'service'],
  ] as const) {
    db.run(
      `INSERT OR REPLACE INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at)
       VALUES (?, ?, 'x', 0, 100, 0, 1, ?, '2026-11-01')`,
      [id, ws, type],
    )
  }
})

describe('C2: invoice currency, rate and ledger', () => {
  it('1. a same-currency invoice books its total 1:1 in the books currency and stores no rate', async () => {
    const res = await sell({
      currency: 'AFN',
      items: [{ productId: PACKAGE, productName: 'c', quantity: 1, unitPrice: 6500 }],
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(lines().find((l) => l.role === 'receivable')).toMatchObject({ debit: 6500 })
    expect(
      db.all<{ exchange_rate: number | null }>('SELECT exchange_rate FROM invoice')[0]!
        .exchange_rate,
    ).toBeNull()
  })

  it('2. a foreign invoice with a valid rate: 100 USD x 65 = 6 500 AFN in the ledger, and the chain is kept on the invoice', async () => {
    const res = await sell({
      currency: 'USD',
      exchangeRate: 65,
      items: [{ productId: PACKAGE, productName: 'c', quantity: 1, unitPrice: 100 }],
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(lines().find((l) => l.role === 'receivable')).toMatchObject({ debit: 6500 })
    expect(lines().find((l) => l.role === 'sales')).toMatchObject({ credit: 6500 })
    const stored = db.all<{ currency: string; exchange_rate: number; total: number }>(
      'SELECT currency, exchange_rate, total FROM invoice',
    )[0]!
    expect(stored).toMatchObject({ currency: 'USD', exchange_rate: 65, total: 100 })
  })

  it('3. a foreign invoice WITHOUT a rate is refused whole: no invoice, no journal, no credit, nothing queued', async () => {
    const before = count('FROM sync_queue')
    const res = await sell({
      currency: 'USD',
      items: [{ productId: PACKAGE, productName: 'c', quantity: 1, unitPrice: 100 }],
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('INVOICE_EXCHANGE_RATE_REQUIRED')
    expect(count('FROM invoice')).toBe(0)
    expect(count('FROM journal_entry')).toBe(0)
    expect(count('FROM package_credit_ledger')).toBe(0)
    expect(count('FROM sync_queue')).toBe(before)
    // and a zero / negative rate is no rate either
    for (const exchangeRate of [0, -65]) {
      const bad = await sell({
        currency: 'USD',
        exchangeRate,
        items: [{ productId: PACKAGE, productName: 'c', quantity: 1, unitPrice: 100 }],
      })
      expect(bad.status).toBe(400)
    }
    expect(count('FROM journal_entry')).toBe(0)
  })
})

describe('C2: deferred revenue with an exchange rate (converted ONCE, at the sale)', () => {
  beforeEach(() =>
    db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('package_deferred_revenue', 'on')`),
  )

  const sellPackage = () =>
    sell({
      currency: 'USD',
      exchangeRate: 65,
      items: [{ productId: PACKAGE, productName: 'c', quantity: 10, unitPrice: 100 }],
    })

  it('4. 10 sessions of 100 USD at 65: 65 000 AFN is deferred, and the GRANT remembers the SAME books amount', async () => {
    expect((await sellPackage()).status).toBe(201)
    expect(lines().find((l) => l.role === 'deferred_revenue')).toMatchObject({ credit: 65000 })
    expect(lines().some((l) => l.role === 'sales')).toBe(false)
    expect(
      db.all<{ d: number }>(
        `SELECT deferred_amount AS d FROM package_credit_ledger WHERE entry_type = 'GRANT'`,
      )[0]!.d,
    ).toBe(65000)
  })

  it('5 + 10. every delivery releases 6 500 AFN (never 100, never 6 500 x 65): the total is exactly the deferred amount', async () => {
    await sellPackage()
    for (let i = 0; i < 10; i += 1) await deliverOne()
    const released = db.all<{ r: number }>(
      `SELECT SUM(released_amount) AS r FROM package_credit_allocations WHERE kind = 'CONSUME'`,
    )[0]!.r
    expect(released).toBe(65000)
    const perDelivery = db.all<{ credit: number }>(
      `SELECT jl.credit FROM journal_entry je JOIN journal_line jl ON jl.journal_id = je.id JOIN account a ON a.id = jl.account_id
        WHERE je.source_type = 'package_release' AND a.role = 'sales'`,
    )
    expect(perDelivery).toHaveLength(10)
    expect(perDelivery.every((l) => l.credit === 6500)).toBe(true)
    const deferredBalance = db.all<{ b: number }>(
      `SELECT COALESCE(SUM(jl.credit - jl.debit), 0) AS b FROM journal_line jl JOIN account a ON a.id = jl.account_id WHERE a.role = 'deferred_revenue'`,
    )[0]!.b
    expect(deferredBalance).toBe(0)
  })

  it('8. cancelling a delivered session restores EXACTLY what it released, in the books currency', async () => {
    await sellPackage()
    const first = await deliverOne()
    const cancelled = await engine.request({
      method: 'POST',
      path: `/service-delivery/sessions/${first}/cancel`,
      headers,
      body: { reason: 'customer asked' },
    })
    expect(cancelled.status, JSON.stringify(cancelled.data)).toBe(200)
    const deferredBalance = db.all<{ b: number }>(
      `SELECT COALESCE(SUM(jl.credit - jl.debit), 0) AS b FROM journal_line jl JOIN account a ON a.id = jl.account_id WHERE a.role = 'deferred_revenue'`,
    )[0]!.b
    expect(deferredBalance).toBe(65000) // back to the full deferred amount: the release was reversed once, not twice
  })
})

describe('C2: profit comes from the LEDGER', () => {
  const profit = async () =>
    (
      await engine.request<{ totals: { revenue: number; invoiceCount: number } }>({
        method: 'GET',
        path: '/accounting/profit-report?from=2026-01-01&to=2026-12-31&currency=AFN',
        headers,
      })
    ).data.totals

  it('9. an invoice WITHOUT a posted entry is a reference, not a figure; one WITH an entry is reported at its books amount', async () => {
    expect(
      (
        await sell({
          currency: 'USD',
          exchangeRate: 65,
          items: [{ productId: PACKAGE, productName: 'c', quantity: 1, unitPrice: 100 }],
        })
      ).status,
    ).toBe(201)
    // an invoice that exists but was never booked (the books lacked an account, or it was written around the ledger)
    db.run(
      `INSERT INTO invoice (id, workspace_id, invoice_number, type, date, currency, subtotal, tax_total, total, status, updated_at)
       VALUES ('orphan', ?, 'INV-ORPHAN', 'sale', '2026-11-01', 'AFN', 99999, 0, 99999, 'paid', datetime('now'))`,
      [ws],
    )
    db.run(
      `INSERT INTO invoice_item (id, workspace_id, invoice_id, product_id, product_name, quantity, unit_price, discount, total_price, updated_at)
       VALUES ('orphan-line', ?, 'orphan', ?, 'x', 1, 99999, 0, 99999, datetime('now'))`,
      [ws, PACKAGE],
    )
    const totals = await profit()
    expect(totals.invoiceCount).toBe(1)
    expect(totals.revenue).toBe(6500) // 100 USD at 65, from the booked invoice only
  })
})

describe('C2: COGS with a foreign-currency sale', () => {
  it('6. cost of goods is the cost layer in the BOOKS currency (2 x 100 = 200 AFN) - the sale rate never touches it', async () => {
    const STOCKED = '88888888-8888-4888-8888-888888888801'
    db.run(
      `INSERT OR REPLACE INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at)
       VALUES (?, ?, 'Pen', 100, 10, 0, 1, 'goods', '2026-11-01')`,
      [STOCKED, ws],
    )
    const bought = await engine.request({
      method: 'POST',
      path: '/invoices',
      headers,
      body: {
        type: 'purchase',
        currency: 'AFN',
        date: '2026-10-01',
        items: [{ productId: STOCKED, productName: 'Pen', quantity: 5, unitPrice: 100 }],
      },
    })
    expect(bought.status, JSON.stringify(bought.data)).toBe(201)
    const sold = await sell({
      currency: 'USD',
      exchangeRate: 65,
      items: [{ productId: STOCKED, productName: 'Pen', quantity: 2, unitPrice: 10 }],
    })
    expect(sold.status, JSON.stringify(sold.data)).toBe(201)

    const sale = db.all<{ role: string; debit: number; credit: number }>(
      `SELECT a.role, jl.debit, jl.credit FROM journal_entry je JOIN journal_line jl ON jl.journal_id = je.id JOIN account a ON a.id = jl.account_id
        WHERE je.source_type = 'invoice' AND je.description LIKE '%' ORDER BY je.created_at DESC, a.role`,
    )
    expect(sale.find((l) => l.role === 'cogs')?.debit).toBe(200) // not 200 x 65, not 200 / 65
    expect(sale.find((l) => l.role === 'receivable' && l.debit === 1300)).toBeTruthy() // 20 USD x 65
  })
})
