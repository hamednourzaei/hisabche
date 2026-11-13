// ============================================
// backend/src/__tests__/expense-claims.test.ts
//
// B.2.18 — an employee's expense claim, from the amount to the payment.
//
// What can go wrong, and what each test is for:
//
//   · Two currencies added together. A 5,000 AFN line and a 20 USD line used to
//     «total» 5,020 and the reimbursement paid that in whichever currency the
//     caller named. There is no total, and the claim is refused.
//   · `amount = totalMinor / 100`. AFN has no minor unit, so an endorsed/claimed
//     5,000 AFN left the business as 50. The payment must carry the amount the
//     claim actually is.
//   · A claim approved as «booked» while nothing was posted. Approval used to
//     call `ledger.postDocument({ lines: [] })` and swallow the error.
//   · Paying twice when the first answer was lost. The payment is keyed by the
//     claim.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculateExpenseReportTotal,
  canApproveExpenseReport,
  canRejectExpenseReport,
  canReimburseExpenseReport,
  expenseReportCurrency,
  type ExpenseClaimLine,
} from '@hisabche/validation'

// ─── The payment path is the ONE place money leaves; it is watched here ───────
const { recordPayment } = vi.hoisted(() => ({ recordPayment: vi.fn() }))

vi.mock('../services/payments/payments.service', () => ({
  PaymentsService: class {
    recordPayment(...args: unknown[]) {
      return recordPayment(...args)
    }
  },
}))

// ─── A PostgREST-shaped fake, loud about anything it does not implement ──────
type Row = Record<string, unknown>
const tables: Record<string, Row[]> = { expense_reports: [] }

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let mode: 'select' | 'update' = 'select'
  let payload: Row = {}

  const matched = () => (tables[table] ?? []).filter((row) => filters.every((f) => f(row)))

  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value)
      return builder
    },
    update: (row: Row) => {
      mode = 'update'
      payload = row
      return builder
    },
    insert: () => {
      throw new Error('fake: insert is not implemented in this test')
    },
    single: async () => {
      if (mode === 'update') {
        const hit = matched()
        for (const row of hit) Object.assign(row, payload)
        return hit.length === 0
          ? { data: null, error: { code: 'PGRST116', message: 'no row' } }
          : { data: hit[0] ?? null, error: null }
      }
      const hit = matched()
      return hit.length === 0
        ? { data: null, error: { code: 'PGRST116', message: 'no row' } }
        : { data: hit[0] ?? null, error: null }
    },
    then: () => {
      throw new Error('fake: a builder was awaited without single()')
    },
  }
  return builder
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => from(table) } }))

const { expenseClaimsService } = await import('../services/human-resources/expense-claims.service')
const { ValidationError } = await import('../errors/validation.error')

const tenancy = { workspaceId: 'ws-1', userId: 'user-1', role: 'owner' } as const

function seedReport(overrides: Row = {}): Row {
  const report: Row = {
    id: 'report-1',
    workspace_id: 'ws-1',
    employee_id: 'employee-1',
    title: 'Trip to Herat',
    status: 'submitted',
    approved_by: null,
    approved_at: null,
    rejected_reason: null,
    payment_id: null,
    created_at: '2026-11-12T08:00:00.000Z',
    updated_at: '2026-11-12T08:00:00.000Z',
    expense_lines: [],
    ...overrides,
  }
  tables.expense_reports = [report]
  return report
}

function line(id: string, amountMinor: number, currency: string): Row {
  return {
    id,
    report_id: 'report-1',
    workspace_id: 'ws-1',
    category: 'travel',
    amount_minor: amountMinor,
    currency,
  }
}

beforeEach(() => {
  tables.expense_reports = []
  recordPayment.mockReset()
  recordPayment.mockResolvedValue({ id: 'payment-1' })
})

// ─── The pure rules ──────────────────────────────────────────────────────────

const afn = (id: string, amountMinor: number): ExpenseClaimLine => ({
  id,
  category: 'travel',
  amountMinor,
  currency: 'AFN',
})

describe('B.2.18 expense claim money rules', () => {
  it('adds minor units of ONE currency', () => {
    const total = calculateExpenseReportTotal({ lines: [afn('1', 1500), afn('2', 2500)] })
    expect(total).toBe(4000)
    // Scale: the same rule far above the rounding line.
    expect(calculateExpenseReportTotal({ lines: [afn('1', 1_000_000)] })).toBe(1_000_000)
    expect(expenseReportCurrency([afn('1', 1), afn('2', 2)])).toBe('AFN')
  })

  it('refuses to add two currencies — there is no total, not a wrong one', () => {
    const lines = [afn('1', 5000), { ...afn('2', 20), currency: 'USD' }]
    expect(expenseReportCurrency(lines)).toBeNull()
    // null is «cannot be calculated», never 5020.
    expect(calculateExpenseReportTotal({ lines })).toBeNull()
  })

  it('has no total for a claim with no lines', () => {
    expect(expenseReportCurrency([])).toBeNull()
    expect(calculateExpenseReportTotal({ lines: [] })).toBeNull()
  })

  it('gates approve / reject / reimburse on the state the server enforces', () => {
    expect(canApproveExpenseReport('submitted')).toBe(true)
    expect(canApproveExpenseReport('reimbursed')).toBe(false)
    expect(canRejectExpenseReport('submitted')).toBe(true)
    expect(canRejectExpenseReport('approved')).toBe(false)
    expect(canReimburseExpenseReport('approved', null)).toBe(true)
    expect(canReimburseExpenseReport('approved', 'payment-1')).toBe(false)
    expect(canReimburseExpenseReport('submitted', null)).toBe(false)
  })
})

// ─── The service ────────────────────────────────────────────────────────────

describe('reimbursement pays the amount the claim actually is', () => {
  it('AFN (no minor unit): 5,000 minor reaches the payment as 5,000, not 50', async () => {
    seedReport({
      status: 'approved',
      expense_lines: [line('l1', 3000, 'AFN'), line('l2', 2000, 'AFN')],
    })

    await expenseClaimsService.reimburse(tenancy, 'report-1', 'AFN')

    expect(recordPayment).toHaveBeenCalledTimes(1)
    const [context, input] = recordPayment.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(context).toEqual(tenancy)
    expect(input.amount).toBe(5000)
    expect(input.currency).toBe('AFN')
    expect(input.direction).toBe('out')
    expect(input.partyId).toBe('employee-1')
  })

  it('USD (two decimals): 12,345 minor reaches the payment as 123.45', async () => {
    seedReport({ status: 'approved', expense_lines: [line('l1', 12_345, 'USD')] })

    await expenseClaimsService.reimburse(tenancy, 'report-1', 'USD')

    const [, input] = recordPayment.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(input.amount).toBe(123.45)
    expect(input.currency).toBe('USD')
  })

  it('keys the payment by the claim, so a retry cannot pay the same claim twice', async () => {
    seedReport({ status: 'approved', expense_lines: [line('l1', 5000, 'AFN')] })

    await expenseClaimsService.reimburse(tenancy, 'report-1', 'AFN')

    const [, , options] = recordPayment.mock.calls[0] as [
      unknown,
      unknown,
      { clientRequestId: string },
    ]
    expect(options.clientRequestId).toBe('expense-claim:report-1')
  })

  it('marks the claim reimbursed with the payment it created', async () => {
    seedReport({ status: 'approved', expense_lines: [line('l1', 5000, 'AFN')] })

    const updated = await expenseClaimsService.reimburse(tenancy, 'report-1', 'AFN')

    expect(updated.status).toBe('reimbursed')
    expect(updated.payment_id).toBe('payment-1')
  })

  it('refuses a claim whose lines are in two currencies, and pays nothing', async () => {
    seedReport({
      status: 'approved',
      expense_lines: [line('l1', 5000, 'AFN'), line('l2', 20, 'USD')],
    })

    await expect(expenseClaimsService.reimburse(tenancy, 'report-1', 'AFN')).rejects.toBeInstanceOf(
      ValidationError,
    )
    expect(recordPayment).not.toHaveBeenCalled()
  })

  it('refuses a reimbursement in another currency (no rate is invented here)', async () => {
    seedReport({ status: 'approved', expense_lines: [line('l1', 5000, 'AFN')] })

    await expect(expenseClaimsService.reimburse(tenancy, 'report-1', 'USD')).rejects.toThrow(
      'EXPENSE_CLAIM_CURRENCY_MISMATCH',
    )
    expect(recordPayment).not.toHaveBeenCalled()
  })

  it('refuses a claim that is not approved, or is already paid', async () => {
    seedReport({ status: 'submitted', expense_lines: [line('l1', 5000, 'AFN')] })
    await expect(expenseClaimsService.reimburse(tenancy, 'report-1', 'AFN')).rejects.toThrow(
      'EXPENSE_CLAIM_ALREADY_REIMBURSED_OR_UNAPPROVED',
    )

    seedReport({
      status: 'approved',
      payment_id: 'payment-0',
      expense_lines: [line('l1', 5000, 'AFN')],
    })
    await expect(expenseClaimsService.reimburse(tenancy, 'report-1', 'AFN')).rejects.toThrow(
      'EXPENSE_CLAIM_ALREADY_REIMBURSED_OR_UNAPPROVED',
    )
    expect(recordPayment).not.toHaveBeenCalled()
  })

  it('will not reimburse a claim that carries no line at all', async () => {
    seedReport({ status: 'approved', expense_lines: [] })

    await expect(expenseClaimsService.reimburse(tenancy, 'report-1', 'AFN')).rejects.toThrow(
      'EXPENSE_CLAIM_HAS_NO_LINES',
    )
    expect(recordPayment).not.toHaveBeenCalled()
  })
})

describe('approval is a decision, and says so', () => {
  it('returns the lines with the approved claim, so the screen can total it', async () => {
    seedReport({ expense_lines: [line('l1', 5000, 'AFN')] })

    const approved = await expenseClaimsService.approve(tenancy, 'report-1')

    expect(approved.status).toBe('approved')
    expect(approved.expense_lines).toHaveLength(1)
  })

  it('books nothing instead of booking an empty document', () => {
    const source = readFileSync(
      join(__dirname, '..', 'services', 'human-resources', 'expense-claims.service.ts'),
      'utf8',
    )
    const code = source
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n')
    // The old code: postDocument({ lines: [] }) with sourceType 'expense_claim'
    // cast to never, wrapped in `.catch(() => undefined)` — nothing posted, and
    // nobody told.
    expect(code).not.toContain('postDocument')
    expect(code).not.toContain('expense_claim')
    expect(code).not.toContain('as never')
    // and no «/ 100» anywhere on the money path.
    expect(code).not.toContain('/ 100')
    expect(code).toContain('tillMinorToMajor(totalMinor, claimCurrency)')
  })
})
