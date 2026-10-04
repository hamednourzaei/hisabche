// ============================================
// dashboard.service — an arrangement of saved reports.
//
// What can go wrong HERE: a tile naming another business's report, a report
// named twice, an empty dashboard, a retired report silently vanishing from a
// dashboard, a missing table answered as «no dashboards», and a retire that
// deletes.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const rows: Row[] = []
const state: { error: { code: string; message: string } | null } = { error: null }
let nextId = 1

function from(table: string) {
  if (table !== 'report_dashboards') throw new Error(`unexpected table ${table}`)
  const filters: Array<(row: Row) => boolean> = []
  let mode: 'select' | 'insert' | 'update' = 'select'
  let payload: Row = {}
  const run = () => {
    if (state.error) return { data: null, error: state.error }
    if (mode === 'insert') {
      const row = { id: `d-${nextId++}`, is_active: true, created_at: 'now', ...payload }
      rows.push(row)
      return { data: [row], error: null }
    }
    const hit = rows.filter((row) => filters.every((f) => f(row)))
    if (mode === 'update') for (const row of hit) Object.assign(row, payload)
    return { data: hit, error: null }
  }
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    limit: () => builder,
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
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
vi.mock('../services/reporting/report.service', () => ({ reportService: {} }))

import { DashboardService } from '../services/reporting/dashboard.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const R1 = '11111111-1111-4111-8111-111111111111'
const R2 = '22222222-2222-4222-8222-222222222222'
const R_THEIRS = '33333333-3333-4333-8333-333333333333'
const ctx = { workspaceId: WS, userId: 'u1', role: 'manager' } as never
const theirs = { workspaceId: OTHER, userId: 'u2', role: 'manager' } as never

/** The ACTIVE saved reports of each business, as the report service lists them. */
let saved: Record<string, Array<{ id: string; name: string }>>
const reports = {
  list: async (context: { workspaceId: string }) =>
    (saved[context.workspaceId] ?? []).map((report) => ({
      ...report,
      groupBy: [],
      measures: ['count'],
      isActive: true,
    })) as never,
}

let service: DashboardService
beforeEach(() => {
  rows.length = 0
  state.error = null
  nextId = 1
  saved = {
    [WS]: [
      { id: R1, name: 'فروش ماهانه' },
      { id: R2, name: 'مانده‌ی مشتریان' },
    ],
    [OTHER]: [{ id: R_THEIRS, name: 'x' }],
  }
  service = new DashboardService(reports)
})

const save = (tiles: unknown[], name = 'مرور ماهانه') => service.save(ctx, { name, tiles })

describe('saving', () => {
  it('keeps the reports in the order given, for THIS business, by the person who made it', async () => {
    const view = await save([{ reportId: R2, span: 2 }, { reportId: R1 }])
    expect(view.tiles).toEqual([
      { reportId: R2, position: 0, span: 2, reportName: 'مانده‌ی مشتریان' },
      { reportId: R1, position: 1, span: 1, reportName: 'فروش ماهانه' },
    ])
    expect(rows[0]).toMatchObject({ workspace_id: WS, created_by: 'u1', name: 'مرور ماهانه' })
  })

  it('an empty dashboard is refused', async () => {
    await expect(save([])).rejects.toThrow('DASHBOARD_EMPTY')
    expect(rows).toEqual([])
  })

  it('a report of another business, or one that does not exist, is refused', async () => {
    await expect(save([{ reportId: R1 }, { reportId: R_THEIRS }])).rejects.toThrow(
      'DASHBOARD_UNKNOWN_REPORT',
    )
    expect(rows).toEqual([])
  })

  it('the same report twice is refused', async () => {
    await expect(save([{ reportId: R1 }, { reportId: R1 }])).rejects.toThrow(
      'DASHBOARD_DUPLICATE_REPORT',
    )
  })

  it('more than six tiles, a width of four, or no name is refused before anything is read', async () => {
    await expect(save(Array.from({ length: 7 }, () => ({ reportId: R1 })))).rejects.toThrow()
    await expect(save([{ reportId: R1, span: 4 }])).rejects.toThrow()
    await expect(save([{ reportId: R1 }], '  ')).rejects.toThrow()
    expect(rows).toEqual([])
  })

  it('a name already in use says so', async () => {
    state.error = { code: '23505', message: 'report_dashboards_active_name' }
    await expect(save([{ reportId: R1 }])).rejects.toMatchObject({
      message: 'DASHBOARD_NAME_TAKEN',
      statusCode: 409,
    })
  })
})

describe('reading', () => {
  it('a report retired after the dashboard was made stays as a tile that says so', async () => {
    await save([{ reportId: R1 }, { reportId: R2 }])
    saved[WS] = [{ id: R2, name: 'مانده‌ی مشتریان' }]
    const [view] = await service.list(ctx)
    expect(view!.tiles.map((tile) => tile.reportName)).toEqual([null, 'مانده‌ی مشتریان'])
    expect(view!.tiles).toHaveLength(2)
  })

  it('one business does not see another’s dashboards', async () => {
    await save([{ reportId: R1 }])
    expect(await service.list(theirs)).toEqual([])
    expect(await service.list(ctx)).toHaveLength(1)
  })

  it('a missing table is «not set up», never «no dashboards»', async () => {
    state.error = { code: '42P01', message: 'relation does not exist' }
    await expect(service.list(ctx)).rejects.toThrow('DASHBOARDS_MIGRATION_PENDING')
  })
})

describe('retiring', () => {
  it('is a flag on the row — the row stays, and it leaves the list', async () => {
    const view = await save([{ reportId: R1 }])
    await service.retire(ctx, view.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.is_active).toBe(false)
    expect(await service.list(ctx)).toEqual([])
  })

  it('another business cannot retire it', async () => {
    const view = await save([{ reportId: R1 }])
    await expect(service.retire(theirs, view.id)).rejects.toThrow('not found')
    expect(rows[0]!.is_active).toBe(true)
  })
})
