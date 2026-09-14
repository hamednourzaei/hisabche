// Desktop pull: change-log delta for products/customers, complete snapshot on
// first run, cursor advanced only after a page is committed locally.

const tables: Record<string, Array<Record<string, unknown>>> = {}
const upsertMany = jest.fn(async (table: string, rows: Array<Record<string, unknown>>) => {
  const store = (tables[table] ??= [])
  for (const row of rows) {
    const index = store.findIndex((existing) => existing.id === row.id)
    if (index === -1) store.push(row)
    else store[index] = row
  }
  return rows.length
})
const query = jest.fn(async ({ table, where }: { table: string; where?: { id?: string } }) =>
  (tables[table] ?? []).filter((row) => !where?.id || row.id === where.id),
)

jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({ db: { upsertMany, query } }),
}))

const get = jest.fn()
jest.mock('@/shared/lib/api', () => ({ apiClient: { get: (...args: unknown[]) => get(...args) } }))
jest.mock('@hisabche/api', () => ({
  invoiceKeys: {},
  customerKeys: {},
  productKeys: {},
  dashboardKeys: {},
}))
jest.mock('@hisabche/store', () => ({
  useWorkspaceStore: { getState: () => ({ workspaceId: 'ws-1' }) },
}))

import { applyChanges, pullAll, readCursor } from '../sync-engine'

const product = (id: string, name = id) => ({
  id,
  name,
  sellPrice: 1,
  updatedAt: '2026-09-01T00:00:00Z',
})

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  upsertMany.mockClear()
  get.mockReset()
  localStorage.clear()
})

describe('first pull: complete snapshot, then the log starts from the head', () => {
  it('walks the list cursor past 100 rows (the old pull stopped at the first page)', async () => {
    const all = Array.from({ length: 230 }, (_, i) => product(`p${String(i).padStart(3, '0')}`))
    get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      const params = config?.params ?? {}
      if (url === '/sync/cursor') return { data: { cursor: 42 } }
      if (url === '/products') {
        const start = params.cursor ? all.findIndex((p) => p.id === params.cursor) + 1 : 0
        const page = all.slice(start, start + 100)
        const hasMore = start + 100 < all.length
        return {
          data: { products: page, hasMore, nextCursor: hasMore ? page[page.length - 1]!.id : null },
        }
      }
      if (url === '/customers') return { data: { customers: [], hasMore: false, nextCursor: null } }
      if (url === '/invoices') return { data: { invoices: [] } }
      throw new Error(`unexpected ${url}`)
    })

    await pullAll()

    expect(tables.product).toHaveLength(230)
    expect(readCursor('ws-1')).toBe(42)
    // Snapshot sorted by id so the id cursor is the sort key.
    const productCalls = get.mock.calls.filter(([url]) => url === '/products')
    expect(productCalls[0]![1].params).toMatchObject({
      sortBy: 'id',
      sortDirection: 'asc',
      limit: 100,
    })
    expect(productCalls).toHaveLength(3)
  })
})

describe('later pulls: only the change log travels', () => {
  it('applies creates/updates, retires deletes, and advances the cursor per page', async () => {
    localStorage.setItem('hisabche.desktop.syncCursor:ws-1', '10')
    tables.customer = [{ id: 'c-old', full_name: 'قدیمی', is_active: 1 }]

    get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/sync/pull' && config?.params?.cursor === 10) {
        return {
          data: {
            changes: [
              {
                entityType: 'product',
                entityId: 'p1',
                operation: 'create',
                data: { id: 'p1', name: 'نو', sell_price: 5 },
              },
              { entityType: 'customer', entityId: 'c-old', operation: 'delete', data: null },
              { entityType: 'invoice', entityId: 'i1', operation: 'create', data: { id: 'i1' } },
            ],
            nextCursor: 13,
            hasMore: true,
            mustRehydrate: false,
          },
        }
      }
      if (url === '/sync/pull' && config?.params?.cursor === 13) {
        return {
          data: {
            changes: [
              {
                entityType: 'product',
                entityId: 'p1',
                operation: 'update',
                data: { id: 'p1', name: 'ویرایش', sell_price: 6 },
              },
            ],
            nextCursor: 14,
            hasMore: false,
            mustRehydrate: false,
          },
        }
      }
      if (url === '/invoices') return { data: { invoices: [] } }
      throw new Error(`unexpected ${url} ${JSON.stringify(config?.params)}`)
    })

    await pullAll()

    expect(tables.product).toEqual([
      expect.objectContaining({ id: 'p1', name: 'ویرایش', sell_price: 6, is_active: 1 }),
    ])
    expect(tables.customer).toEqual([expect.objectContaining({ id: 'c-old', is_active: 0 })])
    expect(readCursor('ws-1')).toBe(14)
    // No full list request on a delta pull.
    expect(get.mock.calls.some(([url]) => url === '/products' || url === '/customers')).toBe(false)
  })

  it('a failed page leaves the cursor where the last COMMITTED page put it', async () => {
    localStorage.setItem('hisabche.desktop.syncCursor:ws-1', '10')
    upsertMany.mockImplementationOnce(async () => {
      throw new Error('disk full')
    })
    get.mockImplementation(async (url: string) => {
      if (url === '/sync/pull') {
        return {
          data: {
            changes: [
              {
                entityType: 'product',
                entityId: 'p9',
                operation: 'create',
                data: { id: 'p9', name: 'x' },
              },
            ],
            nextCursor: 20,
            hasMore: false,
            mustRehydrate: false,
          },
        }
      }
      return { data: { products: [], customers: [], invoices: [], hasMore: false, cursor: 0 } }
    })

    await pullAll()
    expect(readCursor('ws-1')).toBe(10)
  })

  it('mustRehydrate switches to a snapshot', async () => {
    localStorage.setItem('hisabche.desktop.syncCursor:ws-1', '1')
    get.mockImplementation(async (url: string) => {
      if (url === '/sync/pull')
        return { data: { changes: [], nextCursor: 1, hasMore: false, mustRehydrate: true } }
      if (url === '/sync/cursor') return { data: { cursor: 99 } }
      if (url === '/products')
        return { data: { products: [product('p1')], hasMore: false, nextCursor: null } }
      return { data: { customers: [], invoices: [], hasMore: false } }
    })

    await pullAll()
    expect(tables.product).toHaveLength(1)
    expect(readCursor('ws-1')).toBe(99)
  })
})

describe('applyChanges', () => {
  it('ignores entities the desktop does not mirror through the log', async () => {
    const written = await applyChanges({
      changes: [
        { entityType: 'time_entry', entityId: 't', operation: 'create', data: { id: 't' } },
      ],
      nextCursor: 1,
      hasMore: false,
      mustRehydrate: false,
    })
    expect(written).toBe(0)
  })
})
