// ============================================
// A branch's own period lock on the device.
//
// The server evaluates a lock list with `evaluatePeriodLock(date, branchId, locks)`: the company lock closes every branch, a
// branch lock closes only that branch, a posting with no branch meets the company lock alone. The device used to build the list
// with the company lock only and pass `null` as the branch, so a branch the owner had closed accepted an offline invoice that the
// server refused later, on sync — after the person was told it was saved. Same function, same list shape, now with the branch.
// ============================================

import { evaluatePeriodLock } from '@hisabche/validation'
import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { periodLockDecision } from '../routes/local-ledger'
import { createTestDb, createTestEngine } from './test-db'

const BRANCH_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const BRANCH_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

const invoiceCount = () => db.all<{ n: number }>('SELECT COUNT(*) AS n FROM invoice')[0]!.n

const lock = (lockedUntil: string, branchId?: string) =>
  engine.request({
    method: 'PUT',
    path: '/accounting/period-lock',
    body: { lockedUntil, ...(branchId ? { branchId } : {}) },
  })

const sale = (date: string, branchId: string | null) =>
  engine.request<{ code?: string }>({
    method: 'POST',
    path: '/invoices',
    body: {
      type: 'sale',
      currency: 'AFN',
      date,
      ...(branchId ? { branchId } : {}),
      items: [{ productName: 'کالا', quantity: 1, unitPrice: 100 }],
    },
  })

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('branch period lock on the device', () => {
  it('a locked branch refuses a document dated inside its lock; another branch does not', async () => {
    expect((await lock('2026-10-31', BRANCH_A)).status).toBe(200)

    const refused = await sale('2026-10-15', BRANCH_A)
    expect(refused.status).toBe(409)
    expect(refused.data.code).toBe('ACCOUNTING_PERIOD_LOCKED')
    expect(invoiceCount()).toBe(0) // refused whole, before the first write

    expect((await sale('2026-10-15', BRANCH_B)).status).toBe(201)
    expect((await sale('2026-11-05', BRANCH_A)).status).toBe(201) // after the lock date
  })

  it('the company lock closes every branch and a branchless document', async () => {
    await lock('2026-09-30')
    for (const branch of [BRANCH_A, BRANCH_B, null]) {
      expect((await sale('2026-09-10', branch)).status).toBe(409)
    }
    expect(invoiceCount()).toBe(0)
  })

  it('a branchless document meets the company lock alone, never some branch lock', async () => {
    await lock('2026-10-31', BRANCH_A)
    expect((await sale('2026-10-15', null)).status).toBe(201)
  })

  it('two branches keep different lock dates and the decision equals the shared function', async () => {
    await lock('2026-10-31', BRANCH_A)
    await lock('2026-08-31', BRANCH_B)
    for (const [date, branch] of [
      ['2026-09-15', BRANCH_A],
      ['2026-09-15', BRANCH_B],
      ['2026-08-15', BRANCH_B],
      ['2026-11-01', BRANCH_A],
    ] as const) {
      const expected = evaluatePeriodLock(date, branch, [
        { branchId: BRANCH_A, lockedUntil: '2026-10-31', reason: '' },
        { branchId: BRANCH_B, lockedUntil: '2026-08-31', reason: '' },
      ])
      expect(periodLockDecision(db, date, branch).locked, `${date} ${branch}`).toBe(expected.locked)
    }
  })

  it('removing a branch lock opens only that branch', async () => {
    await lock('2026-10-31', BRANCH_A)
    await lock('2026-10-31', BRANCH_B)
    const cleared = await engine.request({
      method: 'PUT',
      path: '/accounting/period-lock',
      body: { lockedUntil: null, branchId: BRANCH_A },
    })
    expect(cleared.status).toBe(200)
    expect((await sale('2026-10-15', BRANCH_A)).status).toBe(201)
    expect((await sale('2026-10-15', BRANCH_B)).status).toBe(409)
  })

  it('reads the locks back, company and per branch', async () => {
    await lock('2026-09-30')
    await lock('2026-10-31', BRANCH_A)
    const read = await engine.request<{
      lockedUntil: string | null
      branchLocks: Array<{ branchId: string; lockedUntil: string }>
    }>({ method: 'GET', path: '/accounting/period-lock' })
    expect(read.data.lockedUntil).toBe('2026-09-30')
    expect(read.data.branchLocks).toEqual([{ branchId: BRANCH_A, lockedUntil: '2026-10-31' }])
  })
})

describe('the other writers know the branch of the document they belong to', () => {
  const customerId = async () =>
    (
      await engine.request<{ id: string }>({
        method: 'POST',
        path: '/customers',
        body: { fullName: 'مشتری شعبه' },
      })
    ).data.id

  const invoiceIn = async (branchId: string, customer: string) =>
    (
      await engine.request<{ id: string }>({
        method: 'POST',
        path: '/invoices',
        body: {
          type: 'sale',
          currency: 'AFN',
          date: '2026-11-05',
          branchId,
          customerId: customer,
          items: [{ productName: 'کالا', quantity: 1, unitPrice: 100 }],
        },
      })
    ).data.id

  const pay = (customer: string, invoice: string, entryDate: string) =>
    engine.request<{ code?: string }>({
      method: 'POST',
      path: '/payments',
      body: {
        direction: 'in',
        partyType: 'customer',
        partyId: customer,
        amount: 100,
        currency: 'AFN',
        method: 'cash',
        entryDate,
        allocations: [{ invoiceId: invoice, amount: 100 }],
      },
    })

  it('a payment of an invoice in a locked branch is refused inside the lock; another branch is not', async () => {
    const customer = await customerId()
    const inA = await invoiceIn(BRANCH_A, customer)
    const inB = await invoiceIn(BRANCH_B, customer)
    await lock('2026-10-31', BRANCH_A)

    const refused = await pay(customer, inA, '2026-10-15')
    expect(refused.status).toBe(409)
    expect(refused.data.code).toBe('ACCOUNTING_PERIOD_LOCKED')
    expect((await pay(customer, inB, '2026-10-15')).status).toBe(201)
  })

  it('cancelling an invoice posts its reversal today: a branch locked through today refuses the whole cancel', async () => {
    const customer = await customerId()
    const inA = await invoiceIn(BRANCH_A, customer)
    const inB = await invoiceIn(BRANCH_B, customer)
    await lock('2099-12-31', BRANCH_A)

    const refused = await engine.request<{ code?: string }>({
      method: 'POST',
      path: `/invoices/${inA}/cancel`,
    })
    expect(refused.status).toBe(409)
    expect(refused.data.code).toBe('ACCOUNTING_PERIOD_LOCKED')
    expect(
      db.get<{ status: string }>('SELECT status FROM invoice WHERE id = ?', [inA])?.status,
    ).not.toBe('cancelled')

    expect(
      (await engine.request({ method: 'POST', path: `/invoices/${inB}/cancel` })).status,
    ).toBeLessThan(300)
  })
})
