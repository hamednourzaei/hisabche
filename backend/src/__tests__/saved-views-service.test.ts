// ============================================
// Capabilities #87 / #89 — saved views: who sees a view, and who may change it.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
let rows: Row[] = []
let sequence = 0

function from() {
  const filters: Array<(row: Row) => boolean> = []
  let action: 'select' | 'insert' | 'update' | 'delete' = 'select'
  let payload: Row | null = null

  const run = () => {
    if (action === 'insert') {
      const row: Row = { id: `v-${(sequence += 1)}`, created_at: `t${sequence}`, ...payload }
      const clash = rows.some(
        (r) =>
          r.workspace_id === row.workspace_id &&
          r.table_id === row.table_id &&
          r.created_by === row.created_by &&
          String(r.name).trim().toLowerCase() === String(row.name).trim().toLowerCase(),
      )
      if (clash) return { data: null, error: { code: '23505' } }
      rows.push(row)
      return { data: [row], error: null }
    }
    const hit = rows.filter((row) => filters.every((f) => f(row)))
    if (action === 'update') for (const row of hit) Object.assign(row, payload)
    if (action === 'delete') rows = rows.filter((row) => !hit.includes(row))
    return { data: hit, error: null }
  }

  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: (value: Row) => ((action = 'insert'), (payload = value), builder),
    update: (value: Row) => ((action = 'update'), (payload = value), builder),
    delete: () => ((action = 'delete'), builder),
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    // `created_by.eq.<id>,shared.eq.true`
    or: (expression: string) => {
      const owner = /created_by\.eq\.([^,]+)/.exec(expression)?.[1]
      filters.push((row) => row.created_by === owner || row.shared === true)
      return builder
    },
    order: () => builder,
    maybeSingle: async () => {
      const result = run()
      return { data: (result.data as Row[] | null)?.[0] ?? null, error: result.error }
    },
    single: async () => {
      const result = run()
      return { data: (result.data as Row[] | null)?.[0] ?? null, error: result.error }
    },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  }
  return builder
}

vi.mock('../db', () => ({ supabase: { from: () => from() } }))

import { SavedViewsService, savedViewStateSchema } from '../services/saved-views.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ali = { workspaceId: WS, userId: 'ali', role: 'seller' } as never
const sara = { workspaceId: WS, userId: 'sara', role: 'manager' } as never
const stranger = { workspaceId: OTHER, userId: 'ali', role: 'owner' } as never

const look = savedViewStateSchema.parse({ hiddenIds: ['notes'], sortId: 'total', search: 'ahmad' })
let service: SavedViewsService

beforeEach(() => {
  rows = []
  service = new SavedViewsService()
})

describe('saved views', () => {
  it('a view keeps the look it was saved with', async () => {
    const saved = await service.create(ali, {
      tableId: 'invoices',
      name: 'بدهکاران',
      state: look,
      shared: false,
    })
    expect(saved).toMatchObject({ name: 'بدهکاران', mine: true, shared: false })
    expect(saved.state).toEqual({
      hiddenIds: ['notes'],
      sortId: 'total',
      sortDirection: 'desc',
      search: 'ahmad',
    })
  })

  it('a private view is seen by its owner only', async () => {
    await service.create(ali, { tableId: 'invoices', name: 'mine', state: look, shared: false })
    expect(await service.list(ali, 'invoices')).toHaveLength(1)
    expect(await service.list(sara, 'invoices')).toEqual([])
  })

  it('a shared view is seen by the workspace, marked as not theirs, after their own', async () => {
    await service.create(ali, {
      tableId: 'invoices',
      name: 'shared by ali',
      state: look,
      shared: true,
    })
    await service.create(sara, {
      tableId: 'invoices',
      name: 'sara own',
      state: look,
      shared: false,
    })
    const seen = await service.list(sara, 'invoices')
    expect(seen.map((view) => [view.name, view.mine])).toEqual([
      ['sara own', true],
      ['shared by ali', false],
    ])
  })

  it('another workspace sees nothing — even a shared view, even with the same user id', async () => {
    await service.create(ali, { tableId: 'invoices', name: 'shared', state: look, shared: true })
    expect(await service.list(stranger, 'invoices')).toEqual([])
  })

  it('views of one table do not appear on another', async () => {
    await service.create(ali, { tableId: 'invoices', name: 'a', state: look, shared: false })
    expect(await service.list(ali, 'customers')).toEqual([])
  })

  it('only the owner renames, re-shares or removes — for anyone else it is «not found»', async () => {
    const view = await service.create(ali, {
      tableId: 'invoices',
      name: 'a',
      state: look,
      shared: true,
    })
    await expect(service.update(sara, view.id, { name: 'hijacked' })).rejects.toThrow('not found')
    await expect(service.remove(sara, view.id)).rejects.toThrow('not found')
    await expect(service.remove(stranger, view.id)).rejects.toThrow('not found')
    expect(rows[0]).toMatchObject({ name: 'a' })

    expect((await service.update(ali, view.id, { shared: false })).shared).toBe(false)
    await service.remove(ali, view.id)
    expect(rows).toEqual([])
  })

  it('a second view of the same name by the same person is refused, with a reason', async () => {
    await service.create(ali, { tableId: 'invoices', name: 'A', state: look, shared: false })
    await expect(
      service.create(ali, { tableId: 'invoices', name: ' a ', state: look, shared: false }),
    ).rejects.toThrow('SAVED_VIEW_NAME_TAKEN')
  })

  it('a stored look that no longer fits the contract becomes the default, not an error', async () => {
    rows.push({
      id: 'old',
      workspace_id: WS,
      table_id: 'invoices',
      name: 'old',
      state: { hiddenIds: 'not-an-array', evil: true },
      shared: false,
      created_by: 'ali',
      created_at: 't0',
    })
    const [view] = await service.list(ali, 'invoices')
    expect(view!.state).toEqual({ hiddenIds: [], sortId: null, sortDirection: 'desc', search: '' })
  })

  it('the look is a closed shape: an unknown field is refused at the door', () => {
    expect(savedViewStateSchema.safeParse({ hiddenIds: [], selectedIds: ['x'] }).success).toBe(
      false,
    )
    expect(savedViewStateSchema.safeParse({ sortDirection: 'sideways' }).success).toBe(false)
  })
})
