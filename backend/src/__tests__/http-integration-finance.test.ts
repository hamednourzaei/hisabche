// ============================================
// backend/src/__tests__/http-integration-finance.test.ts
//
// The rest of the vertical slice over real HTTP: accounting, payments,
// budgets, timesheets, traceability and the conflict queue.
//
// `http-integration.test.ts` covers the till. This file covers everything
// else that writes money, and asks the same questions of each:
//
//   · does the guard actually run, and in the right order?
//   · does the idempotency key actually deduplicate?
//   · is a refusal a refusal, or does the write land anyway?
//   · does a second workspace stay invisible?
//
// The same caveat applies: the store is a fake, not Postgres. RLS and real
// transactions are proven by `scripts/verify-rls.mjs` against a real database,
// never here.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: fakeId('owner'), token: 'fin-token-owner' }
const SELLER = { id: fakeId('seller'), token: 'fin-token-seller' }

const SHOP = fakeId('shop')

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [SELLER.token, { id: SELLER.id }],
])

vi.mock('../db', async () => (globalThis as any).__financeFakeDb)

// ─── Fixtures ────────────────────────────────────────────────────────────────

/**
 * Fixture ids are minted ONCE, not per test.
 *
 * The services cache the chart of accounts per workspace for five minutes. Ids
 * regenerated in `beforeEach` would leave the cache holding the previous
 * test's accounts, and every posting after the first would fail with
 * JOURNAL_LINE_ACCOUNT_UNKNOWN — a cache artefact that looks exactly like a
 * validation bug. Stable ids keep the cache correct across the file.
 */
const CASH = fakeId('acct')
const SALES = fakeId('acct')
const RECEIVABLE = fakeId('acct')
const BANK = fakeId('acct')
const PROJECT = fakeId('project')
const EMPLOYEE = fakeId('employee')
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
  ])
  db.seed('accounting_period_locks', [])

  db.seed('projects', [
    { id: PROJECT, workspace_id: SHOP, name: 'بازسازی دکان', status: 'active', deleted_at: null },
  ])
  db.seed('employees', [
    { id: EMPLOYEE, workspace_id: SHOP, name: 'کارمند', cost_rate_minor: 20_000, deleted_at: null },
  ])
  db.seed('customers', [{ id: CUSTOMER, workspace_id: SHOP, name: 'مشتری', deleted_at: null }])
}

function registerRpcs() {
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

  db.rpc('payments_record', (args) => {
    const id = fakeId('payment')
    const payment = args.p_payment as Row

    db.seed('payments', [
      {
        id,
        workspace_id: args.p_workspace_id,
        user_id: args.p_user_id,
        payment_number: payment.payment_number,
        direction: payment.direction,
        party_type: payment.party_type,
        party_id: payment.party_id,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        entry_date: payment.entry_date,
        reference: payment.reference,
        notes: payment.notes,
        status: payment.status,
        journal_entry_id: null,
        deleted_at: null,
      },
    ])

    db.seed(
      'payment_allocations',
      (args.p_allocations as Row[]).map((allocation) => ({
        id: fakeId('alloc'),
        workspace_id: args.p_workspace_id,
        payment_id: id,
        invoice_id: allocation.invoice_id,
        amount: allocation.amount,
      })),
    )

    return id
  })
}

let app: FastifyInstance

beforeAll(async () => {
  ;(globalThis as any).__financeFakeDb = createFakeDb(db, users)
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

const today = '2026-08-30'

/**
 * The ledger's `date` is validated as a full date-time, not a date.
 *
 * Worth stating rather than papering over: body validation runs BEFORE the
 * preHandler guards in Fastify, so a malformed date reaches the client as 400
 * even on a request the role was never allowed to make. The authorization
 * tests below therefore have to send a VALID body to reach the 403 they are
 * about — a test that sends junk proves only that the schema works.
 */
const todayIso = '2026-08-30T00:00:00.000Z'

// ═══════════════════════════════════════════════════════════════════════════
// Accounting
// ═══════════════════════════════════════════════════════════════════════════

describe('the ledger, over real HTTP', () => {
  it('refuses an unbalanced entry rather than storing it', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/accounting/journal',
      headers: as(OWNER),
      payload: {
        date: todayIso,
        description: 'نامتراز',
        lines: [
          { accountId: CASH, debit: 500, credit: 0 },
          { accountId: SALES, debit: 0, credit: 400 },
        ],
      },
    })

    expect(response.statusCode).toBe(400)
    // The important half: nothing was written on the way to the refusal.
    expect(db.rows('journal_entries')).toHaveLength(0)
    expect(db.rows('journal_lines')).toHaveLength(0)
  })

  it('accepts a balanced entry and writes its lines', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/accounting/journal',
      headers: as(OWNER),
      payload: {
        date: todayIso,
        description: 'فروش نقدی',
        lines: [
          { accountId: CASH, debit: 500, credit: 0 },
          { accountId: SALES, debit: 0, credit: 500 },
        ],
      },
    })

    expect(response.statusCode, response.body).toBe(201)
    expect(db.rows('journal_lines')).toHaveLength(2)

    for (const row of db.rows('journal_entries')) {
      expect(row.workspace_id).toBe(SHOP)
    }
  })

  it('does not let a seller post to the ledger', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/accounting/journal',
      headers: as(SELLER),
      payload: {
        date: todayIso,
        description: 'تلاش فروشنده',
        lines: [
          { accountId: CASH, debit: 100, credit: 0 },
          { accountId: SALES, debit: 0, credit: 100 },
        ],
      },
    })

    expect(response.statusCode).toBe(403)
    expect(db.rows('journal_entries')).toHaveLength(0)
  })

  it('refuses a line against an account that does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/accounting/journal',
      headers: as(OWNER),
      payload: {
        date: todayIso,
        description: 'حساب ناموجود',
        lines: [
          { accountId: fakeId('ghost'), debit: 100, credit: 0 },
          { accountId: SALES, debit: 0, credit: 100 },
        ],
      },
    })

    expect(response.statusCode).toBeGreaterThanOrEqual(400)
    expect(db.rows('journal_entries')).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Payments
// ═══════════════════════════════════════════════════════════════════════════

describe('payments, over real HTTP', () => {
  it('records a receipt and books it', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/payments',
      headers: as(OWNER),
      payload: {
        direction: 'in',
        partyType: 'customer',
        partyId: CUSTOMER,
        amount: 250,
        entryDate: today,
      },
    })

    expect(response.statusCode, response.body).toBe(201)
    expect(db.rows('payments')).toHaveLength(1)
    expect(db.rows('payments')[0]!.workspace_id).toBe(SHOP)

    // A receipt must reach the ledger, not just the payments table.
    const entries = db.rows('journal_entries').filter((row) => row.source_type === 'payment')
    expect(entries.length).toBeGreaterThan(0)
  })

  it('refuses a payment of zero', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/payments',
      headers: as(OWNER),
      payload: {
        direction: 'in',
        partyType: 'customer',
        partyId: CUSTOMER,
        amount: 0,
        entryDate: today,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(db.rows('payments')).toHaveLength(0)
  })

  it('books a receipt balanced', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/payments',
      headers: as(OWNER),
      payload: {
        direction: 'in',
        partyType: 'customer',
        partyId: CUSTOMER,
        amount: 250,
        entryDate: today,
      },
    })

    const lines = db.rows('journal_lines')
    const debits = lines.reduce((sum, line) => sum + Number(line.debit), 0)
    const credits = lines.reduce((sum, line) => sum + Number(line.credit), 0)

    expect(Math.round(debits * 100)).toBe(Math.round(credits * 100))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Budgets — a control, asked before the money moves
// ═══════════════════════════════════════════════════════════════════════════

describe('budgets, over real HTTP', () => {
  it('answers a spend check without writing anything', async () => {
    db.seed('budgets', [
      {
        id: fakeId('budget'),
        workspace_id: SHOP,
        account_id: SALES,
        period: 'monthly',
        starts_on: '2026-08-01',
        amount_minor: 100_000,
        action: 'block',
        warn_at_percent: 80,
        is_active: true,
        dimension_value_id: null,
        branch_id: null,
      },
    ])

    const before = db.rows('budgets').length

    const response = await app.inject({
      method: 'POST',
      url: '/api/operations/budgets/check',
      headers: as(OWNER),
      payload: { accountId: SALES, amountMinor: 5_000, onDate: today },
    })

    expect(response.statusCode, response.body).toBe(200)
    // A check is a question. It must not create, consume or reserve anything.
    expect(db.rows('budgets')).toHaveLength(before)
  })

  it('does not let a seller read the budget list', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/operations/budgets',
      headers: as(SELLER),
    })

    expect(response.statusCode).toBe(403)
  })

  // The budget list is cached per workspace; these tests seed rows directly.
  beforeEach(async () => {
    const { memoryCache } = await import('../utils/pagination')
    await memoryCache.invalidate(`budget:${SHOP}`)
  })

  const budgetRow = (id: string, extra: Row = {}): Row => ({
    id,
    workspace_id: SHOP,
    account_id: SALES,
    period: 'monthly',
    starts_on: '2026-08-01',
    amount_minor: 100_000,
    action: 'block',
    warn_at_percent: 80,
    is_active: true,
    dimension_value_id: null,
    branch_id: null,
    name: null,
    budget_type: 'expense',
    status: 'approved',
    version: 1,
    distribution: null,
    notes: null,
    approved_by: null,
    approved_at: null,
    created_by: null,
    ...extra,
  })

  it('a permission denial is 403, never 409', async () => {
    for (const [method, url] of [
      ['GET', '/api/operations/budgets/report'],
      ['PUT', `/api/operations/budgets/${fakeId('budget')}`],
      ['POST', `/api/operations/budgets/${fakeId('budget')}/approve`],
    ] as const) {
      const response = await app.inject({
        method,
        url,
        headers: as(SELLER),
        ...(method === 'PUT'
          ? {
              payload: {
                accountId: SALES,
                period: 'monthly',
                startsOn: '2026-08-01',
                amountMinor: 1,
                action: 'warn',
              },
            }
          : {}),
      })
      expect(response.statusCode, `${method} ${url}`).toBe(403)
    }
  })

  it('an approved budget is revised, never overwritten (409)', async () => {
    const id = fakeId('budget')
    db.seed('budgets', [budgetRow(id)])

    const response = await app.inject({
      method: 'PUT',
      url: `/api/operations/budgets/${id}`,
      headers: as(OWNER),
      payload: {
        accountId: SALES,
        period: 'monthly',
        startsOn: '2026-08-01',
        amountMinor: 999_999,
        action: 'warn',
      },
    })

    expect(response.statusCode, response.body).toBe(409)
    expect(response.json().error).toContain('BUDGET_APPROVED_REQUIRES_REVISION')
    expect(db.rows('budgets').find((r) => r.id === id)?.amount_minor).toBe(100_000)
  })

  it('approving a draft that overlaps an approved budget is a 409 conflict', async () => {
    const approved = fakeId('budget')
    const draft = fakeId('budget')
    db.seed('budgets', [budgetRow(approved), budgetRow(draft, { status: 'draft' })])

    const response = await app.inject({
      method: 'POST',
      url: `/api/operations/budgets/${draft}/approve`,
      headers: as(OWNER),
    })

    expect(response.statusCode, response.body).toBe(409)
    expect(response.json().error).toContain('BUDGET_OVERLAP')
    expect(db.rows('budgets').find((r) => r.id === draft)?.status).toBe('draft')
  })

  it('strict separation of duties: the drafter cannot approve their own budget', async () => {
    const draft = fakeId('budget')
    db.seed('budgets', [budgetRow(draft, { status: 'draft', account_id: CASH })])
    db.seed('sod_settings', [{ workspace_id: SHOP, mode: 'strict', disabled_rules: [] }])
    db.seed('sod_actions', [
      {
        id: fakeId('sod'),
        workspace_id: SHOP,
        entity_type: 'budget',
        entity_id: draft,
        capability: 'budget.manage',
        actor_id: OWNER.id,
        actor_role: 'owner',
        created_at: '2026-08-01T00:00:00Z',
      },
    ])
    const { memoryCache } = await import('../utils/pagination')
    await memoryCache.invalidate('sod')

    const response = await app.inject({
      method: 'POST',
      url: `/api/operations/budgets/${draft}/approve`,
      headers: as(OWNER),
      payload: {},
    })

    expect(response.statusCode, response.body).toBe(409)
    expect(response.json().error).toContain('SOD_BLOCKED:budget.draft-then-approve')
    expect(db.rows('budgets').find((r) => r.id === draft)?.status).toBe('draft')
  })

  it('the report is ONE aggregate call however many budgets exist, with revenue sign normalised', async () => {
    const expense = fakeId('budget')
    const revenue = fakeId('budget')
    db.seed('budgets', [
      budgetRow(expense, { account_id: CASH }),
      budgetRow(revenue, { account_id: SALES, budget_type: 'revenue' }),
    ])

    let calls = 0
    db.rpc('budget_performance_batch', () => {
      calls += 1
      return {
        actuals: [
          { account_id: CASH, day: '2026-08-10', net_minor: 30_000 },
          // Revenue is credit: debit − credit is negative.
          { account_id: SALES, day: '2026-08-10', net_minor: -120_000 },
        ],
        commitments: [{ budget_id: expense, open_minor: 20_000 }],
      }
    })

    const response = await app.inject({
      method: 'GET',
      url: `/api/operations/budgets/report?onDate=${today}`,
      headers: as(OWNER),
    })

    expect(response.statusCode, response.body).toBe(200)
    expect(calls).toBe(1)
    const body = response.json()
    const byId = new Map<string, any>(body.rows.map((r: any) => [r.budget.id, r.performance]))
    expect(byId.get(expense)).toMatchObject({
      actualMinor: 30_000,
      openCommitmentMinor: 20_000,
      remainingMinor: 50_000,
      varianceMinor: 70_000,
    })
    expect(byId.get(revenue)).toMatchObject({ actualMinor: 120_000, varianceMinor: 20_000 })
    expect(body.source).toBe('batch')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Timesheets — minutes, and the invoice lock
// ═══════════════════════════════════════════════════════════════════════════

describe('timesheets, over real HTTP', () => {
  it('stores a duration as whole minutes', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/operations/timesheets',
      headers: as(OWNER),
      payload: {
        projectId: PROJECT,
        employeeId: EMPLOYEE,
        onDate: today,
        minutes: 90,
        billable: true,
        description: 'کار روی سقف',
      },
    })

    expect(response.statusCode, response.body).toBe(201)

    const entries = db.rows('time_entries')
    expect(entries).toHaveLength(1)
    expect(entries[0]!.minutes).toBe(90)
    expect(Number.isInteger(entries[0]!.minutes)).toBe(true)
    expect(entries[0]!.workspace_id).toBe(SHOP)
  })

  it('refuses a fractional or zero duration', async () => {
    for (const minutes of [0, -30, 1.5]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/operations/timesheets',
        headers: as(OWNER),
        payload: {
          projectId: PROJECT,
          employeeId: EMPLOYEE,
          onDate: today,
          minutes,
        },
      })

      expect(response.statusCode, `minutes=${minutes}`).toBe(400)
    }

    expect(db.rows('time_entries')).toHaveLength(0)
  })

  it('previews billing without billing anything', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/operations/timesheets',
      headers: as(OWNER),
      payload: {
        projectId: PROJECT,
        employeeId: EMPLOYEE,
        onDate: today,
        minutes: 120,
        billable: true,
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: `/api/operations/timesheets/${PROJECT}/billing-preview`,
      headers: as(OWNER),
    })

    expect(response.statusCode, response.body).toBe(200)

    // The preview takes no hours: `invoice_id` is still null on every entry.
    for (const entry of db.rows('time_entries')) {
      expect(entry.invoice_id ?? null).toBeNull()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Traceability — expiry is a refusal
// ═══════════════════════════════════════════════════════════════════════════

describe('batches, over real HTTP', () => {
  it('will not draw from an expired batch', async () => {
    const product = fakeId('product')

    db.seed('stock_batches', [
      {
        id: fakeId('batch'),
        workspace_id: SHOP,
        product_id: product,
        batch_number: 'EXPIRED-1',
        expiry_date: '2026-01-01',
        received_qty: 100,
        remaining_qty: 100,
        cost_layer_id: null,
        warehouse_id: null,
        received_on: '2025-12-01',
        manufactured_date: null,
      },
    ])

    const response = await app.inject({
      method: 'POST',
      url: '/api/operations/batches/plan-issue',
      headers: as(OWNER),
      payload: { productId: product, quantity: 10, asOf: today },
    })

    expect(response.statusCode, response.body).toBe(200)
    const plan = JSON.parse(response.body)

    expect(plan.allocations).toHaveLength(0)
    expect(plan.blockedByExpiry.length).toBeGreaterThan(0)
    // The shortfall is reported, never clamped to zero.
    expect(plan.shortfall).toBe(10)
  })

  it('reports a shortfall rather than silently covering less', async () => {
    const product = fakeId('product')

    db.seed('stock_batches', [
      {
        id: fakeId('batch'),
        workspace_id: SHOP,
        product_id: product,
        batch_number: 'FRESH-1',
        expiry_date: '2027-01-01',
        received_qty: 4,
        remaining_qty: 4,
        cost_layer_id: null,
        warehouse_id: null,
        received_on: '2026-08-01',
        manufactured_date: null,
      },
    ])

    const response = await app.inject({
      method: 'POST',
      url: '/api/operations/batches/plan-issue',
      headers: as(OWNER),
      payload: { productId: product, quantity: 10, asOf: today },
    })

    const plan = JSON.parse(response.body)
    expect(plan.shortfall).toBe(6)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// The conflict queue
// ═══════════════════════════════════════════════════════════════════════════

describe('offline conflicts, over real HTTP', () => {
  function seedConflict(overrides: Row = {}) {
    const id = fakeId('conflict')

    db.seed('sync_conflicts', [
      {
        id,
        workspace_id: SHOP,
        entity_type: 'invoice',
        entity_id: fakeId('invoice'),
        mutation_id: fakeId('mutation'),
        operation: 'update',
        server_version: 3,
        server_row: { total: 500 },
        client_version: 2,
        client_payload: { total: 700 },
        divergences: [{ field: 'total', serverValue: 500, clientValue: 700, financial: true }],
        has_financial_divergence: true,
        status: 'open',
        resolution: null,
        resolution_reason: null,
        resolved_by: null,
        resolved_at: null,
        created_at: '2026-08-29T10:00:00Z',
        ...overrides,
      },
    ])

    return id
  }

  it('lists what is waiting on a decision', async () => {
    seedConflict()

    const response = await app.inject({
      method: 'GET',
      url: '/api/conflicts?status=open',
      headers: as(OWNER),
    })

    expect(response.statusCode, response.body).toBe(200)
    expect(JSON.parse(response.body)).toHaveLength(1)
  })

  it('refuses a resolution with no reason', async () => {
    const id = seedConflict()

    const response = await app.inject({
      method: 'POST',
      url: `/api/conflicts/${id}/resolve`,
      headers: as(OWNER),
      payload: { choice: 'keep_server' },
    })

    expect(response.statusCode).toBe(400)
    expect(db.rows('sync_conflicts')[0]!.status).toBe('open')
  })

  it('does not let a seller resolve one', async () => {
    const id = seedConflict()

    const response = await app.inject({
      method: 'POST',
      url: `/api/conflicts/${id}/resolve`,
      headers: as(SELLER),
      payload: { choice: 'keep_server', reason: 'چون گفتم' },
    })

    expect(response.statusCode).toBe(403)
    expect(db.rows('sync_conflicts')[0]!.status).toBe('open')
  })

  it('a manager can see the queue', async () => {
    seedConflict()

    const response = await app.inject({
      method: 'GET',
      url: '/api/conflicts',
      headers: as(OWNER),
    })

    expect(response.statusCode).toBe(200)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Per-workspace role capabilities — the matrix is what is enforced
// ═══════════════════════════════════════════════════════════════════════════

describe('workspace role capabilities, over real HTTP', () => {
  const OTHER_SHOP = fakeId('shop')

  beforeEach(async () => {
    const { memoryCache } = await import('../utils/pagination')
    await memoryCache.invalidate('permissions')
    await memoryCache.invalidate(`budget:${SHOP}`)
  })

  it('a capability GRANTED to seller in this workspace is enforced as granted', async () => {
    // Default: seller has no budget.read.
    const before = await app.inject({
      method: 'GET',
      url: '/api/operations/budgets',
      headers: as(SELLER),
    })
    expect(before.statusCode).toBe(403)

    db.seed('workspace_role_capabilities', [
      { workspace_id: SHOP, role: 'seller', capability: 'budget.read', granted: true },
    ])
    const { memoryCache } = await import('../utils/pagination')
    await memoryCache.invalidate('permissions')

    const after = await app.inject({
      method: 'GET',
      url: '/api/operations/budgets',
      headers: as(SELLER),
    })
    expect(after.statusCode, after.body).toBe(200)
  })

  it('a capability REVOKED from owner in this workspace is enforced as revoked', async () => {
    db.seed('workspace_role_capabilities', [
      { workspace_id: SHOP, role: 'owner', capability: 'budget.read', granted: false },
    ])

    const response = await app.inject({
      method: 'GET',
      url: '/api/operations/budgets',
      headers: as(OWNER),
    })
    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({
      code: 'CAPABILITY_REQUIRED',
      capability: 'budget.read',
    })
  })

  it('a change in ANOTHER workspace does not leak into this one', async () => {
    db.seed('workspace_role_capabilities', [
      { workspace_id: OTHER_SHOP, role: 'seller', capability: 'budget.read', granted: true },
    ])
    const response = await app.inject({
      method: 'GET',
      url: '/api/operations/budgets',
      headers: as(SELLER),
    })
    expect(response.statusCode).toBe(403)
  })

  it('my-capabilities reports the effective set, not the defaults', async () => {
    db.seed('workspace_role_capabilities', [
      { workspace_id: SHOP, role: 'seller', capability: 'budget.read', granted: true },
      { workspace_id: SHOP, role: 'seller', capability: 'invoice.create', granted: false },
    ])
    const response = await app.inject({
      method: 'GET',
      url: '/api/governance/my-capabilities',
      headers: as(SELLER),
    })
    expect(response.statusCode, response.body).toBe(200)
    const caps: string[] = response.json().capabilities
    expect(caps).toContain('budget.read')
    expect(caps).not.toContain('invoice.create')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Till ↔ bank transfer — one journal entry, however many retries
// ═══════════════════════════════════════════════════════════════════════════

describe('till ↔ bank transfer, over real HTTP', () => {
  const SESSION = fakeId('session')

  beforeEach(async () => {
    const { memoryCache } = await import('../utils/pagination')
    await memoryCache.invalidate('permissions')
    db.seed('pos_sessions', [
      {
        id: SESSION,
        workspace_id: SHOP,
        branch_id: null,
        status: 'open',
        opening_float_minor: 1_000_000,
        opened_at: '2026-08-30T08:00:00Z',
        opened_by: OWNER.id,
        counted_cash_minor: null,
        variance_reason: null,
        closed_at: null,
        closed_by: null,
        was_forced: false,
        journal_entry_id: null,
      },
    ])
  })

  it('posts Dr bank / Cr cash once and records the drawer movement; a retry adds nothing', async () => {
    const transferId = fakeId('transfer')
    const payload = {
      transferId,
      direction: 'to_bank',
      amountMinor: 400_000,
      reason: 'واریز به بانک',
    }

    const first = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${SESSION}/bank-transfer`,
      headers: as(OWNER),
      payload,
    })
    expect(first.statusCode, first.body).toBe(201)
    expect(first.json()).toMatchObject({ transferId, alreadyRecorded: false })

    const retry = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${SESSION}/bank-transfer`,
      headers: as(OWNER),
      payload,
    })
    expect(retry.statusCode, retry.body).toBe(201)
    expect(retry.json()).toMatchObject({ transferId, alreadyRecorded: true })

    const entries = db.rows('journal_entries').filter((e) => e.source_type === 'till_transfer')
    expect(entries).toHaveLength(1)
    const lines = db.rows('journal_lines').filter((l) => l.entry_id === entries[0]!.id)
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ account_id: BANK, debit: 4000, credit: 0 }),
        expect.objectContaining({ account_id: CASH, debit: 0, credit: 4000 }),
      ]),
    )
    expect(db.rows('pos_cash_movements').filter((m) => m.id === transferId)).toHaveLength(1)
  })

  it('refuses sending more cash than the drawer should hold', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${SESSION}/bank-transfer`,
      headers: as(OWNER),
      payload: {
        transferId: fakeId('transfer'),
        direction: 'to_bank',
        amountMinor: 9_000_000,
        reason: 'x',
      },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().error).toContain('POS_TRANSFER_EXCEEDS_CASH')
  })

  it('a seller cannot post a transfer (ledger.post)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${SESSION}/bank-transfer`,
      headers: as(SELLER),
      payload: {
        transferId: fakeId('transfer'),
        direction: 'to_bank',
        amountMinor: 1,
        reason: 'x',
      },
    })
    expect(response.statusCode).toBe(403)
  })
})
