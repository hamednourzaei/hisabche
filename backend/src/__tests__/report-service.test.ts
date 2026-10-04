// ============================================
// report.service (#145) — what may be saved, and what a run computes.
//
// What can go wrong: a report that cannot be run stored anyway, money added
// across currencies, a capped result passed off as the whole answer, another
// workspace's invoices or customer names in the rows, a non-additive figure
// summed over months.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const state: { error: { code: string; message: string } | null } = { error: null }
let nextId = 1

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let range: [number, number] | null = null
  let mode: 'select' | 'insert' | 'update' = 'select'
  let payload: Row = {}
  const run = () => {
    if (state.error && table === 'saved_reports') return { data: null, error: state.error }
    if (mode === 'insert') {
      const row = { id: `rep-${nextId++}`, is_active: true, ...payload }
      ;(tables[table] ??= []).push(row)
      return { data: [row], error: null }
    }
    const hit = (tables[table] ?? []).filter((row) => filters.every((f) => f(row)))
    if (mode === 'update') for (const row of hit) Object.assign(row, payload)
    return { data: range ? hit.slice(range[0], range[1] + 1) : hit, error: null }
  }
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    limit: () => builder,
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    in: (column: string, values: unknown[]) => (
      filters.push((row) => values.includes(row[column])),
      builder
    ),
    range: (start: number, end: number) => ((range = [start, end]), builder),
    insert: (row: Row) => ((mode = 'insert'), (payload = row), builder),
    update: (row: Row) => ((mode = 'update'), (payload = row), builder),
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

import { ReportService } from '../services/reporting/report.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ctx = { workspaceId: WS, userId: 'u1', role: 'seller' } as never

let seq = 0
const invoice = (overrides: Row = {}): Row => ({
  workspace_id: WS,
  invoice_id: `i${++seq}`,
  type: 'sale',
  customer_id: 'c1',
  invoice_date: '2026-09-10',
  currency: 'AFN',
  allocated: 400,
  outstanding: 600,
  ...overrides,
})

let service: ReportService
beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  state.error = null
  nextId = 1
  seq = 0
  tables.saved_reports = []
  tables.invoice_outstanding = []
  tables.customers = [
    { id: 'c1', workspace_id: WS, full_name: 'احمد' },
    { id: 'c2', workspace_id: WS, full_name: 'سارا' },
    { id: 'c1', workspace_id: OTHER, full_name: 'secret' },
  ]
  service = new ReportService()
})

describe('saving a report', () => {
  it('a money figure is ALWAYS grouped by currency — added by the service, and stored', async () => {
    const saved = await service.save(ctx, {
      name: ' طلب هر مشتری ',
      groupBy: ['customer'],
      measures: ['outstanding'],
    })
    expect(saved).toMatchObject({
      name: 'طلب هر مشتری',
      groupBy: ['customer', 'currency'],
      measures: ['outstanding'],
    })
    expect(tables.saved_reports![0]).toMatchObject({ workspace_id: WS, created_by: 'u1' })
  })

  it('a count alone needs no currency', async () => {
    const saved = await service.save(ctx, {
      name: 'تعداد',
      groupBy: ['month'],
      measures: ['count'],
    })
    expect(saved.groupBy).toEqual(['month'])
  })

  it('what cannot be run is refused and not stored — profit, a foreign dataset’s grouping', async () => {
    await expect(
      service.save(ctx, { name: 'سود', groupBy: [], measures: ['gross_profit'] }),
    ).rejects.toThrow('REPORT_NOT_RUNNABLE')
    await expect(
      service.save(ctx, { name: 'x', groupBy: ['product'], measures: ['count'] }),
    ).rejects.toThrow('REPORT_NOT_RUNNABLE')
    expect(tables.saved_reports).toEqual([])
  })

  it('what is still owed is not summed over months — the domain’s rule reaches the caller by name', async () => {
    await expect(
      service.save(ctx, { name: 'x', groupBy: ['month'], measures: ['outstanding'] }),
    ).rejects.toThrow('REPORT_NON_ADDITIVE_IN_TIME')
  })

  it('more groupings than the limit (currency included) is refused', async () => {
    await expect(
      service.save(ctx, {
        name: 'x',
        groupBy: ['month', 'quarter', 'customer'],
        measures: ['collected'],
      }),
    ).rejects.toThrow('REPORT_TOO_MANY_DIMENSIONS')
  })

  it('a name in use and a missing table are said as such', async () => {
    state.error = { code: '23505', message: 'saved_reports_active_name' }
    await expect(
      service.save(ctx, { name: 'x', groupBy: [], measures: ['count'] }),
    ).rejects.toThrow('REPORT_NAME_TAKEN')
    state.error = { code: '42P01', message: 'relation does not exist' }
    await expect(service.list(ctx)).rejects.toThrow('REPORTS_MIGRATION_PENDING')
  })
})

describe('running a report', () => {
  it('groups THIS workspace’s sale invoices, per currency, and names the customer', async () => {
    const saved = await service.save(ctx, {
      name: 'طلب',
      groupBy: ['customer'],
      measures: ['outstanding', 'count'],
    })
    tables.invoice_outstanding = [
      invoice(),
      invoice({ outstanding: 100.5 }),
      invoice({ customer_id: 'c2', outstanding: 50 }),
      invoice({ currency: 'USD', outstanding: 70 }),
      invoice({ customer_id: null, outstanding: 5 }),
      invoice({ type: 'purchase', outstanding: 9999 }),
      invoice({ workspace_id: OTHER, outstanding: 8888 }),
    ]
    const result = await service.run(ctx, saved.id)

    expect(result.totalRows).toBe(4)
    expect(result.rows[0]).toMatchObject({
      dimensions: { customer: 'c1', currency: 'AFN' },
      customerName: 'احمد',
      values: { outstanding: 700.5, count: 2 },
    })
    // The dollar invoice of the same customer is its own row, never added in.
    expect(result.rows.find((row) => row.dimensions.currency === 'USD')?.values.outstanding).toBe(
      70,
    )
    // A sale with no customer is a group with no name — not dropped, not labelled.
    expect(result.rows.find((row) => row.dimensions.customer === null)).toMatchObject({
      customerName: null,
    })
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('collected by month and quarter', async () => {
    const saved = await service.save(ctx, {
      name: 'وصول',
      groupBy: ['month'],
      measures: ['collected'],
    })
    tables.invoice_outstanding = [
      invoice({ invoice_date: '2026-08-31', allocated: 100 }),
      invoice({ invoice_date: '2026-09-01', allocated: 250.25 }),
      invoice({ invoice_date: '2026-09-30T20:00:00Z', allocated: 250.25 }),
    ]
    const result = await service.run(ctx, saved.id)
    expect(result.rows.map((row) => [row.dimensions.month, row.values.collected])).toEqual([
      ['2026-09', 500.5],
      ['2026-08', 100],
    ])

    const quarterly = await service.save(ctx, {
      name: 'فصل',
      groupBy: ['quarter'],
      measures: ['count'],
    })
    tables.invoice_outstanding.push(invoice({ invoice_date: '2026-12-01' }))
    const byQuarter = await service.run(ctx, quarterly.id)
    expect(byQuarter.rows.map((row) => [row.dimensions.quarter, row.values.count]).sort()).toEqual([
      ['2026-Q3', 3],
      ['2026-Q4', 1],
    ])
  })

  it('more groups than the cap: the rows are capped and the answer SAYS how many there were', async () => {
    const saved = await service.save(ctx, {
      name: 'همه',
      groupBy: ['customer'],
      measures: ['count'],
    })
    tables.invoice_outstanding = Array.from({ length: 1205 }, (_, index) =>
      invoice({ customer_id: `k${index}` }),
    )
    const result = await service.run(ctx, saved.id)
    expect(result.totalRows).toBe(1205)
    expect(result.rows).toHaveLength(result.maxRows)
    expect(result.maxRows).toBeLessThan(1205)
  })

  it('an over-paid invoice is not a negative amount owed', async () => {
    const saved = await service.save(ctx, { name: 'طلب', groupBy: [], measures: ['outstanding'] })
    tables.invoice_outstanding = [invoice({ outstanding: 300 }), invoice({ outstanding: -200 })]
    expect((await service.run(ctx, saved.id)).rows[0]!.values.outstanding).toBe(300)
  })

  it('another workspace’s report cannot be run or retired', async () => {
    tables.saved_reports!.push({
      id: 'theirs',
      workspace_id: OTHER,
      name: 'x',
      definition: { groupBy: [], measures: ['count'] },
      is_active: true,
    })
    await expect(service.run(ctx, 'theirs')).rejects.toThrow('not found')
    await expect(service.retire(ctx, 'theirs')).rejects.toThrow('not found')
    expect(tables.saved_reports![0]!.is_active).toBe(true)
  })

  it('a stored definition that can no longer be run is refused at run time, not run anyway', async () => {
    tables.saved_reports!.push({
      id: 'old',
      workspace_id: WS,
      name: 'x',
      definition: { groupBy: ['month'], measures: ['outstanding'] },
      is_active: true,
    })
    await expect(service.run(ctx, 'old')).rejects.toThrow('REPORT_NON_ADDITIVE_IN_TIME')
  })
})
