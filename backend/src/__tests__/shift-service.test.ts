// ============================================
// shift.service (#101) — and the request pattern that guards it.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const state: { error: { code: string; message: string } | null } = { error: null }
let nextId = 1

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let mode: 'select' | 'insert' | 'update' = 'select'
  let payload: Row = {}
  const run = () => {
    if (state.error) return { data: null, error: state.error }
    if (mode === 'insert') {
      const row = { id: `s${nextId++}`, is_active: true, ...payload }
      ;(tables[table] ??= []).push(row)
      return { data: [row], error: null }
    }
    const hit = (tables[table] ?? []).filter((row) => filters.every((f) => f(row)))
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

import { ShiftService } from '../services/payroll/shift.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ctx = { workspaceId: WS, userId: 'u1', role: 'manager' } as never
const morning = { name: ' صبح ', startsAt: '08:00', endsAt: '16:00', breakMinutes: 30 }

let service: ShiftService
beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  state.error = null
  nextId = 1
  tables.work_shifts = []
  service = new ShiftService()
})

describe('shifts', () => {
  it('saves a shift for THIS workspace and states its payable hours', async () => {
    const shift = await service.create(ctx, morning)
    expect(shift).toMatchObject({
      name: 'صبح',
      startsAt: '08:00',
      endsAt: '16:00',
      payableHours: 7.5,
      isActive: true,
    })
    expect(tables.work_shifts![0]).toMatchObject({ workspace_id: WS, created_by: 'u1' })
  })

  it('a shift across midnight, an impossible time and a break as long as the shift are refused before the database', async () => {
    await expect(
      service.create(ctx, { ...morning, startsAt: '22:00', endsAt: '06:00' }),
    ).rejects.toThrow('SHIFT_INVALID_TIMES')
    await expect(service.create(ctx, { ...morning, startsAt: '25:00' })).rejects.toThrow(
      'SHIFT_INVALID_TIMES',
    )
    await expect(service.create(ctx, { ...morning, breakMinutes: 480 })).rejects.toThrow(
      'SHIFT_BREAK_LONGER_THAN_SHIFT',
    )
    expect(tables.work_shifts).toEqual([])
  })

  it('a name already in use is said as such, not as a server error', async () => {
    state.error = { code: '23505', message: 'work_shifts_active_name' }
    await expect(service.create(ctx, morning)).rejects.toThrow('SHIFT_NAME_TAKEN')
  })

  it('a missing table is «not set up», not «no shifts»', async () => {
    state.error = { code: 'PGRST205', message: 'not in schema cache' }
    await expect(service.list(ctx)).rejects.toThrow('SHIFTS_MIGRATION_PENDING')
  })

  it('retiring keeps the row; another workspace’s shift is «not found»', async () => {
    const shift = await service.create(ctx, morning)
    expect((await service.setActive(ctx, shift.id, false)).isActive).toBe(false)
    expect(tables.work_shifts).toHaveLength(1)
    tables.work_shifts!.push({
      id: 'theirs',
      workspace_id: OTHER,
      name: 'x',
      starts_at: '08:00',
      ends_at: '09:00',
      break_minutes: 0,
      is_active: true,
    })
    await expect(service.setActive(ctx, 'theirs', false)).rejects.toThrow('not found')
  })
})

describe('the request pattern for a clock time', () => {
  // A script once wrote this pattern with its backslashes eaten, leaving
  // `d{1,2}:d{2}` — which matches the letter «d» and refuses every real time.
  // The pattern is taken from the route and exercised.
  const source = readFileSync(join(__dirname, '..', 'routes', 'attendance.routes.ts'), 'utf8')
  const patterns = [...source.matchAll(/regex\((\/.+?\/)\)/g)].map((match) => match[1] as string)

  it('every time pattern in the route accepts 08:05 and 8:05 and refuses «dd:dd»', () => {
    const clocks = patterns
      .map((literal) => new RegExp(literal.slice(1, -1)))
      .filter((pattern) => pattern.test('08:05') || pattern.source.includes(':'))
    expect(clocks.length).toBeGreaterThan(0)
    for (const pattern of clocks) {
      expect(pattern.test('08:05'), pattern.source).toBe(true)
      expect(pattern.test('8:05'), pattern.source).toBe(true)
      expect(pattern.test('dd:dd'), pattern.source).toBe(false)
    }
  })
})
