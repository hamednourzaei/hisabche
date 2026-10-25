// Budgets on the device: the lifecycle, the page, the spend check and a revision,
// all through the same planning functions the server uses.
import { describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WORKSPACE_ID } from './test-db'

type Json = Record<string, any>
const ACCOUNT = '9b2f4c1e-0000-4000-8000-0000000000a1'
const BUDGET = '9b2f4c1e-0000-4000-8000-0000000000b1'

function setup() {
  const db = createTestDb()
  const engine = createLocalEngine(db)
  const call = (method: any, path: string, body?: unknown) =>
    engine.request<Json>({ method, path, ...(body === undefined ? {} : { body }) })
  db.run(
    `INSERT INTO account (id, workspace_id, code, name, type, role, is_active, created_at, updated_at)
     VALUES (?, ?, '6500', 'اجاره', 'expense', NULL, 1, 'x', 'x')`,
    [ACCOUNT, TEST_WORKSPACE_ID],
  )
  return { db, call }
}

const body = {
  accountId: ACCOUNT,
  period: 'monthly',
  startsOn: '2026-03-01',
  amountMinor: 100000,
  action: 'block',
}

function spend(db: ReturnType<typeof setup>['db'], day: string, debit: number) {
  const entry = `9b2f4c1e-0000-4000-8000-${String(debit).padStart(12, '0')}`
  db.run(
    `INSERT INTO journal_entry (id, workspace_id, entry_number, date, status, source_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'posted', 'manual', 'x', 'x')`,
    [entry, TEST_WORKSPACE_ID, `J-${debit}`, day],
  )
  db.run(
    `INSERT INTO journal_line (id, workspace_id, journal_id, account_id, debit, credit, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 'x', 'x')`,
    [
      `9b2f4c1e-0000-4000-9000-${String(debit).padStart(12, '0')}`,
      TEST_WORKSPACE_ID,
      entry,
      ACCOUNT,
      debit,
    ],
  )
}

describe('budgets (offline)', () => {
  it('saves a draft, refuses a foreign account, and moves draft → pending → approved', async () => {
    const { call } = setup()
    const bad = await call('PUT', `/operations/budgets/${BUDGET}`, {
      ...body,
      accountId: '9b2f4c1e-0000-4000-8000-0000000000ff',
    })
    expect(bad.status).toBe(400)
    expect(bad.data.message).toBe('BUDGET_ACCOUNT_INVALID')

    const draft = await call('PUT', `/operations/budgets/${BUDGET}`, body)
    expect(draft.data).toMatchObject({
      status: 'draft',
      version: 1,
      amountMinor: 100000,
      type: 'expense',
    })

    expect((await call('POST', `/operations/budgets/${BUDGET}/submit`)).data.status).toBe(
      'pending_approval',
    )
    expect((await call('POST', `/operations/budgets/${BUDGET}/submit`)).status).toBe(409)
    const approved = await call('POST', `/operations/budgets/${BUDGET}/approve`, {})
    expect(approved.data.status).toBe('approved')
    // An approved budget is revised, never overwritten.
    expect((await call('PUT', `/operations/budgets/${BUDGET}`, body)).data.code).toBe(
      'BUDGET_APPROVED_REQUIRES_REVISION',
    )
  })

  it('refuses a cost centre out loud', async () => {
    const { call } = setup()
    const res = await call('PUT', `/operations/budgets/${BUDGET}`, {
      ...body,
      dimensionValueId: '9b2f4c1e-0000-4000-8000-0000000000ee',
    })
    expect(res.data.message).toContain('BUDGET_DIMENSION_OFFLINE')
  })

  it('reports actual spend from the posted ledger and blocks a document over the limit', async () => {
    const { db, call } = setup()
    await call('PUT', `/operations/budgets/${BUDGET}`, body)
    await call('POST', `/operations/budgets/${BUDGET}/approve`, {})
    spend(db, '2026-03-10', 80)

    const report = await call('GET', '/operations/budgets/report?onDate=2026-03-15')
    expect(report.data.rows[0].performance.actualMinor).toBe(8000)
    expect(report.data.totals.expense.budgetMinor).toBe(100000)

    const variance = await call('GET', '/operations/budgets/variance?onDate=2026-03-15')
    expect(variance.data[0]).toMatchObject({ budgetMinor: 100000, actualMinor: 8000 })

    const ok = await call('POST', '/operations/budgets/check', {
      accountId: ACCOUNT,
      amountMinor: 1000,
      onDate: '2026-03-15',
    })
    expect(ok.data.decision).toBe('allow')
    const over = await call('POST', '/operations/budgets/check', {
      accountId: ACCOUNT,
      amountMinor: 99000,
      onDate: '2026-03-15',
    })
    expect(over.data.decision).toBe('block')
    expect(over.data.allowed).toBe(false)
  })

  it('revises an approved budget under a version lock and keeps the history', async () => {
    const { call } = setup()
    await call('PUT', `/operations/budgets/${BUDGET}`, body)
    await call('POST', `/operations/budgets/${BUDGET}/approve`, {})

    const stale = await call('POST', `/operations/budgets/${BUDGET}/revise`, {
      expectedVersion: 7,
      amountMinor: 200000,
      reason: 'more rent',
    })
    expect(stale.status).toBe(409)
    expect(stale.data.code).toBe('BUDGET_VERSION_CONFLICT')

    const revised = await call('POST', `/operations/budgets/${BUDGET}/revise`, {
      expectedVersion: 1,
      amountMinor: 200000,
      reason: 'more rent',
    })
    expect(revised.data.result).toEqual({ version: 2 })
    const history = await call('GET', `/operations/budgets/${BUDGET}/revisions`)
    expect(history.data[0]).toMatchObject({ version: 2, previous_version: 1, reason: 'more rent' })
    expect(history.data[0].previous_values.amount_minor).toBe(100000)
    expect(history.data[0].new_values.amount_minor).toBe(200000)
    expect((await call('GET', '/operations/budgets')).data[0].amountMinor).toBe(200000)
  })

  it('archives once', async () => {
    const { call } = setup()
    await call('PUT', `/operations/budgets/${BUDGET}`, body)
    expect((await call('POST', `/operations/budgets/${BUDGET}/archive`)).data).toMatchObject({
      status: 'archived',
      isActive: false,
    })
    expect((await call('POST', `/operations/budgets/${BUDGET}/archive`)).status).toBe(409)
  })
})
