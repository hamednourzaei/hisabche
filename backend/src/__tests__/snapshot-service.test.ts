// ============================================
// snapshot.service (#42–#46) — a marker and what was added since.
//
// What can go wrong: a table that could not be counted stored as 0, a
// difference invented from an unknown side, another workspace's rows counted,
// an estimate used for a figure somebody compares, «restorable» implied.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const state: { failCount: Set<string>; snapshotsError: { code: string; message: string } | null } =
  {
    failCount: new Set(),
    snapshotsError: null,
  }
let nextId = 1

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let counting = false
  let inserting: Row | null = null
  const run = () => {
    if (table === 'data_snapshots' && state.snapshotsError)
      return { data: null, error: state.snapshotsError, count: null }
    if (inserting) {
      const row = { id: `snap-${nextId++}`, taken_at: '2026-10-04T10:00:00.000Z', ...inserting }
      ;(tables[table] ??= []).push(row)
      return { data: [row], error: null, count: null }
    }
    const hit = (tables[table] ?? []).filter((row) => filters.every((f) => f(row)))
    if (counting) {
      return state.failCount.has(table)
        ? { data: null, error: { code: '42703', message: 'column does not exist' }, count: null }
        : { data: null, error: null, count: hit.length }
    }
    return { data: hit, error: null, count: null }
  }
  const builder: Record<string, unknown> = {
    select: (_columns: string, options?: { count?: string; head?: boolean }) => {
      if (options?.head) counting = true
      return builder
    },
    order: () => builder,
    limit: () => builder,
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    insert: (row: Row) => ((inserting = row), builder),
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

import { SnapshotService } from '../services/portability/snapshot.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ctx = { workspaceId: WS, userId: 'u1', role: 'owner' } as never
const rows = (table: string, mine: number, theirs = 0) => {
  tables[table] = [
    ...Array.from({ length: mine }, (_, index) => ({ id: `${table}-${index}`, workspace_id: WS })),
    ...Array.from({ length: theirs }, (_, index) => ({
      id: `${table}-x${index}`,
      workspace_id: OTHER,
    })),
  ]
}

let service: SnapshotService
beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  state.failCount = new Set()
  state.snapshotsError = null
  nextId = 1
  tables.data_snapshots = []
  rows('invoices', 12, 500)
  rows('payments', 7)
  rows('customers', 3)
  service = new SnapshotService()
})

describe('taking a marker', () => {
  it('counts THIS workspace’s rows, and says it cannot be restored from', async () => {
    const snapshot = await service.take(ctx, ' پایان سال ')
    expect(snapshot.label).toBe('پایان سال')
    expect(snapshot.restorable).toBe(false)
    expect(snapshot.limitations.length).toBeGreaterThan(0)
    expect(snapshot.tables.find((row) => row.table === 'invoices')?.count).toBe(12)
    expect(snapshot.tables.find((row) => row.table === 'products')?.count).toBe(0)
    expect(tables.data_snapshots![0]).toMatchObject({
      workspace_id: WS,
      taken_by: 'u1',
      kind: 'full',
    })
  })

  it('a table that could not be counted is ABSENT from the marker — not stored as zero', async () => {
    state.failCount.add('invoice_items')
    const snapshot = await service.take(ctx, 'x')
    expect(snapshot.tables.find((row) => row.table === 'invoice_items')?.count).toBeNull()
    expect(tables.data_snapshots![0]!.counts).not.toHaveProperty('invoice_items')
  })

  it('a missing table is «not set up»', async () => {
    state.snapshotsError = { code: 'PGRST205', message: 'not in schema cache' }
    await expect(service.list(ctx)).rejects.toThrow('SNAPSHOTS_MIGRATION_PENDING')
  })
})

describe('comparing a marker with now', () => {
  it('says what was added since', async () => {
    const snapshot = await service.take(ctx, 'x')
    rows('invoices', 15, 900)
    rows('customers', 3)
    const comparison = await service.compare(ctx, snapshot.id)
    expect(comparison.readable).toBe(true)
    expect(comparison.changes.find((row) => row.table === 'invoices')).toEqual({
      table: 'invoices',
      then: 12,
      now: 15,
      added: 3,
    })
    expect(comparison.changes.find((row) => row.table === 'customers')?.added).toBe(0)
  })

  it('an unknown side gives NO difference — it is never guessed', async () => {
    state.failCount.add('invoice_items')
    const snapshot = await service.take(ctx, 'x')
    state.failCount = new Set(['payments'])
    const comparison = await service.compare(ctx, snapshot.id)
    expect(comparison.changes.find((row) => row.table === 'invoice_items')).toMatchObject({
      then: null,
      added: null,
    })
    expect(comparison.changes.find((row) => row.table === 'payments')).toMatchObject({
      now: null,
      added: null,
    })
  })

  it('a marker taken under a NEWER shape than this reader knows is not compared', async () => {
    tables.data_snapshots!.push({
      id: 'future',
      workspace_id: WS,
      label: 'x',
      kind: 'full',
      taken_at: '2026-10-04T00:00:00Z',
      source_schema_version: '9.0.0',
      counts: { invoices: 1 },
    })
    const comparison = await service.compare(ctx, 'future')
    expect(comparison.readable).toBe(false)
    expect(comparison.changes.every((row) => row.added === null)).toBe(true)
  })

  it('another workspace’s marker is «not found»', async () => {
    tables.data_snapshots!.push({
      id: 'theirs',
      workspace_id: OTHER,
      label: 'x',
      kind: 'full',
      taken_at: '2026-10-04T00:00:00Z',
      source_schema_version: '1.0.0',
      counts: {},
    })
    await expect(service.compare(ctx, 'theirs')).rejects.toThrow('not found')
  })
})

describe('the counts are exact', () => {
  it('the service asks for an exact count, never an estimate', () => {
    const source = readFileSync(
      join(__dirname, '..', 'services', 'portability', 'snapshot.service.ts'),
      'utf8',
    )
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n')
    expect(source).toContain("count: 'exact', head: true")
    expect(source).not.toContain("'estimated'")
    expect(source).not.toContain("'planned'")
  })
})
