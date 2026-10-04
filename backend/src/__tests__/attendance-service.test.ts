// ============================================
// attendance.service — the daily sheet and the one write behind it.
//
// What can go wrong: an employee of another workspace marked by id, a second
// row for the same day, an open day shown as zero hours, «not recorded» counted
// as «absent», times stored on a leave day.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const state: {
  insertError: { code: string; message: string } | null
  onInsertRace: (() => void) | null
} = {
  insertError: null,
  onInsertRace: null,
}
let nextId = 1

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let range: [number, number] | null = null
  let limit: number | null = null
  let mode: 'select' | 'insert' | 'update' = 'select'
  let payload: Row = {}

  const rows = () => (tables[table] ?? []).filter((row) => filters.every((f) => f(row)))
  const run = () => {
    if (mode === 'insert') {
      if (state.insertError) {
        state.onInsertRace?.()
        return { data: null, error: state.insertError }
      }
      const row = { id: `att-${nextId++}`, ...payload }
      ;(tables[table] ??= []).push(row)
      return { data: [row], error: null }
    }
    if (mode === 'update') {
      const hit = rows()
      for (const row of hit) Object.assign(row, payload)
      return { data: hit, error: null }
    }
    let hit = rows().sort((a, b) => String(a.id).localeCompare(String(b.id)))
    if (range) hit = hit.slice(range[0], range[1] + 1)
    if (limit !== null) hit = hit.slice(0, limit)
    return { data: hit, error: null }
  }
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    range: (start: number, end: number) => ((range = [start, end]), builder),
    limit: (n: number) => ((limit = n), builder),
    insert: (row: Row) => ((mode = 'insert'), (payload = row), builder),
    update: (row: Row) => ((mode = 'update'), (payload = row), builder),
    maybeSingle: async () => {
      const result = run()
      return { data: result.data?.[0] ?? null, error: result.error }
    },
    single: async () => {
      const result = run()
      return { data: result.data?.[0] ?? null, error: result.error }
    },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  }
  return builder
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => from(table) } }))

import { AttendanceService } from '../services/payroll/attendance.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ctx = { workspaceId: WS, userId: 'u1', role: 'manager' } as never
const DAY = '2026-10-04'

const mark = (overrides: Record<string, unknown> = {}) => ({
  employeeId: 'e1',
  date: DAY,
  status: 'present' as const,
  checkIn: '08:00',
  checkOut: null,
  note: null,
  ...overrides,
})

let service: AttendanceService
beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  state.insertError = null
  state.onInsertRace = null
  nextId = 1
  tables.employees = [
    { id: 'e1', workspace_id: WS, first_name: 'احمد', last_name: 'کریمی', position: 'فروشنده' },
    { id: 'e2', workspace_id: WS, first_name: 'سارا', last_name: null, position: null },
    { id: 'x9', workspace_id: OTHER, first_name: 'other', last_name: 'tenant', position: null },
  ]
  tables.attendance = []
  service = new AttendanceService()
})

describe('marking a day', () => {
  it('a check-in with no check-out is an OPEN day: no hours, not zero', async () => {
    const record = await service.mark(ctx, mark())
    expect(record.result).toMatchObject({ isOpen: true, workedHours: null, issue: 'NO_CHECK_OUT' })
    expect(tables.attendance![0]).toMatchObject({
      workspace_id: WS,
      user_id: 'u1',
      employee_id: 'e1',
      date: DAY,
    })
  })

  it('marking the same day again corrects the ONE record', async () => {
    await service.mark(ctx, mark())
    const record = await service.mark(ctx, mark({ checkOut: '16:30' }))
    expect(tables.attendance).toHaveLength(1)
    expect(record.result).toMatchObject({ isOpen: false, workedHours: 8.5, issue: null })
  })

  it('an employee of another workspace is «not found», and nothing is written', async () => {
    await expect(service.mark(ctx, mark({ employeeId: 'x9' }))).rejects.toThrow('not found')
    expect(tables.attendance).toEqual([])
  })

  it('a check-out before the check-in is refused — it is a typo, not a night shift', async () => {
    await expect(service.mark(ctx, mark({ checkIn: '16:00', checkOut: '08:00' }))).rejects.toThrow(
      'ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN',
    )
    expect(tables.attendance).toEqual([])
  })

  it('an impossible time and a check-out with no check-in are refused', async () => {
    await expect(service.mark(ctx, mark({ checkIn: '25:99' }))).rejects.toThrow(
      'ATTENDANCE_TIME_INVALID',
    )
    await expect(service.mark(ctx, mark({ checkIn: null, checkOut: '16:00' }))).rejects.toThrow(
      'ATTENDANCE_CHECK_OUT_WITHOUT_CHECK_IN',
    )
  })

  it('a leave day stores no times, whatever was sent', async () => {
    await service.mark(ctx, mark({ status: 'leave', checkIn: '08:00', checkOut: '16:00' }))
    expect(tables.attendance![0]).toMatchObject({
      status: 'leave',
      check_in: null,
      check_out: null,
    })
  })

  it('losing the race to record the day becomes a correction of the winner’s row', async () => {
    state.insertError = { code: '23505', message: 'attendance_one_per_employee_day' }
    state.onInsertRace = () => {
      tables.attendance!.push({
        id: 'att-won',
        workspace_id: WS,
        employee_id: 'e1',
        date: DAY,
        status: 'absent',
      })
    }
    const record = await service.mark(ctx, mark({ checkOut: '12:00' }))
    expect(tables.attendance).toHaveLength(1)
    expect(record).toMatchObject({ id: 'att-won', status: 'present', checkOut: '12:00' })
  })

  it('any other insert failure is an error', async () => {
    state.insertError = { code: '57014', message: 'timeout' }
    await expect(service.mark(ctx, mark())).rejects.toThrow('Failed to record attendance')
  })
})

describe('the sheet', () => {
  it('lists THIS workspace’s employees; «not recorded» is null and is not counted as absent', async () => {
    await service.mark(ctx, mark({ checkOut: '16:00' }))
    tables.attendance!.push({
      id: 'zz',
      workspace_id: OTHER,
      employee_id: 'x9',
      date: DAY,
      status: 'absent',
    })

    const sheet = await service.sheet(ctx, DAY)
    expect(sheet.rows.map((row) => row.employeeId)).toEqual(['e1', 'e2'])
    expect(sheet.rows[0]).toMatchObject({
      name: 'احمد کریمی',
      record: { result: { workedHours: 8 } },
    })
    expect(sheet.rows[1]).toMatchObject({ name: 'سارا', record: null })
    expect(sheet.summary).toEqual({
      employees: 2,
      recorded: 1,
      present: 1,
      absent: 0,
      leave: 0,
      open: 0,
    })
  })

  it('another day’s record does not appear on this day', async () => {
    await service.mark(ctx, mark({ date: '2026-10-03' }))
    const sheet = await service.sheet(ctx, DAY)
    expect(sheet.summary.recorded).toBe(0)
  })

  it('times come back as HH:MM whatever the database’s time format', async () => {
    tables.attendance!.push({
      id: 'a1',
      workspace_id: WS,
      employee_id: 'e1',
      date: DAY,
      status: 'present',
      check_in: '08:05:00',
      check_out: '12:35:00',
      notes: null,
    })
    const sheet = await service.sheet(ctx, DAY)
    expect(sheet.rows[0]!.record).toMatchObject({
      checkIn: '08:05',
      checkOut: '12:35',
      result: { workedHours: 4.5 },
    })
  })
})
