// ============================================
// BUG-NEW-010 / BUG-NEW-008: a payroll is recorded once per key, and a paid
// payroll that missed the ledger can be booked again — exactly once.
//
// The earlier version of this file asserted only that two methods exist. These
// tests drive the real service against a scripted `payrolls` table and a
// scripted ledger and check what is written, what is answered and what is
// posted.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  steps: [] as Array<{ data: unknown; error: { code?: string; message?: string } | null }>,
  calls: [] as Array<{ method: string; args: unknown[] }>,
}))

const ledger = vi.hoisted(() => ({
  accounts: {} as Record<string, string>,
  missing: [] as string[],
  postDocument: vi.fn(),
}))

vi.mock('../db', () => {
  const chain: Record<string, unknown> = {}
  for (const method of [
    'select',
    'eq',
    'neq',
    'or',
    'order',
    'limit',
    'insert',
    'update',
    'range',
  ]) {
    chain[method] = (...args: unknown[]) => {
      db.calls.push({ method, args })
      return chain
    }
  }
  const next = () => Promise.resolve(db.steps.shift() ?? { data: null, error: null })
  chain.maybeSingle = next
  chain.single = next
  return { supabase: { from: () => chain } }
})

vi.mock('../services/base-currency', () => ({ baseCurrencyOf: async () => 'AFN' }))
vi.mock('../services/event-log.service', () => ({ logBusinessEvent: vi.fn() }))
vi.mock('../services/accounting', () => ({
  ledger: {
    resolveAccountsByRole: async () => ({ accounts: { cash: 'cash-account' } }),
    ensureAccountsForRoles: async (_ctx: unknown, roles: string[]) => ({
      accounts: Object.fromEntries(roles.map((role) => [role, ledger.accounts[role] ?? 'acc'])),
      missing: ledger.missing,
    }),
    postDocument: (...args: unknown[]) => ledger.postDocument(...args),
  },
}))

import { ConflictError } from '../errors/database.error'
import { HumanResourcesService } from '../services/human-resources.service'
import type { TenancyContext } from '../services/tenancy.service'

const WS = '11111111-1111-4111-8111-111111111111'
const EMPLOYEE = '22222222-2222-4222-8222-222222222222'
const KEY = '33333333-3333-4333-8333-333333333333'
const PAYROLL_ID = '44444444-4444-4444-8444-444444444444'

const ctx = {
  workspaceId: WS,
  userId: '55555555-5555-4555-8555-555555555555',
  role: 'owner',
  timeZone: 'Asia/Kabul',
} as unknown as TenancyContext

const INPUT = {
  employeeId: EMPLOYEE,
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  baseSalary: 10000,
  bonuses: 0,
  deductions: 0,
  overtimeHours: 0,
  overtimeRate: 0,
  taxAmount: 0,
  status: 'paid' as const,
  clientRequestId: KEY,
}

const STORED = {
  id: PAYROLL_ID,
  employee_id: EMPLOYEE,
  period_start: '2026-10-01',
  period_end: '2026-10-31',
  base_salary: 10000,
  bonuses: 0,
  deductions: 0,
  overtime_amount: 0,
  tax_amount: 0,
  net_salary: 10000,
  status: 'paid',
  payment_date: '2026-10-31',
  client_request_id: KEY,
}

const script = (...steps: Array<{ data: unknown; error?: { code?: string } | null }>) => {
  db.steps = steps.map((s) => ({ data: s.data, error: s.error ?? null }))
  db.calls = []
}
const inserted = () => db.calls.some((c) => c.method === 'insert')

describe('payroll idempotency and booking', () => {
  const service = new HumanResourcesService()

  beforeEach(() => {
    ledger.accounts = {}
    ledger.missing = []
    ledger.postDocument.mockReset()
    ledger.postDocument.mockResolvedValue({})
  })

  it('answers a repeated key with the first payroll and inserts nothing', async () => {
    script({ data: STORED })

    const out = (await service.createPayroll(ctx, INPUT as never)) as Record<string, unknown>

    expect(out.id).toBe(PAYROLL_ID)
    expect(out._replayed).toBe(true)
    expect(inserted()).toBe(false)
  })

  it('refuses the same key with a different salary', async () => {
    script({ data: { ...STORED, base_salary: 99999 } })

    await expect(service.createPayroll(ctx, INPUT as never)).rejects.toBeInstanceOf(ConflictError)
    expect(inserted()).toBe(false)
  })

  it('stores the key on the new row so the next repeat can find it', async () => {
    script({ data: null }, { data: null }, { data: { ...STORED, status: 'draft' } })

    await service.createPayroll(ctx, { ...INPUT, status: 'draft' } as never)

    const insert = db.calls.find((c) => c.method === 'insert')
    expect(insert?.args[0]).toMatchObject({ client_request_id: KEY, workspace_id: WS })
  })

  it('a replay of a PAID payroll reports the books as they are now, and books it once', async () => {
    script({ data: STORED })

    const out = (await service.createPayroll(ctx, INPUT as never)) as {
      bookingStatus: { booked: boolean }
    }

    expect(out.bookingStatus.booked).toBe(true)
    expect(ledger.postDocument).toHaveBeenCalledTimes(1)
    expect(ledger.postDocument.mock.calls[0]?.[1]).toMatchObject({
      sourceType: 'payroll',
      sourceId: PAYROLL_ID,
    })
  })

  it('says so when the chart of accounts cannot express the entry', async () => {
    ledger.missing = ['salary_expense']
    script({ data: STORED })

    const out = (await service.createPayroll(ctx, INPUT as never)) as {
      bookingStatus: { booked: boolean; reason?: string }
    }

    expect(out.bookingStatus.booked).toBe(false)
    expect(out.bookingStatus.reason).toContain('MISSING_ACCOUNTS')
    expect(ledger.postDocument).not.toHaveBeenCalled()
  })

  it('books a paid payroll again once the accounts exist', async () => {
    script({ data: STORED })

    const out = await service.bookPayrollRetry(ctx, PAYROLL_ID)

    expect(out.bookingStatus.booked).toBe(true)
    expect(ledger.postDocument).toHaveBeenCalledTimes(1)
  })

  it('refuses to book a payroll that was never paid', async () => {
    script({ data: { ...STORED, status: 'draft' } })

    await expect(service.bookPayrollRetry(ctx, PAYROLL_ID)).rejects.toThrow('PAYROLL_NOT_PAID')
    expect(ledger.postDocument).not.toHaveBeenCalled()
  })
})
