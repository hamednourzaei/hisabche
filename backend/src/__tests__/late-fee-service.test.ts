// ============================================
// late-fee.service — the policy, the preview and the charge.
//
// The rule has its own tests (installment-domain). What can go wrong HERE:
// a fee charged with no policy, charged twice, charged on a purchase or on a
// fee invoice, a dollar amount charged on an afghani invoice, a fee worked out
// on the whole invoice instead of what is overdue, a crash between the
// assessment row and its invoice charging again, and a missing table answered
// as «no fees».
//
// Amounts: the service speaks MAJOR units (a price); the table stores
// hundredths. 1,000.00 overdue = overdue_minor 100_000.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const state: { error: { table: string; code: string; message: string } | null } = { error: null }
let nextId = 1

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let mode: 'select' | 'insert' | 'update' | 'upsert' = 'select'
  let payload: Row = {}
  let conflict: string[] = []
  let head = false
  const run = () => {
    if (state.error?.table === table) return { data: null, error: state.error, count: null }
    const rows = (tables[table] ??= [])
    if (mode === 'insert') {
      // The unique index: one assessment per (invoice, installment, period).
      if (
        table === 'late_fee_assessments' &&
        rows.some(
          (row) =>
            row.invoice_id === payload.invoice_id &&
            row.seq === payload.seq &&
            row.period_no === payload.period_no,
        )
      ) {
        return { data: null, error: { code: '23505', message: 'late_fee_assessments_once' } }
      }
      const row = {
        id: `a-${nextId++}`,
        fee_invoice_id: null,
        assessed_at: `2026-10-04T00:00:0${nextId}Z`,
        ...payload,
      }
      rows.push(row)
      return { data: [row], error: null, count: null }
    }
    if (mode === 'upsert') {
      const hit = rows.find((row) => conflict.every((column) => row[column] === payload[column]))
      if (hit) Object.assign(hit, payload)
      else rows.push({ ...payload })
      return { data: null, error: null, count: null }
    }
    const hit = rows.filter((row) => filters.every((f) => f(row)))
    if (mode === 'update') for (const row of hit) Object.assign(row, payload)
    return { data: head ? null : hit, error: null, count: hit.length }
  }
  const builder: Record<string, unknown> = {
    select: (_columns: string, options?: { head?: boolean }) => (
      (head = options?.head === true),
      builder
    ),
    order: () => builder,
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    is: (column: string, value: unknown) => (
      filters.push((row) => (row[column] ?? null) === value),
      builder
    ),
    insert: (row: Row) => ((mode = 'insert'), (payload = row), builder),
    update: (row: Row) => ((mode = 'update'), (payload = row), builder),
    upsert: (row: Row, options: { onConflict: string }) => (
      (mode = 'upsert'),
      (payload = row),
      (conflict = options.onConflict.split(',')),
      builder
    ),
    single: async () => {
      const result = run()
      return { data: result.data?.[0] ?? null, error: result.error }
    },
    maybeSingle: async () => {
      const result = run()
      return { data: result.data?.[0] ?? null, error: result.error }
    },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  }
  return builder
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => from(table) } }))
vi.mock('../services/invoice.service', () => ({ InvoiceService: class {} }))

import { LateFeeService } from '../services/commerce/late-fee.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const INV = '11111111-1111-4111-8111-111111111111'
const CUSTOMER = '33333333-3333-4333-8333-333333333333'
const ctx = { workspaceId: WS, userId: 'u1', role: 'manager' } as never
const theirs = { workspaceId: OTHER, userId: 'u2', role: 'manager' } as never

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

/** Every call the service makes to the invoice core, and what it answered. */
const issued: Array<{ body: Record<string, unknown>; key: string | null | undefined }> = []
let failIssue = false
const invoices = {
  create: vi.fn(
    async (
      _ctx: unknown,
      body: unknown,
      _branch: unknown,
      options?: { clientRequestId?: string | null },
    ) => {
      if (failIssue) throw new Error('PLAN_LIMIT_REACHED')
      const key = options?.clientRequestId
      // The invoice core's own idempotency: the same key returns the same invoice.
      const again = issued.findIndex((call) => call.key === key)
      if (again >= 0) return { id: `fee-${again + 1}`, idempotentReplay: true }
      issued.push({ body: body as Record<string, unknown>, key })
      return { id: `fee-${issued.length}` }
    },
  ),
}

const invoice = (overrides: Row = {}) => {
  tables.invoices = [
    {
      id: INV,
      workspace_id: WS,
      invoice_number: 'INV-7',
      type: 'sale',
      status: 'pending',
      customer_id: CUSTOMER,
      currency: 'AFN',
      due_date: daysAgo(65),
      ...overrides,
    },
  ]
}
const owes = (total: number, allocated: number) => {
  tables.invoice_outstanding = [
    {
      invoice_id: INV,
      workspace_id: WS,
      total,
      allocated,
      outstanding: total - allocated,
      currency: 'AFN',
    },
  ]
}

let service: LateFeeService
beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  state.error = null
  nextId = 1
  issued.length = 0
  failIssue = false
  invoices.create.mockClear()
  invoice()
  owes(1_000, 0)
  tables.invoice_installments = []
  tables.late_fee_policies = []
  tables.late_fee_assessments = []
  service = new LateFeeService(invoices as never)
})

const fixed = (overrides: Row = {}) =>
  service.savePolicy(ctx, {
    isEnabled: true,
    basis: 'per_period',
    amount: 50,
    currency: 'AFN',
    ...overrides,
  })
const percent = (overrides: Row = {}) =>
  service.savePolicy(ctx, { isEnabled: true, basis: 'percentage', percent: 2, ...overrides })

describe('policy', () => {
  it('a business that never set a policy has none — and charges nothing', async () => {
    expect(await service.policy(ctx)).toBeNull()
    const preview = await service.preview(ctx, INV)
    expect(preview).toMatchObject({ state: 'off', lines: [], totalToAssess: 0 })
    await expect(service.assess(ctx, INV, 'fa')).rejects.toThrow('LATE_FEE_OFF')
    expect(invoices.create).not.toHaveBeenCalled()
  })

  it('a saved policy that is not turned on charges nothing', async () => {
    await fixed({ isEnabled: false })
    expect((await service.preview(ctx, INV)).state).toBe('off')
  })

  it('a fixed amount is stored in hundredths with its currency; a percentage keeps neither', async () => {
    await fixed()
    expect(tables.late_fee_policies![0]).toMatchObject({
      workspace_id: WS,
      amount_minor: 5_000,
      currency: 'AFN',
      percent: null,
      updated_by: 'u1',
    })
    await percent({ amount: 50, currency: 'USD' })
    expect(tables.late_fee_policies).toHaveLength(1)
    expect(tables.late_fee_policies![0]).toMatchObject({
      amount_minor: null,
      currency: null,
      percent: 2,
    })
  })

  it('a fixed amount without a currency, and a percentage without a percent, are refused', async () => {
    await expect(fixed({ currency: null })).rejects.toThrow()
    await expect(
      service.savePolicy(ctx, { isEnabled: true, basis: 'percentage' }),
    ).rejects.toThrow()
    await expect(percent({ percent: 150 })).rejects.toThrow()
    expect(tables.late_fee_policies).toEqual([])
  })

  it('one business’s policy is not another’s', async () => {
    await fixed()
    expect(await service.policy(theirs)).toBeNull()
  })

  it('a missing table is «not set up», never «no policy»', async () => {
    state.error = { table: 'late_fee_policies', code: '42P01', message: 'relation does not exist' }
    await expect(service.policy(ctx)).rejects.toThrow('LATE_FEES_MIGRATION_PENDING')
  })
})

describe('preview', () => {
  it('a fixed amount is charged per FULL 30 days late, on the invoice as one line', async () => {
    await fixed()
    const preview = await service.preview(ctx, INV)
    // 65 days late = 2 full periods × 50.
    expect(preview.state).toBe('ready')
    expect(preview.lines).toEqual([
      {
        seq: 0,
        dueDate: daysAgo(65),
        daysLate: 65,
        overdue: 1_000,
        fee: 100,
        assessed: 0,
        toAssess: 100,
        capped: false,
      },
    ])
    expect(preview.totalToAssess).toBe(100)
    expect(invoices.create).not.toHaveBeenCalled()
  })

  it('a percentage is of what is OVERDUE, not of the whole invoice', async () => {
    await percent()
    owes(1_000, 600)
    const [line] = (await service.preview(ctx, INV)).lines
    // 2% of the 400 still owed — not of 1,000.
    expect(line).toMatchObject({ overdue: 400, fee: 8, toAssess: 8 })
    expect(line!.fee).toBeLessThan(1_000 * 0.02)
  })

  it('a paid invoice, one inside the grace days, and one not yet a full period late owe no fee', async () => {
    await fixed({ graceDays: 10 })
    owes(1_000, 1_000)
    expect((await service.preview(ctx, INV)).lines).toEqual([])

    owes(1_000, 0)
    invoice({ due_date: daysAgo(10) })
    expect((await service.preview(ctx, INV)).lines).toEqual([])

    invoice({ due_date: daysAgo(20) })
    expect((await service.preview(ctx, INV)).lines).toMatchObject([
      { daysLate: 20, fee: 0, toAssess: 0 },
    ])
  })

  it('the cap limits the fee and says so', async () => {
    await fixed({ amount: 400, maxSharePercent: 10 })
    const [line] = (await service.preview(ctx, INV)).lines
    // 2 × 400 = 800 asked; capped at 10% of 1,000.
    expect(line).toMatchObject({ fee: 100, capped: true })
  })

  it('with an installment plan, only the overdue unpaid installments are charged', async () => {
    await percent()
    owes(900, 300)
    tables.invoice_installments = [
      { workspace_id: WS, invoice_id: INV, seq: 1, due_date: daysAgo(70), amount_minor: 30_000 },
      { workspace_id: WS, invoice_id: INV, seq: 2, due_date: daysAgo(40), amount_minor: 30_000 },
      { workspace_id: WS, invoice_id: INV, seq: 3, due_date: daysAgo(-20), amount_minor: 30_000 },
    ]
    const lines = (await service.preview(ctx, INV)).lines
    // #1 is paid (300 allocated), #3 is not due yet: only #2 is late.
    expect(lines.map((line) => line.seq)).toEqual([2])
    expect(lines[0]).toMatchObject({ overdue: 300, fee: 6 })
  })

  it('says WHY nothing can be charged: purchase, cancelled, walk-in, no due date, other currency', async () => {
    await fixed()
    const stateOf = async (overrides: Row) => {
      invoice(overrides)
      return (await service.preview(ctx, INV)).state
    }
    expect(await stateOf({ type: 'purchase' })).toBe('not_sale')
    expect(await stateOf({ status: 'cancelled' })).toBe('cancelled')
    expect(await stateOf({ customer_id: null })).toBe('no_customer')
    expect(await stateOf({ due_date: null })).toBe('no_due_date')
    // 50 afghani is not 50 dollars: left out, not converted.
    expect(await stateOf({ currency: 'USD' })).toBe('other_currency')
  })

  it('another business’s invoice is not found', async () => {
    await expect(service.preview(theirs, INV)).rejects.toThrow('not found')
  })
})

describe('charging', () => {
  it('writes one assessment with the policy as it was, and issues ONE sale invoice for the fee', async () => {
    await fixed()
    const after = await service.assess(ctx, INV, 'fa')

    expect(tables.late_fee_assessments).toHaveLength(1)
    expect(tables.late_fee_assessments![0]).toMatchObject({
      workspace_id: WS,
      invoice_id: INV,
      seq: 0,
      period_no: 2,
      days_late: 65,
      overdue_minor: 100_000,
      fee_minor: 10_000,
      currency: 'AFN',
      assessed_by: 'u1',
      fee_invoice_id: 'fee-1',
    })
    expect(tables.late_fee_assessments![0]!.policy).toMatchObject({
      basis: 'per_period',
      amount: 50,
    })

    expect(issued).toHaveLength(1)
    expect(issued[0]!.body).toMatchObject({
      type: 'sale',
      customerId: CUSTOMER,
      currency: 'AFN',
      total: 100,
      subtotal: 100,
      paidAmount: 0,
      reference: 'INV-7',
    })
    const [item] = issued[0]!.body.items as Row[]
    expect(item).toMatchObject({ quantity: 1, unitPrice: 100, totalPrice: 100 })
    expect(String(item!.productName)).toContain('INV-7')
    // The fee is 10% of what is overdue — not the same order as the debt itself.
    expect(Number(issued[0]!.body.total)).toBeLessThan(1_000)

    expect(after.lines[0]).toMatchObject({ assessed: 100, toAssess: 0 })
    expect(after.assessments).toHaveLength(1)
  })

  it('charging again the same day charges nothing more', async () => {
    await fixed()
    await service.assess(ctx, INV, 'fa')
    await expect(service.assess(ctx, INV, 'fa')).rejects.toThrow('LATE_FEE_NOTHING_TO_ASSESS')
    expect(tables.late_fee_assessments).toHaveLength(1)
    expect(issued).toHaveLength(1)
  })

  it('a later period charges only the difference', async () => {
    await fixed()
    await service.assess(ctx, INV, 'fa')
    invoice({ due_date: daysAgo(95) })
    const after = await service.assess(ctx, INV, 'fa')
    // 3 periods × 50 = 150 in total; 100 was charged.
    expect(tables.late_fee_assessments!.map((row) => row.fee_minor)).toEqual([10_000, 5_000])
    expect(issued.map((call) => call.body.total)).toEqual([100, 50])
    expect(after.lines[0]).toMatchObject({ fee: 150, assessed: 150, toAssess: 0 })
  })

  it('a percentage is charged once, however late the invoice gets', async () => {
    await percent()
    await service.assess(ctx, INV, 'fa')
    invoice({ due_date: daysAgo(200) })
    await expect(service.assess(ctx, INV, 'fa')).rejects.toThrow('LATE_FEE_NOTHING_TO_ASSESS')
    expect(issued).toHaveLength(1)
    expect(issued[0]!.body.total).toBe(20)
  })

  it('a period already charged is not charged again after the policy is raised', async () => {
    await fixed()
    await service.assess(ctx, INV, 'fa')
    await fixed({ amount: 500, maxSharePercent: 100 })
    expect((await service.preview(ctx, INV)).lines[0]).toMatchObject({ toAssess: 0 })
  })

  it('if the fee invoice could not be issued, the next call FINISHES that assessment — it does not charge again', async () => {
    await fixed()
    failIssue = true
    await expect(service.assess(ctx, INV, 'fa')).rejects.toThrow('PLAN_LIMIT_REACHED')
    expect(tables.late_fee_assessments).toHaveLength(1)
    expect(tables.late_fee_assessments![0]!.fee_invoice_id).toBeNull()
    expect((await service.preview(ctx, INV)).lines[0]).toMatchObject({ assessed: 100, toAssess: 0 })

    failIssue = false
    const after = await service.assess(ctx, INV, 'fa')
    expect(tables.late_fee_assessments).toHaveLength(1)
    expect(issued).toHaveLength(1)
    expect(issued[0]!.body.total).toBe(100)
    expect(after.assessments[0]!.feeInvoiceId).toBe('fee-1')
  })

  it('the invoice key is the same for the same invoice, installment and period', async () => {
    await fixed()
    failIssue = true
    await expect(service.assess(ctx, INV, 'fa')).rejects.toThrow()
    const firstKey = invoices.create.mock.calls[0]![3]!.clientRequestId
    failIssue = false
    await service.assess(ctx, INV, 'fa')
    expect(invoices.create.mock.calls[1]![3]!.clientRequestId).toBe(firstKey)
    expect(firstKey).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('a fee invoice is never charged a fee', async () => {
    await fixed()
    await service.assess(ctx, INV, 'fa')
    // The fee invoice itself, overdue for a long time.
    tables.invoices!.push({
      id: 'fee-1',
      workspace_id: WS,
      invoice_number: 'INV-8',
      type: 'sale',
      status: 'pending',
      customer_id: CUSTOMER,
      currency: 'AFN',
      due_date: daysAgo(90),
    })
    tables.invoice_outstanding!.push({
      invoice_id: 'fee-1',
      workspace_id: WS,
      total: 100,
      allocated: 0,
    })
    expect((await service.preview(ctx, 'fee-1')).state).toBe('fee_invoice')
    await expect(service.assess(ctx, 'fee-1', 'fa')).rejects.toThrow('LATE_FEE_FEE_INVOICE')
  })

  it('the line on the fee invoice is written in the language asked for', async () => {
    await fixed()
    await service.assess(ctx, INV, 'en')
    const [item] = issued[0]!.body.items as Row[]
    expect(item!.productName).toBe('Late fee on invoice INV-7')
  })

  it('a purchase, a cancelled invoice and a walk-in sale are refused and nothing is written', async () => {
    await fixed()
    invoice({ type: 'purchase' })
    await expect(service.assess(ctx, INV, 'fa')).rejects.toThrow('LATE_FEE_NOT_SALE')
    invoice({ status: 'cancelled' })
    await expect(service.assess(ctx, INV, 'fa')).rejects.toThrow('LATE_FEE_CANCELLED')
    invoice({ customer_id: null })
    await expect(service.assess(ctx, INV, 'fa')).rejects.toThrow('LATE_FEE_NO_CUSTOMER')
    expect(tables.late_fee_assessments).toEqual([])
    expect(invoices.create).not.toHaveBeenCalled()
  })
})
