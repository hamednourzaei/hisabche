// ============================================
// packages/local-engine/src/__tests__/package-deferred-revenue-device.test.ts
//
// M5 - the DEVICE twin of the deferred-revenue release. The rule itself (which GRANT, expired or not, how much) is the
// shared function proven by the golden vectors; this proves the device WIRES it the way the server's trigger does:
//   · a delivery from a deferred GRANT books debit deferred revenue / credit sales for exactly that GRANT's unit value;
//   · cancelling gives back exactly what was released, in a new entry;
//   · an expired GRANT is skipped (the term starts at the first consume), and with nothing else eligible the delivery is
//     refused whole;
//   · a closed period refuses the whole delivery;
//   · a GRANT sold before the cut-over (no deferred amount) releases nothing and books nothing.
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

interface SessionView {
  id: string
}

function grant(opts: {
  id: string
  quantity: number
  deferred: number | null
  term?: number | null
  startsOn?: string
}) {
  db.run(
    `INSERT INTO package_credit_ledger (id, workspace_id, customer_id, package_product_id, entry_type, quantity,
       effective_date, deferred_amount, term_months, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'GRANT', ?, ?, ?, ?, '2026-10-01', '2026-10-01')`,
    [
      opts.id,
      ws,
      CUST,
      PACKAGE,
      opts.quantity,
      opts.startsOn ?? '2026-10-01',
      opts.deferred,
      opts.term ?? null,
    ],
  )
}

async function schedule(date = '2026-11-02'): Promise<SessionView> {
  const res = await engine.request<SessionView>({
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
  return res.data
}

const deliver = (id: string) =>
  engine.request<{ code?: string }>({
    method: 'POST',
    path: `/service-delivery/sessions/${id}/deliver`,
    headers,
    body: { packageProductId: PACKAGE },
  })

const cancel = (id: string) =>
  engine.request<{ code?: string }>({
    method: 'POST',
    path: `/service-delivery/sessions/${id}/cancel`,
    headers,
    body: { reason: 'customer asked' },
  })

const releases = () =>
  db.all<{ id: string; debit: number; credit: number; role: string }>(
    `SELECT je.id, jl.debit, jl.credit, a.role FROM journal_entry je
       JOIN journal_line jl ON jl.journal_id = je.id JOIN account a ON a.id = jl.account_id
      WHERE je.workspace_id = ? AND je.source_type = 'package_release' ORDER BY je.created_at, a.role`,
    [ws],
  )

const count = (sql: string) => db.all<{ n: number }>(`SELECT COUNT(*) AS n ${sql}`)[0]!.n

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
  db.run(
    `INSERT OR REPLACE INTO customer (id, workspace_id, full_name, created_at, updated_at)
     VALUES (?, ?, 'Zahra', '2026-11-01', '2026-11-01')`,
    [CUST, ws],
  )
  for (const [id, type] of [
    [SERVICE, 'service'],
    [PACKAGE, 'package'],
  ] as const) {
    db.run(
      `INSERT OR REPLACE INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at)
       VALUES (?, ?, 'x', 0, 1000, 0, 1, ?, '2026-11-01')`,
      [id, ws, type],
    )
  }
})

describe('M5 device: deferred revenue is released per delivery', () => {
  it('a delivery from a 10 000 / 10-session GRANT books 1 000 from deferred revenue to sales, and records the allocation', async () => {
    grant({ id: 'g-1', quantity: 10, deferred: 10000 })
    const session = await schedule()
    const res = await deliver(session.id)
    expect(res.status, JSON.stringify(res.data)).toBe(200)

    const lines = releases()
    expect(lines).toHaveLength(2)
    expect(lines.find((l) => l.role === 'deferred_revenue')).toMatchObject({
      debit: 1000,
      credit: 0,
    })
    expect(lines.find((l) => l.role === 'sales')).toMatchObject({ debit: 0, credit: 1000 })

    const allocation = db.all<{
      grant_entry_id: string
      quantity: number
      released_amount: number
    }>(
      `SELECT grant_entry_id, quantity, released_amount FROM package_credit_allocations WHERE kind = 'CONSUME'`,
    )
    expect(allocation).toEqual([{ grant_entry_id: 'g-1', quantity: 1, released_amount: 1000 }])
  })

  it('cancelling gives back exactly what was released, in a NEW entry (the release stays)', async () => {
    grant({ id: 'g-1', quantity: 10, deferred: 10000 })
    const session = await schedule()
    await deliver(session.id)
    const res = await cancel(session.id)
    expect(res.status, JSON.stringify(res.data)).toBe(200)

    expect(count("FROM journal_entry WHERE source_type = 'package_release'")).toBe(1)
    expect(count("FROM journal_entry WHERE source_type = 'reversal'")).toBe(1)
    const rev = db.all<{ role: string; debit: number; credit: number }>(
      `SELECT a.role, jl.debit, jl.credit FROM journal_entry je JOIN journal_line jl ON jl.journal_id = je.id
         JOIN account a ON a.id = jl.account_id WHERE je.source_type = 'reversal'`,
    )
    expect(rev.find((l) => l.role === 'deferred_revenue')).toMatchObject({ debit: 0, credit: 1000 })
    expect(rev.find((l) => l.role === 'sales')).toMatchObject({ debit: 1000, credit: 0 })
    expect(
      count("FROM package_credit_allocations WHERE kind = 'REVERSAL' AND grant_entry_id = 'g-1'"),
    ).toBe(1)
  })

  it('a GRANT sold before the cut-over (no deferred amount) releases nothing and books nothing', async () => {
    grant({ id: 'g-legacy', quantity: 3, deferred: null })
    const session = await schedule()
    expect((await deliver(session.id)).status).toBe(200)
    expect(releases()).toHaveLength(0)
    expect(count('FROM package_credit_allocations')).toBe(1)
  })

  it('SOLD != ACTIVATED: a never-used 1-month GRANT sold long ago is NOT expired; the first delivery starts its term', async () => {
    grant({ id: 'g-1', quantity: 5, deferred: 500, term: 1, startsOn: '2025-01-01' })
    const session = await schedule('2026-11-02')
    expect((await deliver(session.id)).status).toBe(200)
  })

  it('an EXPIRED GRANT is skipped; with no other eligible credit the delivery is refused whole', async () => {
    grant({ id: 'g-1', quantity: 5, deferred: 500, term: 1, startsOn: '2026-08-01' })
    const first = await schedule('2026-09-01')
    expect((await deliver(first.id)).status).toBe(200) // activates the term on 1 Sep: it ends on 1 Oct

    const late = await schedule('2026-11-02')
    const res = await deliver(late.id)
    expect(res.status).toBe(409)
    expect(JSON.stringify(res.data)).toContain('INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT')
    expect(count("FROM service_delivery_sessions WHERE status = 'delivered'")).toBe(1)
    expect(count("FROM package_credit_ledger WHERE entry_type = 'CONSUME'")).toBe(1)
  })

  it('an expired GRANT is skipped in favour of a newer one (history of both stays)', async () => {
    grant({ id: 'g-old', quantity: 5, deferred: 500, term: 1, startsOn: '2026-08-01' })
    const first = await schedule('2026-09-01')
    await deliver(first.id)
    grant({ id: 'g-new', quantity: 5, deferred: 1000, startsOn: '2026-10-20' })

    const late = await schedule('2026-11-02')
    expect((await deliver(late.id)).status).toBe(200)
    const used = db.all<{ grant_entry_id: string }>(
      `SELECT grant_entry_id FROM package_credit_allocations WHERE kind = 'CONSUME' ORDER BY created_at`,
    )
    expect(used.map((u) => u.grant_entry_id)).toEqual(['g-old', 'g-new'])
    expect(
      db.all<{ released_amount: number }>(
        `SELECT released_amount FROM package_credit_allocations WHERE grant_entry_id = 'g-new'`,
      )[0]!.released_amount,
    ).toBe(200)
  })

  it('a suspension of ONE GRANT skips it and leaves the others usable', async () => {
    grant({ id: 'g-1', quantity: 5, deferred: 500, startsOn: '2026-10-01' })
    grant({ id: 'g-2', quantity: 5, deferred: 1000, startsOn: '2026-10-05' })
    db.run(
      `INSERT INTO package_credit_suspensions (id, workspace_id, grant_entry_id, kind, effective_on, reason, created_at)
       VALUES ('s-1', ?, 'g-1', 'SUSPEND', '2026-11-01', 'test', '2026-11-01')`,
      [ws],
    )
    const session = await schedule()
    expect((await deliver(session.id)).status).toBe(200)
    expect(
      db.all<{ grant_entry_id: string }>(
        `SELECT grant_entry_id FROM package_credit_allocations`,
      )[0]!.grant_entry_id,
    ).toBe('g-2')
  })

  it('a closed accounting period refuses the WHOLE delivery: still scheduled, no consume, no allocation', async () => {
    grant({ id: 'g-1', quantity: 5, deferred: 500 })
    db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('period_lock', '2026-11-30')`)
    const session = await schedule('2026-11-02')
    const res = await deliver(session.id)
    expect(res.status).toBe(409)
    expect(JSON.stringify(res.data)).toContain('ACCOUNTING_PERIOD_LOCKED')
    expect(count("FROM service_delivery_sessions WHERE status = 'scheduled'")).toBe(1)
    expect(count("FROM package_credit_ledger WHERE entry_type = 'CONSUME'")).toBe(0)
    expect(count('FROM package_credit_allocations')).toBe(0)
  })
})

describe('M5 device: the SALE of a package', () => {
  const sell = () =>
    engine.request<{ id: string }>({
      method: 'POST',
      path: '/invoices',
      headers,
      body: {
        type: 'sale',
        customerId: CUST,
        currency: 'AFN',
        items: [{ productId: PACKAGE, productName: 'course', quantity: 10, unitPrice: 1000 }],
      },
    })

  const saleLines = () =>
    db.all<{ role: string; debit: number; credit: number }>(
      `SELECT a.role, jl.debit, jl.credit FROM journal_entry je JOIN journal_line jl ON jl.journal_id = je.id
         JOIN account a ON a.id = jl.account_id WHERE je.source_type = 'invoice' ORDER BY a.role`,
    )

  it('switch OFF (the default): revenue is booked at the sale and the GRANT carries no deferred amount', async () => {
    expect((await sell()).status).toBe(201)
    expect(saleLines().some((l) => l.role === 'deferred_revenue')).toBe(false)
    expect(saleLines().find((l) => l.role === 'sales')).toMatchObject({ credit: 10000 })
    expect(
      db.all<{ deferred_amount: number | null }>(
        `SELECT deferred_amount FROM package_credit_ledger WHERE entry_type = 'GRANT'`,
      )[0]!.deferred_amount,
    ).toBeNull()
  })

  it('switch ON: the package net goes to deferred revenue, the GRANT remembers the SAME amount and the product term', async () => {
    db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('package_deferred_revenue', 'on')`)
    db.run(`UPDATE product SET package_term_months = 6 WHERE id = ?`, [PACKAGE])
    expect((await sell()).status).toBe(201)
    expect(saleLines().find((l) => l.role === 'deferred_revenue')).toMatchObject({ credit: 10000 })
    expect(saleLines().some((l) => l.role === 'sales')).toBe(false)
    const grantRow = db.all<{ deferred_amount: number; term_months: number }>(
      `SELECT deferred_amount, term_months FROM package_credit_ledger WHERE entry_type = 'GRANT'`,
    )[0]!
    expect(grantRow).toEqual({ deferred_amount: 10000, term_months: 6 })
  })

  it('switch ON, then 10 deliveries release exactly the deferred total and nothing more', async () => {
    db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('package_deferred_revenue', 'on')`)
    expect((await sell()).status).toBe(201)
    for (let i = 0; i < 10; i += 1) {
      const session = await schedule()
      const res = await deliver(session.id)
      expect(res.status, JSON.stringify(res.data)).toBe(200)
    }
    const total = db.all<{ t: number }>(
      `SELECT SUM(released_amount) AS t FROM package_credit_allocations WHERE kind = 'CONSUME'`,
    )[0]!.t
    expect(total).toBe(10000)
    const deferredBalance = db.all<{ b: number }>(
      `SELECT COALESCE(SUM(jl.credit - jl.debit), 0) AS b FROM journal_line jl JOIN account a ON a.id = jl.account_id
        WHERE a.role = 'deferred_revenue'`,
    )[0]!.b
    expect(deferredBalance).toBe(0)
  })
})

describe('B2-5 on the device: the profit report reads the LEDGER (package revenue is recognised at delivery)', () => {
  const profit = async () => {
    const res = await engine.request<{
      totals: { revenue: number; deferredRevenueChange?: number }
    }>({
      method: 'GET',
      path: '/accounting/profit-report?from=2026-01-01&to=2026-12-31&currency=AFN',
      headers,
    })
    expect(res.status, JSON.stringify(res.data)).toBe(200)
    return res.data.totals
  }

  it('a package sold for 10 000 and delivered 3 times shows revenue 3 000 - not 10 000', async () => {
    db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('package_deferred_revenue', 'on')`)
    const sale = await engine.request({
      method: 'POST',
      path: '/invoices',
      headers,
      body: {
        type: 'sale',
        customerId: CUST,
        currency: 'AFN',
        date: '2026-11-01',
        items: [{ productId: PACKAGE, productName: 'course', quantity: 10, unitPrice: 1000 }],
      },
    })
    expect(sale.status, JSON.stringify(sale.data)).toBe(201)
    for (let i = 0; i < 3; i += 1)
      expect((await deliver((await schedule('2026-11-02')).id)).status).toBe(200)

    const totals = await profit()
    expect(totals.deferredRevenueChange).toBe(7000)
    expect(totals.revenue).toBe(3000)
  })

  it('with deferral OFF nothing changes: revenue is the invoice, no deferral field', async () => {
    const sale = await engine.request({
      method: 'POST',
      path: '/invoices',
      headers,
      body: {
        type: 'sale',
        customerId: CUST,
        currency: 'AFN',
        date: '2026-11-01',
        items: [{ productId: PACKAGE, productName: 'course', quantity: 10, unitPrice: 1000 }],
      },
    })
    expect(sale.status).toBe(201)
    const totals = await profit()
    expect(totals.revenue).toBe(10000)
    expect(totals.deferredRevenueChange).toBeUndefined()
  })
})

describe('C1 on the device (offline parity): a renewal is a NEW GRANT, an expired one is never revived', () => {
  it('the old remainder stays history; only the renewal can be consumed; a replay changes nothing', async () => {
    grant({ id: 'g-old', quantity: 5, deferred: 500, term: 1, startsOn: '2026-08-01' })
    expect((await deliver((await schedule('2026-09-01')).id)).status).toBe(200) // term starts 1 Sep, ends 1 Oct
    grant({ id: 'g-new', quantity: 4, deferred: 800, term: 1, startsOn: '2026-10-20' })

    const sessions: string[] = []
    for (let i = 0; i < 4; i += 1) {
      const session = await schedule('2026-11-02')
      sessions.push(session.id)
      expect((await deliver(session.id)).status).toBe(200)
    }
    const fifth = await schedule('2026-11-02')
    const refused = await deliver(fifth.id)
    expect(refused.status).toBe(409)
    expect(JSON.stringify(refused.data)).toContain('INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT')

    const spent = db.all<{ grant_entry_id: string; q: number; r: number }>(
      `SELECT grant_entry_id, SUM(quantity) AS q, SUM(released_amount) AS r FROM package_credit_allocations
        WHERE kind = 'CONSUME' GROUP BY grant_entry_id ORDER BY grant_entry_id`,
    )
    expect(spent).toEqual([
      { grant_entry_id: 'g-new', q: 4, r: 800 },
      { grant_entry_id: 'g-old', q: 1, r: 100 },
    ])

    // sync replay: delivering an already delivered session again writes nothing new
    const consumesBefore = count("FROM package_credit_ledger WHERE entry_type = 'CONSUME'")
    const allocationsBefore = count('FROM package_credit_allocations')
    expect((await deliver(sessions[0]!)).status).toBe(200)
    expect(count("FROM package_credit_ledger WHERE entry_type = 'CONSUME'")).toBe(consumesBefore)
    expect(count('FROM package_credit_allocations')).toBe(allocationsBefore)
  })
})

describe("M5 2.1: editing a package product's term never rewrites the GRANTs already sold (sale-time snapshot)", () => {
  it('a GRANT keeps the term it was sold with; only a LATER sale takes the new one', async () => {
    db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('package_deferred_revenue', 'on')`)
    db.run(`UPDATE product SET package_term_months = 6 WHERE id = ?`, [PACKAGE])
    const sell = () =>
      engine.request({
        method: 'POST',
        path: '/invoices',
        headers,
        body: {
          type: 'sale',
          customerId: CUST,
          currency: 'AFN',
          date: '2026-11-01',
          items: [{ productId: PACKAGE, productName: 'c', quantity: 2, unitPrice: 100 }],
        },
      })
    expect((await sell()).status).toBe(201)
    db.run(`UPDATE product SET package_term_months = 12 WHERE id = ?`, [PACKAGE])
    expect((await sell()).status).toBe(201)
    const terms = db.all<{ term_months: number }>(
      `SELECT term_months FROM package_credit_ledger WHERE entry_type = 'GRANT' ORDER BY created_at, rowid`,
    )
    expect(terms.map((t) => t.term_months)).toEqual([6, 12])
  })
})
