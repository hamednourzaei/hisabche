// ============================================
// The period lock on the device — one rule, every writer of the ledger.
//
// The rule is `evaluatePeriodLock` (@hisabche/validation), the one the server calls. The device holds a
// COMPANY lock only (no branch locks locally), so its decision must equal the shared function's for a
// company-only lock list; and EVERY route that writes a journal entry must ask it. Before M1.1/M1.2 only the
// manual entry and the late-cost re-post did: an offline invoice or payment dated inside a closed month
// went into the books, and the server refused it later on sync — after the person had been told it was saved.
// ============================================

import { evaluatePeriodLock } from '@hisabche/validation'
import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { periodLockDecision } from '../routes/local-ledger'
import { createTestDb, createTestEngine, TEST_WAREHOUSE_ID, TEST_WORKSPACE_ID } from './test-db'

type Engine = ReturnType<typeof createTestEngine>

let db: LocalDb
let engine: Engine

const count = (table: string) => db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0]!.n

async function lockThrough(date: string) {
  const res = await engine.request({
    method: 'PUT',
    path: '/accounting/period-lock',
    body: { lockedUntil: date },
  })
  expect(res.status).toBe(200)
}

async function seedAccountsAndParties() {
  for (const [code, name, type] of [
    ['1010', 'صندوق', 'asset'],
    ['4010', 'درآمد', 'revenue'],
  ] as const) {
    await engine.request({
      method: 'POST',
      path: '/accounting/accounts',
      body: { code, name, type },
    })
  }
  const product = (
    await engine.request<{ id: string }>({
      method: 'POST',
      path: '/products',
      body: {
        name: 'چای',
        buyPrice: 100,
        sellPrice: 150,
        quantity: 10,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
  ).data
  const customer = (
    await engine.request<{ id: string }>({
      method: 'POST',
      path: '/customers',
      body: { fullName: 'مشتری', openingBalance: 0 },
    })
  ).data
  return { product, customer }
}

const invoiceBody = (productId: string, customerId: string, date: string) => ({
  type: 'sale',
  customerId,
  currency: 'AFN',
  date: `${date}T00:00:00.000Z`,
  warehouseId: TEST_WAREHOUSE_ID,
  items: [{ productId, productName: 'چای', quantity: 1, unitPrice: 150 }],
})

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('the shared decision', () => {
  it('equals evaluatePeriodLock for a company-only lock, on both sides of the boundary', async () => {
    await lockThrough('2026-10-16')
    for (const day of ['2026-10-15', '2026-10-16', '2026-10-17']) {
      const shared = evaluatePeriodLock(day, null, [
        { branchId: null, lockedUntil: '2026-10-16', reason: '' },
      ])
      const local = periodLockDecision(db, day)
      expect({ locked: local.locked, lockedUntil: local.lockedUntil, scope: local.scope }).toEqual({
        locked: shared.locked,
        lockedUntil: shared.lockedUntil,
        scope: shared.scope,
      })
    }
  })

  it('no lock set means open', () => {
    expect(periodLockDecision(db, '2020-01-01').locked).toBe(false)
  })
})

describe('every ledger writer asks it', () => {
  it('an invoice dated inside the closed period is refused and writes nothing', async () => {
    const { product, customer } = await seedAccountsAndParties()
    await lockThrough('2026-10-16')
    const invoicesBefore = count('invoice')
    const entriesBefore = count('journal_entry')

    const res = await engine.request<{ code: string }>({
      method: 'POST',
      path: '/invoices',
      body: invoiceBody(product.id, customer.id, '2026-10-10'),
    })
    expect(res.status).toBe(409)
    expect(res.data.code).toBe('ACCOUNTING_PERIOD_LOCKED')
    expect(count('invoice')).toBe(invoicesBefore)
    expect(count('journal_entry')).toBe(entriesBefore)
  })

  it('an invoice dated the day after the lock is accepted', async () => {
    const { product, customer } = await seedAccountsAndParties()
    await lockThrough('2026-10-16')
    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: invoiceBody(product.id, customer.id, '2026-10-17'),
    })
    expect(res.status).toBe(201)
  })

  it('a payment dated inside the closed period is refused and writes nothing', async () => {
    const { customer } = await seedAccountsAndParties()
    await lockThrough('2026-10-16')
    const paymentsBefore = count('payment')
    const entriesBefore = count('journal_entry')

    const res = await engine.request<{ code: string }>({
      method: 'POST',
      path: '/payments',
      body: {
        direction: 'in',
        partyType: 'customer',
        partyId: customer.id,
        amount: 50,
        currency: 'AFN',
        entryDate: '2026-10-10',
        allocations: [],
      },
    })
    expect(res.status).toBe(409)
    expect(res.data.code).toBe('ACCOUNTING_PERIOD_LOCKED')
    expect(count('payment')).toBe(paymentsBefore)
    expect(count('journal_entry')).toBe(entriesBefore)
  })

  it('reversing an entry with a date inside the closed period is refused', async () => {
    await seedAccountsAndParties()
    const posted = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/accounting/journal',
      body: {
        date: '2026-10-20',
        description: 'x',
        lines: [
          { accountCode: '1010', debit: 100, credit: 0 },
          { accountCode: '4010', debit: 0, credit: 100 },
        ],
      },
    })
    expect(posted.status).toBe(201)
    await lockThrough('2026-10-31')
    const entriesBefore = count('journal_entry')

    const res = await engine.request<{ code: string }>({
      method: 'POST',
      path: `/accounting/journal/${posted.data.id}/reverse`,
      body: { date: '2026-10-25T00:00:00.000Z', reason: 'اصلاح' },
    })
    expect(res.status).toBe(409)
    expect(res.data.code).toBe('ACCOUNTING_PERIOD_LOCKED')
    expect(count('journal_entry')).toBe(entriesBefore)
  })
})
