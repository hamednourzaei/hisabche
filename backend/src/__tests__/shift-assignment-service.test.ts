// ============================================
// shift-assignment.service — the plan beside what was recorded.
//
// The rules two people planning at once must not break are the database's and
// are tested there (shift-assignments.pg.test.ts). What can go wrong HERE:
// «nothing recorded» read as «absent», another business's employee planned,
// a range that plans some days and not others, a date range built by string
// arithmetic that walks off the end of a month, the database's refusal lost on
// the way to the person, and a cancel that deletes.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const state: { insertError: { code?: string; message: string } | null } = { insertError: null }
const inserts: Row[][] = []
let nextId = 1

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let range: [number, number] | null = null
  let mode: 'select' | 'insert' | 'update' = 'select'
  let payload: Row | Row[] = {}
  const run = () => {
    const rows = (tables[table] ??= [])
    if (mode === 'insert') {
      inserts.push(payload as Row[])
      if (state.insertError) return { data: null, error: state.insertError }
      for (const row of payload as Row[]) {
        rows.push({ id: `sa-${nextId++}`, is_cancelled: false, ...row })
      }
      return { data: null, error: null }
    }
    const hit = rows.filter((row) => filters.every((f) => f(row)))
    if (mode === 'update') for (const row of hit) Object.assign(row, payload)
    return { data: range ? hit.slice(range[0], range[1] + 1) : hit, error: null }
  }
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    in: (column: string, values: unknown[]) => (
      filters.push((row) => values.includes(row[column])),
      builder
    ),
    range: (start: number, end: number) => ((range = [start, end]), builder),
    insert: (rows: Row[]) => ((mode = 'insert'), (payload = rows), builder),
    update: (row: Row) => ((mode = 'update'), (payload = row), builder),
    maybeSingle: async () => {
      const result = run()
      return { data: result.data?.[0] ?? null, error: result.error }
    },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  }
  return builder
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => from(table) } }))

import {
  ShiftAssignmentService,
  actualOf,
  consecutiveDays,
} from '../services/payroll/shift-assignment.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ALI = '11111111-1111-4111-8111-111111111111'
const SARA = '22222222-2222-4222-8222-222222222222'
const NOOR = '55555555-5555-4555-8555-555555555555'
const THEIRS = '33333333-3333-4333-8333-333333333333'
const SHIFT = '44444444-4444-4444-8444-444444444444'
const DAY = '2026-10-05'
const ctx = { workspaceId: WS, userId: 'u1', role: 'manager' } as never
const theirs = { workspaceId: OTHER, userId: 'u2', role: 'manager' } as never

let service: ShiftAssignmentService

const planned = (employeeId: string, overrides: Row = {}): Row => ({
  id: `sa-${nextId++}`,
  workspace_id: WS,
  employee_id: employeeId,
  shift_id: SHIFT,
  work_date: DAY,
  shift_name: 'صبح',
  starts_at: '08:00:00',
  ends_at: '14:00:00',
  is_cancelled: false,
  ...overrides,
})

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  state.insertError = null
  inserts.length = 0
  nextId = 1
  tables.employees = [
    { id: ALI, workspace_id: WS, first_name: 'علی', last_name: 'احمدی' },
    { id: SARA, workspace_id: WS, first_name: 'سارا', last_name: null },
    { id: NOOR, workspace_id: WS, first_name: 'نور', last_name: null },
    { id: THEIRS, workspace_id: OTHER, first_name: 'x', last_name: null },
  ]
  tables.attendance = []
  tables.shift_assignments = []
  service = new ShiftAssignmentService()
})

describe('consecutive days', () => {
  it('walks over the end of a month and of a year by the calendar', () => {
    expect(consecutiveDays('2026-09-29', 4)).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ])
    expect(consecutiveDays('2026-12-31', 2)).toEqual(['2026-12-31', '2027-01-01'])
    expect(consecutiveDays('2028-02-28', 3)).toEqual(['2028-02-28', '2028-02-29', '2028-03-01'])
  })
})

describe('planned beside actual', () => {
  it('nothing recorded is «unrecorded» — never «absent»', () => {
    expect(actualOf(undefined)).toBe('unrecorded')
    expect(actualOf({ status: 'absent', check_in: null, check_out: null })).toBe('absent')
    expect(actualOf({ status: 'leave', check_in: null, check_out: null })).toBe('leave')
    expect(actualOf({ status: 'present', check_in: '08:05', check_out: '14:00' })).toBe('worked')
    expect(actualOf({ status: 'present', check_in: '08:05', check_out: null })).toBe('open')
  })

  it('shows each planned person with the shift as planned and what the sheet recorded', async () => {
    tables.shift_assignments = [planned(ALI), planned(SARA), planned(NOOR)]
    tables.attendance = [
      {
        id: 'a1',
        workspace_id: WS,
        employee_id: ALI,
        date: DAY,
        status: 'present',
        check_in: '08:10:00',
        check_out: '14:00:00',
      },
      {
        id: 'a2',
        workspace_id: WS,
        employee_id: SARA,
        date: DAY,
        status: 'absent',
        check_in: null,
        check_out: null,
      },
      // Another day's record must not leak into this one.
      {
        id: 'a3',
        workspace_id: WS,
        employee_id: NOOR,
        date: '2026-10-04',
        status: 'present',
        check_in: '08:00:00',
        check_out: '14:00:00',
      },
    ]
    const plan = await service.day(ctx, DAY)
    expect(plan.assignments.map((item) => [item.employeeName, item.actual])).toEqual([
      ['علی احمدی', 'worked'],
      ['سارا', 'absent'],
      ['نور', 'unrecorded'],
    ])
    expect(plan.assignments[0]).toMatchObject({
      shiftName: 'صبح',
      startsAt: '08:00',
      endsAt: '14:00',
      checkIn: '08:10',
      checkOut: '14:00',
    })
    expect(plan.summary).toEqual({ planned: 3, worked: 1, absent: 1, unrecorded: 1 })
  })

  it('a cancelled assignment, another day and another business are not in the plan', async () => {
    tables.shift_assignments = [
      planned(ALI, { is_cancelled: true }),
      planned(SARA, { work_date: '2026-10-06' }),
      planned(THEIRS, { workspace_id: OTHER }),
    ]
    expect((await service.day(ctx, DAY)).assignments).toEqual([])
    expect((await service.day(theirs, DAY)).assignments).toHaveLength(1)
  })

  it('before the migration, planning says «not set up» rather than failing as a server error', async () => {
    state.insertError = { code: '42P01', message: 'relation does not exist' }
    await expect(
      service.assign(ctx, { employeeId: ALI, shiftId: SHIFT, fromDate: DAY, days: 1 }),
    ).rejects.toMatchObject({ message: 'SHIFT_ASSIGNMENTS_MIGRATION_PENDING', statusCode: 503 })
  })
})

describe('assigning', () => {
  const assign = (overrides: Row = {}) =>
    service.assign(ctx, {
      employeeId: ALI,
      shiftId: SHIFT,
      fromDate: DAY,
      days: 1,
      ...overrides,
    } as never)

  it('several days are ONE insert, by the person who planned them', async () => {
    const result = await assign({ fromDate: '2026-10-30', days: 3 })
    expect(result.planned).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
    expect(inserts).toHaveLength(1)
    expect(inserts[0]!.map((row) => row.work_date)).toEqual(result.planned)
    expect(inserts[0]!.every((row) => row.workspace_id === WS && row.assigned_by === 'u1')).toBe(
      true,
    )
  })

  it('another business’s employee is not found, and nothing is written', async () => {
    await expect(assign({ employeeId: THEIRS })).rejects.toThrow('not found')
    expect(inserts).toEqual([])
  })

  it('zero days, a fraction, or more than a month is refused', async () => {
    for (const days of [0, 1.5, 32, -1]) {
      await expect(assign({ days }), String(days)).rejects.toThrow('SHIFT_ASSIGNMENT_DAYS_INVALID')
    }
    expect(inserts).toEqual([])
  })

  it('the database’s refusals reach the person by name', async () => {
    state.insertError = { code: 'P0001', message: 'SHIFT_ASSIGNMENT_OVERLAP' }
    await expect(assign()).rejects.toMatchObject({
      message: 'SHIFT_ASSIGNMENT_OVERLAP',
      statusCode: 409,
    })
    state.insertError = { code: 'P0001', message: 'SHIFT_ASSIGNMENT_SHIFT_RETIRED' }
    await expect(assign()).rejects.toMatchObject({
      message: 'SHIFT_ASSIGNMENT_SHIFT_RETIRED',
      statusCode: 400,
    })
    // A refused range plans nothing.
    expect(tables.shift_assignments).toEqual([])
  })
})

describe('cancelling', () => {
  it('marks the row cancelled, by whom and when — the row stays', async () => {
    tables.shift_assignments = [planned(ALI)]
    const id = String(tables.shift_assignments[0]!.id)
    await service.cancel(ctx, id)
    expect(tables.shift_assignments).toHaveLength(1)
    expect(tables.shift_assignments[0]).toMatchObject({ is_cancelled: true, cancelled_by: 'u1' })
    expect(tables.shift_assignments[0]!.cancelled_at).toEqual(expect.any(String))
  })

  it('another business’s assignment, and one already cancelled, are not found', async () => {
    tables.shift_assignments = [planned(ALI)]
    const id = String(tables.shift_assignments[0]!.id)
    await expect(service.cancel(theirs, id)).rejects.toThrow('not found')
    expect(tables.shift_assignments[0]!.is_cancelled).toBe(false)
    await service.cancel(ctx, id)
    await expect(service.cancel(ctx, id)).rejects.toThrow('not found')
  })
})
