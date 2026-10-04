// ============================================
// Standing arrangements (capability #63 — recurring invoice): the runner.
//
// The database is a small in-memory stand-in for the two tables the service
// owns; the invoice service and the membership lookup are replaced, because
// what is under test is the RUNNER — which days it evaluates, that a slot is
// issued once, what a failure does — not how an invoice is written (that has
// its own tests, and its own real-Postgres test).
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const tables: Record<string, Row[]> = { automations: [], automation_runs: [] }
let sequence = 0

/** Just enough of the query builder for what automation.service calls. */
function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let action: 'select' | 'insert' | 'update' = 'select'
  let payload: Row | null = null
  let range: [number, number] | null = null
  let limit: number | null = null
  let returning = false

  const matching = () => (tables[table] as Row[]).filter((row) => filters.every((f) => f(row)))

  const run = () => {
    if (action === 'insert') {
      const row: Row = { id: `id-${(sequence += 1)}`, created_at: `t${sequence}`, ...payload }
      if (
        table === 'automation_runs' &&
        row.outcome === 'ran' &&
        tables.automation_runs!.some(
          (r) =>
            r.automation_id === row.automation_id && r.slot === row.slot && r.outcome === 'ran',
        )
      ) {
        return { data: null, error: { code: '23505', message: 'duplicate' } }
      }
      if (table === 'automations') {
        Object.assign(row, {
          attempts: 0,
          last_run_at: null,
          archived_at: null,
          disabled_reason: null,
          ...payload,
        })
      }
      tables[table]!.push(row)
      return { data: [row], error: null }
    }
    if (action === 'update') {
      const rows = matching()
      for (const row of rows) Object.assign(row, payload)
      return { data: rows, error: null }
    }
    let rows = matching()
    if (range) rows = rows.slice(range[0], range[1] + 1)
    if (limit !== null) rows = rows.slice(0, limit)
    return { data: rows, error: null }
  }

  const builder: Record<string, unknown> = {
    select: () => ((returning = true), builder),
    insert: (value: Row) => ((action = 'insert'), (payload = value), builder),
    update: (value: Row) => ((action = 'update'), (payload = value), builder),
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    is: (column: string, value: unknown) => (
      filters.push((row) => (row[column] ?? null) === value),
      builder
    ),
    order: () => builder,
    range: (start: number, end: number) => ((range = [start, end]), builder),
    limit: (count: number) => ((limit = count), builder),
    maybeSingle: async () => {
      const result = run()
      return { data: (result.data as Row[] | null)?.[0] ?? null, error: result.error }
    },
    single: async () => {
      const result = run()
      return { data: (result.data as Row[] | null)?.[0] ?? null, error: result.error }
    },
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(run()).then((result) =>
        resolve(returning || action === 'select' ? result : { error: result.error }),
      ),
  }
  return builder
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => from(table) } }))

const { createInvoice, requireWorkspace, logBusinessEvent, runMonthEnd } = vi.hoisted(() => ({
  runMonthEnd: vi.fn(),
  createInvoice: vi.fn(),
  requireWorkspace: vi.fn(),
  logBusinessEvent: vi.fn(async (..._args: unknown[]) => undefined),
}))
vi.mock('../services/invoice.service', () => ({
  InvoiceService: class {
    create = createInvoice
  },
}))

vi.mock('../services/tenancy.service', () => ({
  requireWorkspace: (...args: unknown[]) => requireWorkspace(...args),
}))

vi.mock('../services/event-log.service', () => ({
  logBusinessEvent: (...args: unknown[]) => logBusinessEvent(...args),
}))
// The month-end package and the ledger are not under test here — only WHICH
// period the scheduled close asks them for, and what it does with the answer.
vi.mock('../services/accounting', () => ({ AccountingService: class {} }))
vi.mock('../services/accounting/month-end.service', () => ({
  runMonthEnd: (...args: unknown[]) => runMonthEnd(...args),
}))

import {
  AutomationService,
  MAX_CATCH_UP_DAYS,
  addDays,
  invoiceForSlot,
  nextRunOn,
} from '../services/automation/automation.service'
import { sourceIdOf } from '../utils/deterministic-id'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'
const ctx = { workspaceId: WS, userId: USER, role: 'owner' } as never

const template = {
  type: 'sale',
  currency: 'AFN',
  subtotal: 3000,
  total: 3000,
  items: [{ productName: 'اجاره‌ی ماهانه', quantity: 1, unitPrice: 3000, totalPrice: 3000 }],
}

function seed(overrides: Row = {}): Row {
  const row: Row = {
    id: `auto-${(sequence += 1)}`,
    workspace_id: WS,
    name: 'rent',
    action_type: 'recurring_invoice',
    cadence: { kind: 'monthly', dayOfMonth: 1, from: '2026-01-01' },
    conditions: null,
    payload: { invoice: template, dueInDays: 10 },
    enabled: true,
    on_failure: 'stop',
    max_attempts: 2,
    attempts: 0,
    disabled_reason: null,
    last_checked_on: '2026-09-30',
    last_run_at: null,
    archived_at: null,
    created_by: USER,
    created_at: 't0',
    ...overrides,
  }
  tables.automations!.push(row)
  return row
}

const runsOf = (id: unknown) => tables.automation_runs!.filter((run) => run.automation_id === id)

let service: AutomationService

beforeEach(() => {
  tables.automations = []
  tables.automation_runs = []
  createInvoice.mockReset()
  createInvoice.mockImplementation(async () => ({ id: `inv-${(sequence += 1)}` }))
  requireWorkspace.mockReset()
  requireWorkspace.mockImplementation(async (userId: string, workspaceId: string) => ({
    workspaceId,
    userId,
    role: 'manager',
  }))
  logBusinessEvent.mockClear()
  service = new AutomationService()
})

describe('helpers', () => {
  it('addDays crosses months and years without string arithmetic', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('the slot invoice is dated the slot, due after it, and unpaid whatever the template said', () => {
    const invoice = invoiceForSlot(
      {
        ...template,
        date: '2020-01-01T00:00:00.000Z',
        paidAmount: 3000,
        payments: [{ method: 'cash', amount: 3000 }],
      },
      '2026-10-01',
      10,
    ) as Record<string, unknown>
    expect(invoice.date).toBe('2026-10-01T00:00:00.000Z')
    expect(invoice.dueDate).toBe('2026-10-11T00:00:00.000Z')
    expect(invoice.paidAmount).toBe(0)
    expect(invoice.payments).toBeUndefined()
  })

  it('a template the invoice route would refuse is refused here too', () => {
    expect(() => invoiceForSlot({ ...template, items: [] }, '2026-10-01', null)).toThrow()
  })

  it('nextRunOn finds the next due day, and none for a paused arrangement', () => {
    const automation = {
      id: 'a',
      name: 'a',
      enabled: true,
      cadence: { kind: 'monthly' as const, dayOfMonth: 31, from: '2026-01-01' },
      conditions: null,
      action: { type: 'recurring_invoice' as const, payload: {} },
      onFailure: 'stop' as const,
      maxAttempts: 3,
    }
    // The 31st in a 30-day month is the 30th — the month is not skipped.
    expect(nextRunOn(automation, '2026-11-01')).toBe('2026-11-30')
    expect(nextRunOn({ ...automation, enabled: false }, '2026-11-01')).toBeNull()
  })
})

describe('the nightly pass', () => {
  it('issues the invoice on its due day, through the invoice service, as the creator', async () => {
    const row = seed()
    const totals = await service.runDue('2026-10-01')

    expect(totals).toMatchObject({ evaluated: 1, ran: 1, failed: 0 })
    expect(createInvoice).toHaveBeenCalledTimes(1)
    const [actor, invoice, branch, options] = createInvoice.mock.calls[0] as [
      Row,
      Row,
      unknown,
      Row,
    ]
    expect(actor).toMatchObject({ workspaceId: WS, userId: USER })
    expect(invoice.date).toBe('2026-10-01T00:00:00.000Z')
    expect(branch).toBeNull()
    expect(options.clientRequestId).toBe(
      sourceIdOf(WS, 'recurring_invoice', row.id as string, '2026-10-01'),
    )

    expect(runsOf(row.id)).toMatchObject([
      { slot: '2026-10-01', outcome: 'ran', document_type: 'invoice' },
    ])
    expect(row.last_checked_on).toBe('2026-10-01')
    expect(row.attempts).toBe(0)
  })

  it('does nothing on a day that is not due — and still remembers it looked', async () => {
    const row = seed({ last_checked_on: '2026-10-01' })
    const totals = await service.runDue('2026-10-02')
    expect(totals.ran).toBe(0)
    expect(createInvoice).not.toHaveBeenCalled()
    expect(runsOf(row.id)).toEqual([])
    expect(row.last_checked_on).toBe('2026-10-02')
  })

  it('a second pass on the same day issues nothing twice', async () => {
    const row = seed()
    await service.runDue('2026-10-01')
    // As if the first pass crashed before saving where it got to.
    row.last_checked_on = '2026-09-30'
    await service.runDue('2026-10-01')
    expect(createInvoice).toHaveBeenCalledTimes(1)
    expect(runsOf(row.id).filter((run) => run.outcome === 'ran')).toHaveLength(1)
  })

  it('a pass that missed days issues each missed slot, dated its own day', async () => {
    const row = seed({
      cadence: { kind: 'interval', everyDays: 7, from: '2026-09-01' },
      last_checked_on: '2026-09-10',
    })
    await service.runDue('2026-10-01')
    // Due after the 10th: 15, 22, 29 September.
    expect(
      createInvoice.mock.calls.map((call) => String((call[1] as Row).date).slice(0, 10)),
    ).toEqual(['2026-09-15', '2026-09-22', '2026-09-29'])
    expect(runsOf(row.id).map((run) => run.slot)).toEqual([
      '2026-09-15',
      '2026-09-22',
      '2026-09-29',
    ])
  })

  it('a slot older than the catch-up window is recorded as skipped, not issued', async () => {
    const today = '2026-10-01'
    const row = seed({
      cadence: { kind: 'once', on: addDays(today, -(MAX_CATCH_UP_DAYS + 5)) },
      last_checked_on: addDays(today, -(MAX_CATCH_UP_DAYS + 20)),
    })
    await service.runDue(today)
    expect(createInvoice).not.toHaveBeenCalled()
    expect(runsOf(row.id)).toMatchObject([{ outcome: 'skipped', detail: 'TOO_LATE' }])
  })

  it('a paused arrangement is not read at all', async () => {
    const row = seed({ enabled: false })
    await service.runDue('2026-10-01')
    expect(createInvoice).not.toHaveBeenCalled()
    expect(runsOf(row.id)).toEqual([])
  })

  it('one arrangement failing does not stop the next one', async () => {
    const bad = seed({ name: 'bad' })
    const good = seed({ name: 'good' })
    createInvoice.mockImplementationOnce(async () => {
      throw new Error('INVENTORY_INSUFFICIENT_STOCK')
    })
    const totals = await service.runDue('2026-10-01')
    expect(totals).toMatchObject({ ran: 1, failed: 1 })
    expect(runsOf(bad.id)).toMatchObject([
      { outcome: 'failed', detail: 'INVENTORY_INSUFFICIENT_STOCK' },
    ])
    expect(runsOf(good.id)).toMatchObject([{ outcome: 'ran' }])
  })
})

describe('failure', () => {
  it('«stop» counts attempts, then switches the arrangement off and says why', async () => {
    const row = seed({
      cadence: { kind: 'interval', everyDays: 1, from: '2026-09-01' },
      last_checked_on: '2026-09-28',
      max_attempts: 2,
    })
    createInvoice.mockImplementation(async () => {
      throw new Error('PLAN_LIMIT_REACHED')
    })
    await service.runDue('2026-10-01')

    // 29th fails (1), 30th fails (2) → off; the 1st is not attempted.
    expect(createInvoice).toHaveBeenCalledTimes(2)
    expect(row.enabled).toBe(false)
    expect(row.disabled_reason).toBe('FAILED_TOO_OFTEN')
    expect(row.attempts).toBe(2)
    // …and a person is told, both times.
    expect(logBusinessEvent).toHaveBeenCalledTimes(2)
    expect((logBusinessEvent.mock.calls[1] as unknown as [Row])[0]).toMatchObject({
      action: 'disabled',
      notifyType: 'warning',
    })
  })

  it('«keep» never switches off', async () => {
    const row = seed({
      cadence: { kind: 'interval', everyDays: 1, from: '2026-09-01' },
      last_checked_on: '2026-09-27',
      on_failure: 'keep',
      max_attempts: 1,
    })
    createInvoice.mockImplementation(async () => {
      throw new Error('boom')
    })
    await service.runDue('2026-10-01')
    expect(createInvoice).toHaveBeenCalledTimes(4)
    expect(row.enabled).toBe(true)
  })

  it('a success after failures clears the count', async () => {
    const row = seed({ attempts: 1 })
    await service.runDue('2026-10-01')
    expect(row.attempts).toBe(0)
  })

  it('a creator who is no longer a member fails the run — it does not act as a ghost', async () => {
    const row = seed()
    requireWorkspace.mockImplementation(async () => {
      throw new Error('WORKSPACE_ACCESS_DENIED')
    })
    await service.runDue('2026-10-01')
    expect(createInvoice).not.toHaveBeenCalled()
    expect(runsOf(row.id)).toMatchObject([{ outcome: 'failed', detail: 'WORKSPACE_ACCESS_DENIED' }])
  })

  it('an action the backend cannot perform is a recorded failure, not a silent skip', async () => {
    const row = seed({ action_type: 'campaign_touch' })
    await service.runDue('2026-10-01')
    expect(runsOf(row.id)).toMatchObject([
      { outcome: 'failed', detail: 'AUTOMATION_ACTION_NOT_SUPPORTED' },
    ])
  })
})

describe('what a member does', () => {
  it('creating an arrangement issues nothing for today or the past', async () => {
    const created = await service.createRecurringInvoice(ctx, {
      name: 'rent',
      cadence: { kind: 'monthly', dayOfMonth: 1, calendar: 'gregory', from: '2020-01-01' },
      dueInDays: 10,
      invoice: { ...template, paidAmount: 3000 },
      onFailure: 'stop',
      maxAttempts: 3,
    })
    const stored = tables.automations![0] as Row
    expect(stored.last_checked_on).toBe(new Date().toISOString().slice(0, 10))
    // The stored template carries no date and no payment.
    const invoice = (stored.payload as { invoice: Row }).invoice
    expect(invoice.date).toBeUndefined()
    expect(invoice.paidAmount).toBe(0)
    expect(created.summary).toMatchObject({ type: 'sale', total: 3000, currency: 'AFN' })
    expect(created.nextRunOn).not.toBeNull()
    expect(createInvoice).not.toHaveBeenCalled()
  })

  it('a template the invoice route would refuse cannot be saved', async () => {
    await expect(
      service.createRecurringInvoice(ctx, {
        name: 'bad',
        cadence: { kind: 'once', on: '2027-01-01' },
        invoice: { ...template, items: [] },
        onFailure: 'stop',
        maxAttempts: 3,
      }),
    ).rejects.toThrow()
    expect(tables.automations).toHaveLength(0)
  })

  it('resuming clears the failure state and does not replay the paused days', async () => {
    const row = seed({
      enabled: false,
      disabled_reason: 'FAILED_TOO_OFTEN',
      attempts: 3,
      last_checked_on: '2026-06-01',
    })
    const view = await service.update(ctx, row.id as string, { enabled: true })
    expect(view.enabled).toBe(true)
    expect(row.attempts).toBe(0)
    expect(row.disabled_reason).toBeNull()
    expect(row.last_checked_on).toBe(new Date().toISOString().slice(0, 10))
  })

  it('another workspace cannot touch it', async () => {
    const row = seed()
    const stranger = {
      workspaceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      userId: USER,
      role: 'owner',
    } as never
    await expect(service.update(stranger, row.id as string, { enabled: false })).rejects.toThrow(
      'not found',
    )
    await expect(service.archive(stranger, row.id as string)).rejects.toThrow('not found')
    await expect(service.runNow(stranger, row.id as string)).rejects.toThrow('not found')
    expect(await service.list(stranger)).toEqual([])
    expect(row.enabled).toBe(true)
  })

  it('«run now» issues today’s once; a second press is refused', async () => {
    const row = seed({ cadence: { kind: 'monthly', dayOfMonth: 15, from: '2026-01-01' } })
    const first = await service.runNow(ctx, row.id as string)
    expect(first.outcome).toBe('ran')
    await expect(service.runNow(ctx, row.id as string)).rejects.toThrow(
      'AUTOMATION_ALREADY_RAN_TODAY',
    )
    expect(createInvoice).toHaveBeenCalledTimes(1)
  })

  it('archiving removes it from the list and from the nightly pass, and keeps its history', async () => {
    const row = seed()
    await service.runDue('2026-10-01')
    await service.archive(ctx, row.id as string)
    expect(await service.list(ctx)).toEqual([])
    expect(runsOf(row.id)).toHaveLength(1)
    row.last_checked_on = '2026-10-31'
    await service.runDue('2026-11-01')
    expect(createInvoice).toHaveBeenCalledTimes(1)
  })
})

describe('capability #58 — the scheduled month-end', () => {
  const owner = () =>
    requireWorkspace.mockImplementation(async (userId: string, workspaceId: string) => ({
      workspaceId,
      userId,
      role: 'owner',
    }))

  const monthEnd = (overrides: Row = {}) =>
    seed({
      name: 'month-end',
      action_type: 'month_end',
      cadence: { kind: 'monthly', dayOfMonth: 1, calendar: 'persian', from: '2026-01-01' },
      payload: { fiscalYearEndMonth: 12, lock: true },
      ...overrides,
    })

  beforeEach(() => {
    runMonthEnd.mockReset()
    runMonthEnd.mockImplementation(async () => ({ outcomes: [], locked: true }))
    owner()
  })

  it('on the 1st of a solar Hijri month, closes the whole month before it', async () => {
    // 1 Aban 1405 = 23 October 2026; Mehr ran 23 September – 22 October.
    const row = monthEnd({ last_checked_on: '2026-10-22' })
    await service.runDue('2026-10-23')

    expect(runMonthEnd).toHaveBeenCalledTimes(1)
    expect((runMonthEnd.mock.calls[0] as unknown[])[1]).toMatchObject({
      fromDate: '2026-09-23',
      toDate: '2026-10-22',
      closesYear: false,
      lock: true,
    })
    expect(runsOf(row.id)).toMatchObject([{ slot: '2026-10-23', outcome: 'ran' }])
    // No document id: a close is not a document.
    expect(runsOf(row.id)[0]!.document_id).toBeNull()
    expect(createInvoice).not.toHaveBeenCalled()
  })

  it('does NOT run on the 1st of a Gregorian month for a solar Hijri arrangement', async () => {
    monthEnd({ last_checked_on: '2026-09-30' })
    await service.runDue('2026-10-01')
    expect(runMonthEnd).not.toHaveBeenCalled()
  })

  it('closing the month the person named as their year end closes the year', async () => {
    // 1 Farvardin 1406: the month before it is Esfand 1405, month 12.
    const nowruz = '2027-03-21'
    monthEnd({ last_checked_on: addDays(nowruz, -1) })
    await service.runDue(nowruz)
    const input = (runMonthEnd.mock.calls[0] as unknown[])[1] as Row
    expect(input.closesYear).toBe(true)
    expect(input.toDate).toBe(addDays(nowruz, -1))
  })

  it('a Gregorian arrangement closes the Gregorian month, and December when that is the year end', async () => {
    monthEnd({
      cadence: { kind: 'monthly', dayOfMonth: 1, calendar: 'gregory', from: '2026-01-01' },
      last_checked_on: '2026-12-31',
    })
    await service.runDue('2027-01-01')
    expect((runMonthEnd.mock.calls[0] as unknown[])[1]).toMatchObject({
      fromDate: '2026-12-01',
      toDate: '2026-12-31',
      closesYear: true,
    })
  })

  it('«do not lock» is passed through; the default is to lock', async () => {
    monthEnd({ last_checked_on: '2026-10-22', payload: { fiscalYearEndMonth: 12, lock: false } })
    await service.runDue('2026-10-23')
    expect((runMonthEnd.mock.calls[0] as unknown[])[1]).toMatchObject({ lock: false })
  })

  it('a package that stopped early is a FAILED run that names the step', async () => {
    const row = monthEnd({ last_checked_on: '2026-10-22' })
    runMonthEnd.mockImplementation(async () => ({
      outcomes: [],
      locked: false,
      failedAt: 'revaluation',
    }))
    const totals = await service.runDue('2026-10-23')
    expect(totals.failed).toBe(1)
    expect(runsOf(row.id)).toMatchObject([
      { outcome: 'failed', detail: 'MONTH_END_FAILED_AT_REVALUATION' },
    ])
    expect(row.attempts).toBe(1)
  })

  it('a creator who may no longer lock a period cannot close one through a schedule', async () => {
    const row = monthEnd({ last_checked_on: '2026-10-22' })
    requireWorkspace.mockImplementation(async (userId: string, workspaceId: string) => ({
      workspaceId,
      userId,
      role: 'manager',
    }))
    await service.runDue('2026-10-23')
    expect(runMonthEnd).not.toHaveBeenCalled()
    expect(runsOf(row.id)).toMatchObject([
      { outcome: 'failed', detail: 'AUTOMATION_ACTOR_NOT_ALLOWED' },
    ])
  })

  it('an arrangement with no stated year end refuses to run rather than assume one', async () => {
    const row = monthEnd({ last_checked_on: '2026-10-22', payload: { lock: true } })
    await service.runDue('2026-10-23')
    expect(runMonthEnd).not.toHaveBeenCalled()
    expect(runsOf(row.id)).toMatchObject([
      { outcome: 'failed', detail: 'AUTOMATION_FISCAL_YEAR_END_MISSING' },
    ])
  })

  it('one per workspace: a second is refused', async () => {
    const first = await service.createMonthEnd(ctx, {
      calendar: 'persian',
      fiscalYearEndMonth: 12,
      lock: true,
    })
    expect(first.monthEnd).toEqual({ fiscalYearEndMonth: 12, lock: true })
    expect(first.cadence).toMatchObject({ kind: 'monthly', dayOfMonth: 1, calendar: 'persian' })
    await expect(
      service.createMonthEnd(ctx, { calendar: 'persian', fiscalYearEndMonth: 12, lock: true }),
    ).rejects.toThrow('AUTOMATION_MONTH_END_EXISTS')
    // …but a removed one does not block a new one.
    await service.archive(ctx, first.id)
    await service.createMonthEnd(ctx, { calendar: 'gregory', fiscalYearEndMonth: 12, lock: false })
  })
})
