// ============================================
// notes.service — who may read and leave a note on what.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const state: { notesError: { code: string; message: string } | null } = { notesError: null }
let nextId = 1

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let range: [number, number] | null = null
  let inserting: Row | null = null
  const run = () => {
    if (table === 'entity_notes' && state.notesError) return { data: null, error: state.notesError }
    if (inserting) {
      const row = { id: `n${nextId++}`, created_at: `2026-10-04T10:00:0${nextId}Z`, ...inserting }
      ;(tables[table] ??= []).push(row)
      return { data: [row], error: null }
    }
    const hit = (tables[table] ?? []).filter((row) => filters.every((f) => f(row)))
    return { data: range ? hit.slice(range[0], range[1] + 1) : hit, error: null }
  }
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    range: (start: number, end: number) => ((range = [start, end]), builder),
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

import { NotesService } from '../services/notes.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ctx = { workspaceId: WS, userId: 'u1', role: 'seller' } as never

let service: NotesService
beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  state.notesError = null
  nextId = 1
  tables.customers = [
    { id: 'c1', workspace_id: WS },
    { id: 'c-theirs', workspace_id: OTHER },
  ]
  tables.entity_notes = [
    {
      id: 'old',
      workspace_id: OTHER,
      entity_type: 'customer',
      entity_id: 'c-theirs',
      body: 'secret',
      created_by: 'x',
      created_at: '2026-01-01T00:00:00Z',
    },
  ]
  service = new NotesService()
})

describe('notes', () => {
  it('a note is stored for THIS workspace, trimmed, by the person who wrote it', async () => {
    const note = await service.add(ctx, {
      entityType: 'customer',
      entityId: 'c1',
      body: '  صبح‌ها زنگ بزنید  ',
    })
    expect(note).toMatchObject({ body: 'صبح‌ها زنگ بزنید', mine: true })
    expect(tables.entity_notes!.at(-1)).toMatchObject({
      workspace_id: WS,
      created_by: 'u1',
      entity_id: 'c1',
    })
  })

  it('another workspace’s customer can be neither read nor written — and nothing is stored', async () => {
    await expect(service.list(ctx, 'customer', 'c-theirs')).rejects.toThrow('not found')
    await expect(
      service.add(ctx, { entityType: 'customer', entityId: 'c-theirs', body: 'x' }),
    ).rejects.toThrow('not found')
    expect(tables.entity_notes).toHaveLength(1)
  })

  it('an empty note is refused before the database is asked', async () => {
    await expect(
      service.add(ctx, { entityType: 'customer', entityId: 'c1', body: '   ' }),
    ).rejects.toThrow('NOTE_EMPTY_BODY')
    expect(tables.entity_notes).toHaveLength(1)
  })

  it('the list holds this entity’s notes only, and says which are the reader’s own', async () => {
    await service.add(ctx, { entityType: 'customer', entityId: 'c1', body: 'یک' })
    tables.entity_notes!.push({
      id: 'by-colleague',
      workspace_id: WS,
      entity_type: 'customer',
      entity_id: 'c1',
      body: 'دو',
      created_by: 'u2',
      created_at: '2026-10-04T11:00:00Z',
    })
    const notes = await service.list(ctx, 'customer', 'c1')
    expect(notes.map((note) => [note.body, note.mine])).toEqual([
      ['یک', true],
      ['دو', false],
    ])
    expect(JSON.stringify(notes)).not.toContain('secret')
    expect(JSON.stringify(notes)).not.toContain('u2')
  })

  it('a missing table is «not set up», not «no notes»', async () => {
    state.notesError = { code: '42P01', message: 'relation does not exist' }
    await expect(service.list(ctx, 'customer', 'c1')).rejects.toThrow('NOTES_MIGRATION_PENDING')
  })
})
