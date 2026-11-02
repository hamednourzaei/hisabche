// ============================================
// packages/local-engine/src/__tests__/m6-cross-domain-invariants.test.ts
//
// M6 - the domains behave as ONE system. A foreign-currency package is sold, used, cancelled and replayed through the real
// device routes, and after EVERY step the same cross-domain invariants are read straight from the tables:
//
//   I1  every journal entry is balanced, and the whole ledger balances (trial balance)
//   I2  the deferred-revenue balance == the sale-time value of the unspent entitlement (never negative, never over-released)
//   I3  the package-credit projection == the sum of its append-only events, per GRANT, and never negative
//   I4  revenue recognised (sales credited by releases) == deferred revenue released by the allocations
//   I5  a GRANT never releases more than it deferred
//   I6  multi-currency chain: receivable/ledger amount == invoice total x the stored rate, converted ONCE
//   I7  replay of any command changes nothing (ledger, credit, allocations)
//   I8  a closed period refuses a delivery whole: nothing in the ledger, credit or allocations moves
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

const ws = TEST_WORKSPACE_ID
const CUST = '44444444-4444-4444-8444-444444444444'
const SERVICE = '55555555-5555-4555-8555-555555555555'
const PACKAGE = '66666666-6666-4666-8666-666666666666'
const headers = {
  'x-workspace-id': ws,
  'x-user-id': TEST_USER_ID,
  'x-user-role': 'owner',
  'x-hisabche-queue': '1',
}

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

const num = (sql: string, params: unknown[] = []) =>
  Number(db.all<{ v: number | null }>(sql, params)[0]?.v ?? 0)
const r2 = (x: number) => Math.round(x * 100) / 100

/** Every invariant, read from the tables - the same checks after every step. */
function assertInvariants(label: string) {
  // I1
  const unbalanced = db.all<{ id: string }>(
    `SELECT je.id FROM journal_entry je JOIN journal_line jl ON jl.journal_id = je.id
      WHERE je.workspace_id = ? AND je.status = 'posted' GROUP BY je.id HAVING ROUND(SUM(jl.debit) - SUM(jl.credit), 2) <> 0`,
    [ws],
  )
  expect(unbalanced, `${label}: unbalanced entries`).toEqual([])
  expect(
    num(`SELECT ROUND(SUM(debit) - SUM(credit), 2) AS v FROM journal_line`),
    `${label}: trial balance`,
  ).toBe(0)

  // I3 + I5 per GRANT
  const grants = db.all<{ id: string; quantity: number; deferred_amount: number | null }>(
    `SELECT id, quantity, deferred_amount FROM package_credit_ledger WHERE entry_type = 'GRANT' AND workspace_id = ?`,
    [ws],
  )
  let unspentValue = 0
  for (const g of grants) {
    const consumed = num(
      `SELECT SUM(CASE kind WHEN 'CONSUME' THEN quantity ELSE -quantity END) AS v FROM package_credit_allocations WHERE grant_entry_id = ?`,
      [g.id],
    )
    const released = num(
      `SELECT SUM(CASE kind WHEN 'CONSUME' THEN released_amount ELSE -released_amount END) AS v FROM package_credit_allocations WHERE grant_entry_id = ?`,
      [g.id],
    )
    expect(consumed, `${label}: credit never negative (${g.id})`).toBeGreaterThanOrEqual(0)
    expect(consumed, `${label}: not over-consumed (${g.id})`).toBeLessThanOrEqual(g.quantity)
    expect(
      released,
      `${label}: never releases more than it deferred (${g.id})`,
    ).toBeLessThanOrEqual(g.deferred_amount ?? 0)
    unspentValue = r2(unspentValue + (g.deferred_amount ?? 0) - released)
  }
  // I2
  expect(
    num(
      `SELECT ROUND(SUM(jl.credit - jl.debit), 2) AS v FROM journal_line jl JOIN account a ON a.id = jl.account_id WHERE a.role = 'deferred_revenue'`,
    ),
    `${label}: deferred balance == unspent sale-time value`,
  ).toBe(unspentValue)
  // I4
  const recognised = num(
    `SELECT ROUND(SUM(jl.credit - jl.debit), 2) AS v FROM journal_line jl JOIN account a ON a.id = jl.account_id
       JOIN journal_entry je ON je.id = jl.journal_id
      WHERE a.role = 'sales' AND je.source_type IN ('package_release', 'reversal')`,
  )
  const netReleased = num(
    `SELECT SUM(CASE kind WHEN 'CONSUME' THEN released_amount ELSE -released_amount END) AS v FROM package_credit_allocations`,
  )
  expect(recognised, `${label}: revenue recognised == released`).toBe(r2(netReleased))
}

const snapshot = () => ({
  journalLines: num('SELECT COUNT(*) AS v FROM journal_line'),
  journalEntries: num('SELECT COUNT(*) AS v FROM journal_entry'),
  credit: num('SELECT COUNT(*) AS v FROM package_credit_ledger'),
  allocations: num('SELECT COUNT(*) AS v FROM package_credit_allocations'),
})

async function session(date = '2026-11-02') {
  const res = await engine.request<{ id: string }>({
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
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data.id
}
const deliver = (id: string) =>
  engine.request({
    method: 'POST',
    path: `/service-delivery/sessions/${id}/deliver`,
    headers,
    body: { packageProductId: PACKAGE },
  })
const cancel = (id: string) =>
  engine.request({
    method: 'POST',
    path: `/service-delivery/sessions/${id}/cancel`,
    headers,
    body: { reason: 'customer asked' },
  })

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
  ] as const) {
    db.run(
      `INSERT OR REPLACE INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, package_term_months, updated_at) VALUES (?, ?, 'x', 0, 100, 0, 1, ?, ?, '2026-11-01')`,
      [id, ws, type, type === 'package' ? 6 : null],
    )
  }
  db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('package_deferred_revenue', 'on')`)
})

describe('M6: a foreign-currency package through sale, use, cancellation and replay keeps every invariant', () => {
  it('holds after the sale, each delivery, a cancellation, a renewal and a replay', async () => {
    const sale = await engine.request({
      method: 'POST',
      path: '/invoices',
      headers,
      body: {
        type: 'sale',
        customerId: CUST,
        currency: 'USD',
        exchangeRate: 65,
        date: '2026-11-01',
        items: [{ productId: PACKAGE, productName: 'course', quantity: 10, unitPrice: 100 }],
      },
    })
    expect(sale.status, JSON.stringify(sale.data)).toBe(201)
    assertInvariants('after the sale')

    // I6: 1 000 USD x 65 = 65 000 AFN, converted once, with the chain kept on the invoice
    expect(
      num(
        `SELECT jl.debit AS v FROM journal_line jl JOIN account a ON a.id = jl.account_id WHERE a.role = 'receivable'`,
      ),
    ).toBe(65000)
    expect(
      db.all<{ currency: string; exchange_rate: number; total: number }>(
        'SELECT currency, exchange_rate, total FROM invoice',
      )[0],
    ).toMatchObject({ currency: 'USD', exchange_rate: 65, total: 1000 })

    const delivered: string[] = []
    for (let i = 0; i < 3; i += 1) {
      const id = await session()
      expect((await deliver(id)).status).toBe(200)
      delivered.push(id)
      assertInvariants(`after delivery ${i + 1}`)
    }
    expect((await cancel(delivered[1]!)).status).toBe(200)
    assertInvariants('after a cancellation')

    // renewal: a NEW GRANT with its own entitlement and value
    const renewal = await engine.request({
      method: 'POST',
      path: '/invoices',
      headers,
      body: {
        type: 'sale',
        customerId: CUST,
        currency: 'USD',
        exchangeRate: 70,
        date: '2026-11-05',
        items: [{ productId: PACKAGE, productName: 'course', quantity: 4, unitPrice: 100 }],
      },
    })
    expect(renewal.status, JSON.stringify(renewal.data)).toBe(201)
    assertInvariants('after the renewal')
    expect(num(`SELECT COUNT(*) AS v FROM package_credit_ledger WHERE entry_type = 'GRANT'`)).toBe(
      2,
    )

    // I7: replaying every command changes nothing
    const before = snapshot()
    for (const id of delivered) await deliver(id)
    await cancel(delivered[1]!)
    expect(snapshot()).toEqual(before)
    assertInvariants('after the replay')
  })

  it('I8: a closed period refuses a delivery whole - the ledger, the credit and the allocations do not move', async () => {
    await engine.request({
      method: 'POST',
      path: '/invoices',
      headers,
      body: {
        type: 'sale',
        customerId: CUST,
        currency: 'AFN',
        date: '2026-10-01',
        items: [{ productId: PACKAGE, productName: 'course', quantity: 4, unitPrice: 100 }],
      },
    })
    const id = await session('2026-10-20')
    db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('period_lock', '2026-10-31')`)
    const before = snapshot()
    const res = await deliver(id)
    expect(res.status).toBe(409)
    expect(JSON.stringify(res.data)).toContain('ACCOUNTING_PERIOD_LOCKED')
    expect(snapshot()).toEqual(before)
    assertInvariants('after a refused delivery')
  })
})

describe('M6: the invariant checks are not vacuous (injection)', () => {
  it('a tampered ledger and a tampered allocation are both caught', async () => {
    await engine.request({
      method: 'POST',
      path: '/invoices',
      headers,
      body: {
        type: 'sale',
        customerId: CUST,
        currency: 'AFN',
        date: '2026-11-01',
        items: [{ productId: PACKAGE, productName: 'course', quantity: 4, unitPrice: 100 }],
      },
    })
    await deliver(await session())
    assertInvariants('clean')

    // an orphan debit with no credit: the trial balance and the entry balance must both fail
    const line = db.all<{ id: string; journal_id: string; account_id: string }>(
      'SELECT id, journal_id, account_id FROM journal_line LIMIT 1',
    )[0]!
    db.run(`UPDATE journal_line SET debit = debit + 5 WHERE id = ?`, [line.id])
    expect(() => assertInvariants('tampered ledger')).toThrow()
    db.run(`UPDATE journal_line SET debit = debit - 5 WHERE id = ?`, [line.id])
    assertInvariants('restored')

    // a release larger than what the sale deferred
    db.run(`UPDATE package_credit_allocations SET released_amount = released_amount + 1000`)
    expect(() => assertInvariants('tampered allocation')).toThrow()
  })
})
