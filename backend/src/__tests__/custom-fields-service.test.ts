// ============================================
// custom-fields.service (#141–#143).
//
// What can go wrong: a value stored under a key no field explains, a wrong type
// accepted, a formula shown as 0 when it cannot be computed, a formula written
// to, another workspace's record read by id, a retired field's values lost.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const state: { error: { code: string; message: string } | null } = { error: null }
let nextId = 1

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let mode: 'select' | 'insert' | 'update' | 'upsert' = 'select'
  let payload: Row = {}
  const run = () => {
    if (state.error && table.startsWith('custom_field')) return { data: null, error: state.error }
    if (mode === 'insert') {
      const rows = (tables[table] ??= [])
      if (
        table === 'custom_field_definitions' &&
        rows.some(
          (row) =>
            row.workspace_id === payload.workspace_id &&
            row.entity_type === payload.entity_type &&
            row.key === payload.key,
        )
      ) {
        return { data: null, error: { code: '23505', message: 'custom_field_definitions_key' } }
      }
      const row = {
        id: `d${nextId++}`,
        is_active: true,
        created_at: `2026-10-04T00:00:${String(nextId).padStart(2, '0')}Z`,
        ...payload,
      }
      rows.push(row)
      return { data: [row], error: null }
    }
    if (mode === 'upsert') {
      const rows = (tables[table] ??= [])
      const existing = rows.find(
        (row) =>
          row.workspace_id === payload.workspace_id &&
          row.entity_type === payload.entity_type &&
          row.entity_id === payload.entity_id,
      )
      if (existing) Object.assign(existing, payload)
      else rows.push({ ...payload })
      return { data: null, error: null }
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
    upsert: (row: Row) => ((mode = 'upsert'), (payload = row), builder),
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

import { CustomFieldsService } from '../services/extensions/custom-fields.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ctx = { workspaceId: WS, userId: 'u1', role: 'manager' } as never

let service: CustomFieldsService
const field = (overrides: Record<string, unknown> = {}) =>
  service.define(ctx, {
    entity: 'customer',
    key: 'region',
    label: 'منطقه',
    type: 'text',
    choices: null,
    formula: null,
    required: false,
    ...overrides,
  } as never)

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  state.error = null
  nextId = 1
  tables.customers = [
    { id: 'c1', workspace_id: WS },
    { id: 'c-theirs', workspace_id: OTHER },
  ]
  tables.custom_field_definitions = []
  tables.custom_field_values = []
  service = new CustomFieldsService()
})

describe('defining fields', () => {
  it('a formula is checked against the number fields that exist when it is made', async () => {
    await field({ key: 'visits', type: 'number' })
    await field({ key: 'orders', type: 'number' })
    await expect(
      field({ key: 'ratio', type: 'formula', formula: 'orders / visits' }),
    ).resolves.toMatchObject({
      type: 'formula',
      required: false,
    })
    await expect(
      field({ key: 'bad', type: 'formula', formula: 'orders / nothing' }),
    ).rejects.toThrow('CUSTOM_FIELD_FORMULA_UNKNOWN_FIELD')
    await expect(field({ key: 'bad2', type: 'formula', formula: '(orders' })).rejects.toThrow(
      'CUSTOM_FIELD_FORMULA_UNBALANCED',
    )
    // A text field is not something a formula can add up.
    await field({ key: 'note', type: 'text' })
    await expect(field({ key: 'bad3', type: 'formula', formula: 'note + 1' })).rejects.toThrow(
      'CUSTOM_FIELD_FORMULA_UNKNOWN_FIELD',
    )
  })

  it('a choice needs choices, cleaned of blanks and repeats', async () => {
    await expect(field({ key: 'tier', type: 'choice', choices: [] })).rejects.toThrow(
      'CUSTOM_FIELD_CHOICES_REQUIRED',
    )
    const saved = await field({
      key: 'tier',
      type: 'choice',
      choices: [' طلایی ', 'نقره‌ای', 'طلایی'],
    })
    expect(saved.choices).toEqual(['طلایی', 'نقره‌ای'])
  })

  it('a key already used — even by a retired field — is refused by name', async () => {
    const first = await field()
    await service.setActive(ctx, first.id, false)
    await expect(field({ label: 'معنای دیگر' })).rejects.toThrow('CUSTOM_FIELD_KEY_TAKEN')
  })

  it('a missing table is «not set up», not «no fields»', async () => {
    state.error = { code: '42P01', message: 'relation does not exist' }
    await expect(service.definitions(ctx, 'customer')).rejects.toThrow(
      'CUSTOM_FIELDS_MIGRATION_PENDING',
    )
  })
})

describe('values of one record', () => {
  beforeEach(async () => {
    await field({ key: 'visits', type: 'number' })
    await field({ key: 'orders', type: 'number' })
    await field({ key: 'tier', type: 'choice', choices: ['طلایی', 'نقره‌ای'] })
    await field({ key: 'since', type: 'date' })
    await field({ key: 'vip', type: 'boolean' })
    await field({ key: 'ratio', type: 'formula', formula: 'orders / visits' })
  })

  it('stores typed values for THIS workspace and computes the formula', async () => {
    const record = await service.write(ctx, 'customer', 'c1', {
      visits: '8',
      orders: 2,
      tier: 'طلایی',
      since: '2026-01-15',
      vip: true,
    })
    expect(record.values).toEqual({
      visits: 8,
      orders: 2,
      tier: 'طلایی',
      since: '2026-01-15',
      vip: true,
    })
    expect(record.computed.ratio).toEqual({ ok: true, value: 0.25 })
    expect(tables.custom_field_values![0]).toMatchObject({
      workspace_id: WS,
      entity_id: 'c1',
      updated_by: 'u1',
    })
  })

  it('a formula that cannot be computed says WHY — it is never 0', async () => {
    expect((await service.read(ctx, 'customer', 'c1')).computed.ratio).toEqual({
      ok: false,
      code: 'MISSING_VALUE',
    })
    const zero = await service.write(ctx, 'customer', 'c1', { visits: 0, orders: 3 })
    expect(zero.computed.ratio).toEqual({ ok: false, code: 'DIVIDE_BY_ZERO' })
  })

  it('a wrong type, a choice not on the list and a malformed date are refused, and nothing is stored', async () => {
    await expect(service.write(ctx, 'customer', 'c1', { visits: 'many' })).rejects.toThrow(
      'CUSTOM_FIELD_INVALID:visits',
    )
    await expect(service.write(ctx, 'customer', 'c1', { tier: 'برنزی' })).rejects.toThrow(
      'CUSTOM_FIELD_INVALID:tier',
    )
    await expect(service.write(ctx, 'customer', 'c1', { since: '15/01/2026' })).rejects.toThrow(
      'CUSTOM_FIELD_INVALID:since',
    )
    await expect(service.write(ctx, 'customer', 'c1', { vip: 'yes' })).rejects.toThrow(
      'CUSTOM_FIELD_INVALID:vip',
    )
    expect(tables.custom_field_values).toEqual([])
  })

  it('a key no field explains, and a formula, cannot be written', async () => {
    await expect(service.write(ctx, 'customer', 'c1', { secret: 'x' })).rejects.toThrow(
      'CUSTOM_FIELD_UNKNOWN',
    )
    await expect(service.write(ctx, 'customer', 'c1', { ratio: 5 })).rejects.toThrow(
      'CUSTOM_FIELD_FORMULA_NOT_WRITABLE',
    )
  })

  it('an empty value is null — not an empty string and not zero', async () => {
    const record = await service.write(ctx, 'customer', 'c1', { visits: '', tier: null })
    expect(record.values.visits).toBeNull()
    expect(record.values.tier).toBeNull()
  })

  it('a required field must have a value', async () => {
    await field({ key: 'code', type: 'text', required: true })
    await expect(service.write(ctx, 'customer', 'c1', { visits: 1 })).rejects.toThrow(
      'CUSTOM_FIELD_REQUIRED:code',
    )
  })

  it('retiring a field hides it and KEEPS what was entered under it', async () => {
    await service.write(ctx, 'customer', 'c1', { visits: 4, orders: 2 })
    const visits = (await service.definitions(ctx, 'customer')).find((f) => f.key === 'visits')!
    await service.setActive(ctx, visits.id, false)

    const record = await service.read(ctx, 'customer', 'c1')
    expect(Object.keys(record.values)).not.toContain('visits')
    // The formula named the retired field: it now says so instead of computing.
    expect(record.computed.ratio).toEqual({ ok: false, code: 'UNKNOWN_FIELD' })
    await service.write(ctx, 'customer', 'c1', { orders: 9 })
    expect((tables.custom_field_values![0]!.field_values as Row).visits).toBe(4)
  })

  it('another workspace’s customer can be neither read nor written', async () => {
    await expect(service.read(ctx, 'customer', 'c-theirs')).rejects.toThrow('not found')
    await expect(service.write(ctx, 'customer', 'c-theirs', { visits: 1 })).rejects.toThrow(
      'not found',
    )
    expect(tables.custom_field_values).toEqual([])
  })
})
