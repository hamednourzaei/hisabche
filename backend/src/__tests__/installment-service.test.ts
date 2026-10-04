// ============================================
// installment.service — what it derives and what it refuses.
//
// The database test proves the write. What can go wrong HERE is the reading:
// «paid» counted twice, a paid installment shown as late, a missing table
// answered as «no plan», an invoice read across the workspace boundary.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const state: {
  tableError: { code: string; message: string } | null
  rpcError: { code?: string; message: string } | null
} = {
  tableError: null,
  rpcError: null,
}
const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = []

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  const run = () =>
    table === 'invoice_installments' && state.tableError
      ? { data: null, error: state.tableError }
      : { data: (tables[table] ?? []).filter((row) => filters.every((f) => f(row))), error: null }
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    maybeSingle: async () => {
      const result = run()
      return { data: result.data?.[0] ?? null, error: result.error }
    },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  }
  return builder
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => from(table),
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args })
      if (state.rpcError) return { data: null, error: state.rpcError }
      tables.invoice_installments = (args.p_lines as Row[]).map((line) => ({
        ...line,
        workspace_id: args.p_workspace_id,
        invoice_id: args.p_invoice_id,
      }))
      return { data: (args.p_lines as Row[]).length, error: null }
    },
  },
}))

import { InstallmentService } from '../services/commerce/installment.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ctx = { workspaceId: WS, userId: 'u', role: 'owner' } as never
const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

const invoice = (outstanding: number, workspace = WS): Row => ({
  workspace_id: workspace,
  invoice_id: 'inv',
  total: 1000,
  allocated: 1000 - outstanding,
  outstanding,
  currency: 'USD',
})
const line = (seq: number, dueDate: string, amountMinor: number): Row => ({
  workspace_id: WS,
  invoice_id: 'inv',
  seq,
  due_date: dueDate,
  amount_minor: amountMinor,
})

let service: InstallmentService
beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  state.tableError = null
  state.rpcError = null
  rpcCalls.length = 0
  service = new InstallmentService()
})

describe('reading a plan', () => {
  it('what was paid fills the OLDEST installment first, and a paid one is never late', async () => {
    // Planned 1,000 in three parts; 500 has been paid since → 500 still owed.
    tables.invoice_outstanding = [invoice(500)]
    tables.invoice_installments = [
      line(1, day(-60), 33_334),
      line(2, day(-30), 33_333),
      line(3, day(30), 33_333),
    ]
    const plan = await service.get(ctx, 'inv')

    expect(plan.currency).toBe('USD')
    expect(plan.lines.map((l) => [l.paid, l.remaining])).toEqual([
      [333.34, 0],
      [166.66, 166.67],
      [0, 333.33],
    ])
    expect(plan.lines[0]!.daysLate).toBe(0)
    expect(plan.lines[1]!.daysLate).toBe(30)
    expect(plan.lines[2]!.daysLate).toBe(0)
    expect(plan.nextDue).toMatchObject({ seq: 2, remaining: 166.67 })
  })

  it('an invoice with no plan has an empty one — and says what it owes', async () => {
    tables.invoice_outstanding = [invoice(1000)]
    const plan = await service.get(ctx, 'inv')
    expect(plan).toMatchObject({ lines: [], nextDue: null, outstanding: 1000 })
  })

  it('a missing table is «not set up», not «no plan»', async () => {
    tables.invoice_outstanding = [invoice(1000)]
    state.tableError = { code: '42P01', message: 'relation does not exist' }
    await expect(service.get(ctx, 'inv')).rejects.toThrow('INSTALLMENTS_MIGRATION_PENDING')
  })

  it('any other read failure is an error, not an empty plan', async () => {
    tables.invoice_outstanding = [invoice(1000)]
    state.tableError = { code: '57014', message: 'timeout' }
    await expect(service.get(ctx, 'inv')).rejects.toThrow('Failed to read the installment plan')
  })

  it('another workspace’s invoice is «not found»', async () => {
    tables.invoice_outstanding = [invoice(1000, OTHER)]
    await expect(service.get(ctx, 'inv')).rejects.toThrow('not found')
  })
})

describe('making a plan', () => {
  it('splits what is owed NOW; the remainder goes on the first part and the sum is exact', async () => {
    tables.invoice_outstanding = [invoice(1000)]
    const plan = await service.plan(ctx, 'inv', { count: 3, firstDueDate: '2026-01-31' })

    const sent = rpcCalls[0]!.args.p_lines as Array<{
      seq: number
      due_date: string
      amount_minor: number
    }>
    expect(sent.map((l) => l.amount_minor)).toEqual([33_334, 33_333, 33_333])
    // The 31st clamps to the end of February; it does not skip into March.
    expect(sent.map((l) => l.due_date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
    expect(rpcCalls[0]!.args).toMatchObject({ p_workspace_id: WS, p_invoice_id: 'inv' })
    expect(plan.lines).toHaveLength(3)
  })

  it('a paid invoice has nothing to plan, and the database is not asked', async () => {
    tables.invoice_outstanding = [invoice(0)]
    await expect(
      service.plan(ctx, 'inv', { count: 2, firstDueDate: '2026-10-01' }),
    ).rejects.toThrow('INSTALLMENT_NOTHING_OWED')
    expect(rpcCalls).toEqual([])
  })

  it('a refusal the database names reaches the caller by that name', async () => {
    tables.invoice_outstanding = [invoice(1000)]
    state.rpcError = { code: 'P0001', message: 'INSTALLMENT_SUM_MISMATCH' }
    await expect(
      service.plan(ctx, 'inv', { count: 2, firstDueDate: '2026-10-01' }),
    ).rejects.toThrow('INSTALLMENT_SUM_MISMATCH')
  })

  it('a missing function is «not set up»', async () => {
    tables.invoice_outstanding = [invoice(1000)]
    state.rpcError = { code: 'PGRST202', message: 'Could not find the function' }
    await expect(
      service.plan(ctx, 'inv', { count: 2, firstDueDate: '2026-10-01' }),
    ).rejects.toThrow('INSTALLMENTS_MIGRATION_PENDING')
  })

  it('clearing sends an empty plan for THIS workspace', async () => {
    tables.invoice_outstanding = [invoice(1000)]
    tables.invoice_installments = [line(1, day(1), 50_000), line(2, day(31), 50_000)]
    const plan = await service.clear(ctx, 'inv')
    expect(rpcCalls[0]!.args).toMatchObject({ p_lines: [], p_workspace_id: WS })
    expect(plan.lines).toEqual([])
  })
})
