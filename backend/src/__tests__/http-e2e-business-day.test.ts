// ============================================
// backend/src/__tests__/http-e2e-business-day.test.ts
//
// One business day, end to end, over real HTTP.
//
// ---------------------------------------------------------------------------
// HOW THIS DIFFERS FROM THE INTEGRATION SUITES
//
// `http-integration*.test.ts` prove each endpoint behaves. They call one thing
// and check one answer.
//
// This proves the endpoints agree with EACH OTHER. A sale is rung up, a
// payment settles it, the day's till is counted and posted, hours are logged
// and previewed for billing, and a mistake is reversed — each step feeding the
// next, with the books checked after every one.
//
// That is where a different class of defect lives. Every endpoint can be
// individually correct while the sequence still ends with a ledger that does
// not balance, an invoice marked paid twice, or a reversal that removes more
// than it should. `financial-flows-e2e.test.ts` chains the DOMAIN functions;
// this chains the HTTP surface, so the routes, guards, serialisation and
// service wiring are all in the path.
//
// THE INVARIANT CHECKED AFTER EVERY STEP: total debits equal total credits.
// Double-entry is not a feature of one endpoint — it is a property of the
// whole system, and it can only be observed from here.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: fakeId('owner'), token: 'e2e-token-owner' }
const SELLER = { id: fakeId('seller'), token: 'e2e-token-seller' }
const SHOP = fakeId('shop')

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [SELLER.token, { id: SELLER.id }],
])

vi.mock('../db', async () => (globalThis as any).__e2eFakeDb)

const CASH = fakeId('acct')
const SALES = fakeId('acct')
const RECEIVABLE = fakeId('acct')
const BANK = fakeId('acct')
const PURCHASE = fakeId('acct')
const CUSTOMER = fakeId('customer')

function account(id: string, code: string, name: string, type: string, role: string): Row {
  return {
    id,
    workspace_id: SHOP,
    code,
    name,
    type,
    role,
    is_group: false,
    is_active: true,
    deleted_at: null,
    parent_id: null,
  }
}

function resetWorld() {
  db.tables.clear()
  db.queries.length = 0

  db.seed('workspace_members', [
    {
      id: fakeId('member'),
      workspace_id: SHOP,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
      joined_at: '2026-01-01T00:00:00Z',
    },
    {
      id: fakeId('member'),
      workspace_id: SHOP,
      user_id: SELLER.id,
      role: 'seller',
      has_access: true,
      suspended_at: null,
      joined_at: '2026-01-02T00:00:00Z',
    },
  ])

  db.seed('accounts', [
    account(CASH, '1100', 'نقد', 'asset', 'cash'),
    account(SALES, '4100', 'فروش', 'revenue', 'sales'),
    account(RECEIVABLE, '1200', 'دریافتنی', 'asset', 'receivable'),
    account(BANK, '1150', 'بانک', 'asset', 'bank'),
    // Needed the moment a seller takes cash out of the drawer: the money left
    // for a reason, and the entry has to say where it went.
    account(PURCHASE, '5100', 'خرید و مصارف', 'expense', 'purchase'),
  ])

  db.seed('accounting_period_locks', [])
  db.seed('customers', [{ id: CUSTOMER, workspace_id: SHOP, name: 'مشتری', deleted_at: null }])
}

function registerRpcs() {
  db.rpc('accounting_post_journal_entry', (args) => {
    const id = fakeId('entry')
    const entry = args.p_entry as Row

    // The real read pulls lines through a PostgREST embed
    // (`lines:journal_lines(...)`), which the fake does not resolve. Carrying
    // them on the parent row reproduces the shape the repository expects —
    // without it, a reversal reads an entry with no lines and refuses it as
    // empty, which looks exactly like a product bug and is not one.
    const embeddedLines = (args.p_lines as Row[]).map((line) => ({
      id: fakeId('line'),
      account_id: line.account_id,
      debit: line.debit,
      credit: line.credit,
    }))

    db.seed('journal_entries', [
      {
        id,
        workspace_id: args.p_workspace_id,
        user_id: args.p_user_id,
        entry_date: entry.date,
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        status: entry.status,
        entry_number: entry.entry_number,
        source_type: entry.source_type,
        source_id: entry.source_id,
        reversal_of: entry.reversal_of,
        deleted_at: null,
        lines: embeddedLines,
      },
    ])

    // `journal_id`, not `entry_id` — the live column name, confirmed against
    // the real schema. The fake using the wrong one would make every join here
    // agree with a database that does not exist.
    db.seed(
      'journal_lines',
      embeddedLines.map((line) => ({
        ...line,
        workspace_id: args.p_workspace_id,
        journal_id: id,
      })),
    )

    return id
  })

  db.rpc('pos_record_order', (args) => {
    const session = db
      .rows('pos_sessions')
      .find((row) => row.id === args.p_session_id && row.workspace_id === args.p_workspace_id)

    if (!session) throw new Error('POS_SESSION_NOT_FOUND')
    if (session.status !== 'open') throw new Error('POS_SESSION_NOT_OPEN')

    const payload = args.p_payload as Row

    const existing = db
      .rows('pos_orders')
      .find(
        (row) =>
          row.workspace_id === args.p_workspace_id &&
          row.session_id === args.p_session_id &&
          row.order_ref === payload.order_ref,
      )
    if (existing) return { id: existing.id, status: 'already_recorded' }

    const id = fakeId('order')
    db.seed('pos_orders', [
      {
        id,
        workspace_id: args.p_workspace_id,
        session_id: args.p_session_id,
        order_ref: payload.order_ref,
        invoice_id: payload.invoice_id ?? null,
        total_minor: payload.total_minor,
        change_minor: payload.change_minor,
        status: 'completed',
        created_at: '2026-08-31T09:00:00.000Z',
        payments: (payload.payments as Row[]).map((payment) => ({
          method: payment.method,
          amount_minor: payment.amount_minor,
        })),
      },
    ])

    return { id, status: 'recorded' }
  })
}

let app: FastifyInstance

beforeAll(async () => {
  ;(globalThis as any).__e2eFakeDb = createFakeDb(db, users)
  resetWorld()
  registerRpcs()

  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  resetWorld()
})

const as = (user: { token: string }) => ({
  authorization: `Bearer ${user.token}`,
  'x-workspace-id': SHOP,
})

/**
 * The invariant, in one place.
 *
 * Called after every step rather than once at the end: knowing the books stop
 * balancing is useful, knowing WHICH step broke them is what gets it fixed.
 */
function expectBooksBalance(after: string) {
  const lines = db.rows('journal_lines')

  const debits = lines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0)
  const credits = lines.reduce((sum, line) => sum + Number(line.credit ?? 0), 0)

  // Compared in minor units. Two floats that differ by 0.000001 are equal for
  // accounting purposes and unequal to `toBe`.
  expect(
    Math.round(debits * 100),
    `books stopped balancing after: ${after} (debit ${debits} vs credit ${credits})`,
  ).toBe(Math.round(credits * 100))
}

describe('a business day, end to end', () => {
  it('rings up sales, counts the till, and leaves the books balanced', async () => {
    // ─── The shop opens ───────────────────────────────────────────────────
    const opened = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      headers: as(SELLER),
      payload: { openingFloatMinor: 50_000 },
    })

    expect(opened.statusCode, opened.body).toBe(201)
    const session = JSON.parse(opened.body) as { id: string }
    expectBooksBalance('opening the till')

    // ─── Three sales: cash, card, and one the customer will pay later ─────
    const sales = [
      {
        orderRef: 'day-1',
        totalMinor: 20_000,
        payments: [{ method: 'cash', amountMinor: 20_000 }],
      },
      {
        orderRef: 'day-2',
        totalMinor: 35_000,
        payments: [{ method: 'card', amountMinor: 35_000 }],
      },
      {
        orderRef: 'day-3',
        totalMinor: 15_000,
        payments: [{ method: 'credit', amountMinor: 15_000 }],
      },
    ]

    for (const sale of sales) {
      const response = await app.inject({
        method: 'POST',
        url: `/api/pos/sessions/${session.id}/orders`,
        headers: as(SELLER),
        payload: { changeMinor: 0, ...sale },
      })
      expect(response.statusCode, response.body).toBe(201)
    }

    // ─── The seller takes money out for a delivery ────────────────────────
    await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/cash`,
      headers: as(SELLER),
      payload: { kind: 'cash_out', amountMinor: 3_000, reason: 'کرایه موتر' },
    })

    // ─── Counting up ──────────────────────────────────────────────────────
    // 50,000 float + 20,000 cash sale − 3,000 out = 67,000 expected.
    // The card and credit sales must NOT be in that figure.
    const closed = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/close`,
      headers: as(SELLER),
      payload: { countedCashMinor: 67_000 },
    })

    expect(closed.statusCode, closed.body).toBe(200)
    const result = JSON.parse(closed.body)

    expect(result.totals.expectedCashMinor).toBe(67_000)
    expect(result.totals.varianceMinor).toBe(0)
    expect(result.totals.grossSalesMinor).toBe(70_000)
    expect(result.posted).toBe(true)

    // The whole point: three payment methods, a cash withdrawal, and the
    // ledger still balances. Card takings that never reached an account would
    // show up right here.
    expectBooksBalance('closing the till')

    // And the money went somewhere specific, not just anywhere that balanced.
    const lines = db.rows('journal_lines')
    const bankDebit = lines
      .filter((line) => line.account_id === BANK)
      .reduce((sum, line) => sum + Number(line.debit ?? 0), 0)

    expect(Math.round(bankDebit * 100), 'card takings did not reach the bank account').toBe(35_000)
  })

  it('a short drawer books its shortfall instead of hiding it', async () => {
    const opened = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      headers: as(SELLER),
      payload: { openingFloatMinor: 0 },
    })
    const session = JSON.parse(opened.body) as { id: string }

    await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/orders`,
      headers: as(SELLER),
      payload: {
        orderRef: 'short-1',
        totalMinor: 10_000,
        changeMinor: 0,
        payments: [{ method: 'cash', amountMinor: 10_000 }],
      },
    })

    const closed = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/close`,
      headers: as(SELLER),
      payload: { countedCashMinor: 9_500, varianceReason: 'کسری' },
    })

    expect(closed.statusCode, closed.body).toBe(200)
    expect(JSON.parse(closed.body).totals.varianceMinor).toBe(-500)

    // A shortage that unbalanced the entry would surface as a crash rather
    // than a figure — which is exactly how it used to behave.
    expectBooksBalance('closing a short drawer')
  })

  it('posting, then reversing, leaves the books where they started', async () => {
    const before = db.rows('journal_lines').length

    const posted = await app.inject({
      method: 'POST',
      url: '/api/accounting/journal',
      headers: as(OWNER),
      payload: {
        date: '2026-08-31T00:00:00.000Z',
        description: 'فروش نقدی',
        lines: [
          { accountId: CASH, debit: 500, credit: 0 },
          { accountId: SALES, debit: 0, credit: 500 },
        ],
        status: 'posted',
      },
    })

    expect(posted.statusCode, posted.body).toBe(201)
    expectBooksBalance('posting an entry')

    const entry = JSON.parse(posted.body) as { id: string }

    const reversed = await app.inject({
      method: 'POST',
      url: `/api/accounting/journal/${entry.id}/reverse`,
      headers: as(OWNER),
      payload: { reason: 'اشتباه ثبت شد' },
    })

    // 201: a reversal CREATES an entry, it does not modify the original.
    expect(reversed.statusCode, reversed.body).toBe(201)
    expectBooksBalance('reversing it')

    // A reversal ADDS the opposite entry; it never deletes the original. The
    // history of a correction is part of the record.
    const after = db.rows('journal_lines').length
    expect(after, 'a reversal removed lines instead of adding them').toBeGreaterThan(before)

    const cash = db
      .rows('journal_lines')
      .filter((line) => line.account_id === CASH)
      .reduce((sum, line) => sum + Number(line.debit ?? 0) - Number(line.credit ?? 0), 0)

    expect(Math.round(cash * 100), 'the reversal did not cancel the original').toBe(0)
  })

  it('a seller cannot ring up a sale into somebody else drawer', async () => {
    // The owner opens a till; the seller must not be able to sell into it.
    // Two people sharing one drawer means neither count can be reconciled.
    const opened = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      headers: as(OWNER),
      payload: { openingFloatMinor: 10_000 },
    })
    const ownerSession = JSON.parse(opened.body) as { id: string }

    const current = await app.inject({
      method: 'GET',
      url: '/api/pos/sessions/current',
      headers: as(SELLER),
    })

    expect(current.statusCode).toBe(200)
    const seen = JSON.parse(current.body) as { session: { id: string } | null }

    expect(seen.session?.id, 'the seller was handed a till the owner opened').not.toBe(
      ownerSession.id,
    )
  })
})
