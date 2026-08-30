// ============================================
// backend/src/__tests__/http-integration.test.ts
//
// The vertical slice, exercised end to end: real HTTP → real route → real
// guards → real service → real domain → rows that are actually written and
// read back.
//
// ---------------------------------------------------------------------------
// WHAT THIS CATCHES THAT 1064 DOMAIN TESTS CANNOT
//
// The domain suites prove the rules. `vertical-slice-integration.test.ts`
// proves the wiring is SHAPED correctly by reading source. Neither one ever
// sends a request, so neither can see:
//
//   · a guard that is present but in the wrong order;
//   · an idempotency key that is declared and does not deduplicate;
//   · two concurrent closes that both succeed;
//   · a forged `x-workspace-id` that resolves anyway;
//   · a role that is refused in the domain but allowed by the route.
//
// Each of those is a real defect that leaves every existing test green.
//
// ---------------------------------------------------------------------------
// WHAT IT STILL CANNOT PROVE
//
// The store is `helpers/fake-supabase.ts`, not Postgres. RLS, foreign keys and
// real transactions are database features and are NOT tested here — a green
// run is not evidence that the policies work. `scripts/verify-rls.mjs` and
// `scripts/verify-slice.mjs` reach a real database and are where that proof
// lives. This file is deliberate about the line between the two.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

// ─── The world ───────────────────────────────────────────────────────────────

const db = new FakeDatabase()

const OWNER = { id: 'user-owner', token: 'token-owner' }
const SELLER = { id: 'user-seller', token: 'token-seller' }
const OUTSIDER = { id: 'user-outsider', token: 'token-outsider' }

const SHOP = 'workspace-shop'
const OTHER_SHOP = 'workspace-other'

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [SELLER.token, { id: SELLER.id }],
  [OUTSIDER.token, { id: OUTSIDER.id }],
])

vi.mock('../db', async () => {
  const { FakeDatabase: _unused } = await import('./helpers/fake-supabase')
  // The instance is the module-level `db` below; this factory closes over it
  // through the registry rather than constructing a second one.
  return (globalThis as any).__fakeDbModule
})

// ─── Fixtures ────────────────────────────────────────────────────────────────

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
    // A member of a DIFFERENT shop. Used to prove a forged header is refused.
    {
      id: fakeId('member'),
      workspace_id: OTHER_SHOP,
      user_id: OUTSIDER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
      joined_at: '2026-01-01T00:00:00Z',
    },
  ])

  // A minimal chart, enough for the till to book its day.
  db.seed('accounts', [
    account('1100', 'نقد', 'asset', 'cash'),
    account('1200', 'حساب‌های دریافتنی', 'asset', 'receivable'),
    account('4100', 'فروش', 'revenue', 'sales'),
  ])

  db.seed('accounting_period_locks', [])
}

/**
 * `role` is what a posting resolves by — not the code.
 *
 * A chart may number its cash account anything; the role is the contract the
 * ledger posts against, which is why `resolveAccountsByRole` reads it and only
 * falls back to a handful of legacy codes.
 */
function account(code: string, name: string, type: string, role: string): Row {
  return {
    id: fakeId('account'),
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

/**
 * The two RPCs the services call.
 *
 * Written to behave the way the SQL functions do in the parts the tests rely
 * on — an atomic write of parent and children, and a uniqueness rule that
 * makes a retry return the ORIGINAL row rather than creating a second.
 */
function registerRpcs() {
  db.rpc('pos_record_order', (args) => {
    const sessions = db.rows('pos_sessions')
    const session = sessions.find(
      (row) => row.id === args.p_session_id && row.workspace_id === args.p_workspace_id,
    )

    if (!session) throw new Error('POS_SESSION_NOT_FOUND')
    if (session.status !== 'open') throw new Error('POS_SESSION_NOT_OPEN')

    const payload = args.p_payload as Row
    const orders = db.rows('pos_orders')

    // The idempotency rule, as the unique index enforces it in SQL.
    const existing = orders.find(
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
        created_at: new Date('2026-08-30T09:00:00Z').toISOString(),
        // The real read uses a PostgREST embed; the fake carries the children
        // on the row so the same shape comes back.
        payments: (payload.payments as Row[]).map((payment) => ({
          method: payment.method,
          amount_minor: payment.amount_minor,
        })),
      },
    ])

    return { id, status: 'recorded' }
  })

  db.rpc('accounting_post_journal_entry', (args) => {
    const id = fakeId('entry')
    const entry = args.p_entry as Row

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
      },
    ])

    db.seed(
      'journal_lines',
      (args.p_lines as Row[]).map((line) => ({
        id: fakeId('line'),
        workspace_id: args.p_workspace_id,
        entry_id: id,
        account_id: line.account_id,
        debit: line.debit,
        credit: line.credit,
      })),
    )

    return id
  })
}

// ─── Boot ────────────────────────────────────────────────────────────────────

let app: FastifyInstance

beforeAll(async () => {
  ;(globalThis as any).__fakeDbModule = createFakeDb(db, users)
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

const as = (user: { token: string }, workspaceId = SHOP) => ({
  authorization: `Bearer ${user.token}`,
  'x-workspace-id': workspaceId,
})

async function openTill(user = OWNER, openingFloatMinor = 50_000) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/pos/sessions',
    headers: as(user),
    payload: { openingFloatMinor },
  })

  expect(response.statusCode, response.body).toBe(201)
  return JSON.parse(response.body) as { id: string }
}

// ═══════════════════════════════════════════════════════════════════════════
// Authentication and tenancy
// ═══════════════════════════════════════════════════════════════════════════

describe('the guards, over real HTTP', () => {
  it('refuses a request with no token', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/pos/sessions/current' })
    expect(response.statusCode).toBe(401)
  })

  it('refuses an unverifiable token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/pos/sessions/current',
      headers: { authorization: 'Bearer not-a-real-token' },
    })
    expect(response.statusCode).toBe(401)
  })

  /**
   * The header is a REQUEST, never an authorization.
   *
   * A member of another shop naming this one must be refused — and refused
   * with 403, not with an empty list. An empty list is indistinguishable from
   * "this shop has nothing yet" and hides the attempt from the user and the
   * logs alike.
   */
  it('refuses a workspace the caller does not belong to', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/pos/sessions/current',
      headers: as(OUTSIDER, SHOP),
    })

    expect(response.statusCode).toBe(403)
  })

  it('refuses a capability the role does not have', async () => {
    // A seller may ring up sales but may not read the shop's financials.
    const response = await app.inject({
      method: 'GET',
      url: '/api/pos/sessions/abandoned',
      headers: as(SELLER),
    })

    expect(response.statusCode).toBe(403)
  })

  it('lets the same seller do the job they are for', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/pos/sessions/current',
      headers: as(SELLER),
    })

    expect(response.statusCode).toBe(200)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Idempotency — the property the till depends on
// ═══════════════════════════════════════════════════════════════════════════

describe('recording a sale', () => {
  it('creates one order, not two, when the device retries', async () => {
    const session = await openTill()

    const order = {
      orderRef: 'device-a-0001',
      totalMinor: 12_500,
      changeMinor: 0,
      payments: [{ method: 'cash', amountMinor: 12_500 }],
    }

    const first = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/orders`,
      headers: as(OWNER),
      payload: order,
    })

    // The same request again, byte for byte — a device that never saw the
    // response and sent it a second time.
    const second = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/orders`,
      headers: as(OWNER),
      payload: order,
    })

    expect(first.statusCode, first.body).toBe(201)
    expect(second.statusCode, second.body).toBe(201)

    expect(db.rows('pos_orders')).toHaveLength(1)
    expect(JSON.parse(second.body).id).toBe(JSON.parse(first.body).id)
  })

  it('gives concurrent retries of one sale a single order', async () => {
    const session = await openTill()

    const send = () =>
      app.inject({
        method: 'POST',
        url: `/api/pos/sessions/${session.id}/orders`,
        headers: as(OWNER),
        payload: {
          orderRef: 'device-a-0002',
          totalMinor: 4_000,
          changeMinor: 0,
          payments: [{ method: 'cash', amountMinor: 4_000 }],
        },
      })

    const responses = await Promise.all([send(), send(), send()])

    for (const response of responses) expect(response.statusCode, response.body).toBe(201)
    expect(db.rows('pos_orders')).toHaveLength(1)
  })

  it('refuses a sale into a session that has closed', async () => {
    const session = await openTill()

    await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/close`,
      headers: as(OWNER),
      payload: { countedCashMinor: 50_000 },
    })

    const response = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/orders`,
      headers: as(OWNER),
      payload: {
        orderRef: 'device-a-0003',
        totalMinor: 1_000,
        changeMinor: 0,
        payments: [{ method: 'cash', amountMinor: 1_000 }],
      },
    })

    // Refused before the write is attempted: the service loads the session,
    // the domain says a closed drawer takes no sales, and that is a 400. The
    // database function refuses it a second time under a row lock — the two
    // are belt and braces, not duplicates.
    expect(response.statusCode).toBe(400)
    expect(response.body).toContain('POS_SESSION_NOT_OPEN')
    expect(db.rows('pos_orders')).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Closing the drawer — the money has to add up
// ═══════════════════════════════════════════════════════════════════════════

describe('closing the till', () => {
  it('derives expected cash from the session, and reports the variance', async () => {
    const session = await openTill(OWNER, 50_000)

    await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/orders`,
      headers: as(OWNER),
      payload: {
        orderRef: 'sale-1',
        totalMinor: 20_000,
        changeMinor: 0,
        payments: [{ method: 'cash', amountMinor: 20_000 }],
      },
    })

    // A card sale must NOT increase the cash the drawer is expected to hold.
    await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/orders`,
      headers: as(OWNER),
      payload: {
        orderRef: 'sale-2',
        totalMinor: 30_000,
        changeMinor: 0,
        payments: [{ method: 'card', amountMinor: 30_000 }],
      },
    })

    await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/cash`,
      headers: as(OWNER),
      payload: { kind: 'cash_out', amountMinor: 5_000, reason: 'خرید کیسه' },
    })

    // 50,000 float + 20,000 cash sale − 5,000 taken out = 65,000.
    const counted = 64_500

    const response = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/close`,
      headers: as(OWNER),
      payload: { countedCashMinor: counted, varianceReason: 'کسری ۵۰۰' },
    })

    expect(response.statusCode, response.body).toBe(200)
    const body = JSON.parse(response.body)

    expect(body.totals.expectedCashMinor).toBe(65_000)
    expect(body.totals.varianceMinor).toBe(-500)
    expect(body.totals.grossSalesMinor).toBe(50_000)
    expect(body.session.status).toBe('closed')
  })

  it('books the day once, even when the close is retried', async () => {
    const session = await openTill()

    await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/orders`,
      headers: as(OWNER),
      payload: {
        orderRef: 'sale-1',
        totalMinor: 10_000,
        changeMinor: 0,
        payments: [{ method: 'cash', amountMinor: 10_000 }],
      },
    })

    const close = () =>
      app.inject({
        method: 'POST',
        url: `/api/pos/sessions/${session.id}/close`,
        headers: as(OWNER),
        payload: { countedCashMinor: 60_000 },
      })

    const first = await close()
    expect(first.statusCode, first.body).toBe(200)
    expect(JSON.parse(first.body).posted).toBe(true)

    await close()

    // Two closes, one journal entry: the posting is keyed by the session.
    const entries = db.rows('journal_entries').filter((row) => row.source_type === 'pos_session')

    expect(entries).toHaveLength(1)
  })

  it('produces a balanced entry — the variance does not vanish', async () => {
    const session = await openTill(OWNER, 0)

    await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/orders`,
      headers: as(OWNER),
      payload: {
        orderRef: 'sale-1',
        totalMinor: 10_000,
        changeMinor: 0,
        payments: [{ method: 'cash', amountMinor: 10_000 }],
      },
    })

    await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/close`,
      headers: as(OWNER),
      payload: { countedCashMinor: 9_700, varianceReason: 'کسری' },
    })

    const lines = db.rows('journal_lines')
    expect(lines.length).toBeGreaterThan(0)

    const debits = lines.reduce((sum, line) => sum + Number(line.debit), 0)
    const credits = lines.reduce((sum, line) => sum + Number(line.credit), 0)

    expect(Math.round(debits * 100)).toBe(Math.round(credits * 100))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Tenant scoping, observed rather than asserted
// ═══════════════════════════════════════════════════════════════════════════

describe('tenant scoping', () => {
  it('scopes every write to the caller workspace', async () => {
    const session = await openTill()

    await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${session.id}/orders`,
      headers: as(OWNER),
      payload: {
        orderRef: 'sale-1',
        totalMinor: 1_000,
        changeMinor: 0,
        payments: [{ method: 'cash', amountMinor: 1_000 }],
      },
    })

    for (const table of ['pos_sessions', 'pos_orders']) {
      for (const row of db.rows(table)) {
        expect(row.workspace_id, `${table} row escaped the workspace`).toBe(SHOP)
      }
    }
  })

  /**
   * The check that would have caught the `user_id` filtering defect: reads of
   * shared tables must be scoped by WORKSPACE, and must not narrow to the
   * acting user — otherwise a manager cannot see what a seller rang up.
   */
  it('never filters a shared table by user_id', async () => {
    db.queries.length = 0

    const session = await openTill()
    await app.inject({
      method: 'GET',
      url: `/api/pos/sessions/${session.id}`,
      headers: as(OWNER),
    })

    const shared = ['pos_orders', 'pos_cash_movements', 'accounts', 'journal_entries']

    for (const query of db.queries) {
      if (!shared.includes(query.table)) continue
      expect(query.filters, `${query.table} was filtered by user_id`).not.toContain('eq:user_id')
    }
  })

  it('cannot reach another workspace session by id', async () => {
    const session = await openTill()

    // The outsider names their OWN workspace — which is allowed — and then
    // asks for a session id belonging to the shop.
    const response = await app.inject({
      method: 'GET',
      url: `/api/pos/sessions/${session.id}`,
      headers: as(OUTSIDER, OTHER_SHOP),
    })

    expect(response.statusCode).toBe(404)
  })
})
