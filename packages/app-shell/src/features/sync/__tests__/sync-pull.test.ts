// Desktop pull (request #153): a full rebuild walks /sync/snapshot (versions
// included, every invoice), after which only the change log travels — in
// Hisabche Sync Binary when the server answers with it, JSON otherwise. The
// cursor advances only after a page is committed locally, and a failure is
// never mistaken for «nothing there».
import { encodePullPage, encodeSnapshotPage, HSB_CONTENT_TYPE } from '@hisabche/sync/wire'

const tables: Record<string, Array<Record<string, unknown>>> = {}
const upsertMany = jest.fn(async (table: string, rows: Array<Record<string, unknown>>) => {
  const store = (tables[table] ??= [])
  for (const row of rows) {
    const index = store.findIndex((existing) => existing.id === row.id)
    // ON CONFLICT DO UPDATE of the provided columns only — like the real SQLite.
    if (index === -1) store.push(row)
    else store[index] = { ...store[index], ...row }
  }
  return rows.length
})
const removeMany = jest.fn(async (table: string, ids: string[]) => {
  const store = tables[table] ?? []
  const keep = store.filter((row) => !ids.includes(String(row.id)) || row.dirty === 1)
  const removed = store.length - keep.length
  tables[table] = keep
  return removed
})
const query = jest.fn(async ({ table, where }: { table: string; where?: { id?: string } }) =>
  (tables[table] ?? []).filter((row) => !where?.id || row.id === where.id),
)

jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({ db: { upsertMany, removeMany, query } }),
}))

const get = jest.fn()
jest.mock('@/shared/lib/api', () => ({
  API_BASE_URL: 'https://api.test/api',
  apiClient: { get: (...args: unknown[]) => get(...args) },
}))
jest.mock('@hisabche/api', () => ({
  invoiceKeys: {},
  customerKeys: {},
  productKeys: {},
  dashboardKeys: {},
  getToken: () => 'token',
}))
jest.mock('@hisabche/store', () => ({
  useWorkspaceStore: { getState: () => ({ workspaceId: 'ws-1' }) },
}))

import { applyChanges, pullAll, readCursor } from '../sync-engine'

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/** What axios hands back for responseType 'arraybuffer'. */
const asJson = (body: unknown) => ({
  data: new TextEncoder().encode(JSON.stringify(body)).buffer,
  headers: { 'content-type': 'application/json; charset=utf-8' },
})
const asHsb = (bytes: Uint8Array) => ({
  data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  headers: { 'content-type': HSB_CONTENT_TYPE },
})

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  upsertMany.mockClear()
  removeMany.mockClear()
  get.mockReset()
  localStorage.clear()
})

describe('first pull: complete snapshot through /sync/snapshot, then the log from the head', () => {
  it('walks every page of every entity, carries versions, names invoices from local customers', async () => {
    const products = Array.from({ length: 1200 }, (_, i) => ({
      id: u(i + 1),
      name: `p${i}`,
      version: 3,
      sell_price: 100,
    }))
    get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      const params = config?.params ?? {}
      if (url === '/sync/cursor') return { data: { cursor: 42 } }
      if (url === '/sync/snapshot' && params.entity === 'product') {
        const start = params.after ? products.findIndex((p) => p.id === params.after) + 1 : 0
        const rows = products.slice(start, start + 500)
        const hasMore = start + 500 < products.length
        // Binary pages, as the server sends when asked.
        return asHsb(
          encodeSnapshotPage({
            rows,
            hasMore,
            nextAfter: hasMore ? rows[rows.length - 1]!.id : null,
          }),
        )
      }
      if (url === '/sync/snapshot' && params.entity === 'customer') {
        return asJson({
          rows: [{ id: u(9001), full_name: 'احمد', version: 7 }],
          hasMore: false,
          nextAfter: null,
        })
      }
      if (url === '/sync/snapshot' && params.entity === 'invoice') {
        return asJson({
          rows: [{ id: u(5001), customer_id: u(9001), total: 5000, version: 2 }],
          hasMore: false,
          nextAfter: null,
        })
      }
      throw new Error(`unexpected ${url} ${JSON.stringify(params)}`)
    })

    await pullAll()

    expect(tables.product).toHaveLength(1200)
    expect(tables.product![0]).toMatchObject({ version: 3 })
    // The bug this closes: REST lists had no version, so every row sat at 1.
    expect(tables.customer).toEqual([expect.objectContaining({ id: u(9001), version: 7 })])
    expect(tables.invoice).toEqual([
      expect.objectContaining({ id: u(5001), customer_name: 'احمد', version: 2 }),
    ])
    expect(readCursor('ws-1')).toBe(42)
    // Asked for binary on every sync request.
    for (const [, config] of get.mock.calls.filter(([url]) => url === '/sync/snapshot')) {
      expect(config.headers.Accept).toContain(HSB_CONTENT_TYPE)
      expect(config.responseType).toBe('arraybuffer')
    }
  })

  it('a failed snapshot page records NO cursor — the rebuild is retried, never trusted', async () => {
    get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/sync/cursor') return { data: { cursor: 42 } }
      if (url === '/sync/snapshot' && config?.params?.entity === 'customer')
        return asJson({ rows: [], hasMore: false, nextAfter: null })
      throw Object.assign(new Error('500'), { status: 500 })
    })
    await expect(pullAll()).rejects.toThrow()
    expect(readCursor('ws-1')).toBeNull()
  })
})

describe('later pulls: only the change log travels', () => {
  it('binary page: applies creates/updates, retires customers, removes invoices, advances the cursor', async () => {
    localStorage.setItem('hisabche.desktop.syncCursor:ws-1', '10')
    tables.customer = [{ id: u(1), full_name: 'قدیمی', is_active: 1 }]
    tables.invoice = [
      { id: u(2), total: 1, dirty: 0 },
      { id: u(3), total: 2, dirty: 1 }, // an unsent local edit: kept
    ]
    get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/sync/pull' && config?.params?.cursor === 10) {
        return asHsb(
          encodePullPage({
            changes: [
              {
                syncVersion: 11,
                entityType: 'product',
                entityId: u(10),
                operation: 'create',
                entityVersion: 1,
                data: { id: u(10), name: 'نو', sell_price: 5, version: 1 },
              },
              {
                syncVersion: 12,
                entityType: 'customer',
                entityId: u(1),
                operation: 'delete',
                entityVersion: 4,
                data: null,
              },
              {
                syncVersion: 13,
                entityType: 'invoice',
                entityId: u(2),
                operation: 'delete',
                entityVersion: 3,
                data: null,
              },
              {
                syncVersion: 14,
                entityType: 'invoice',
                entityId: u(3),
                operation: 'delete',
                entityVersion: 3,
                data: null,
              },
            ],
            nextCursor: 14,
            hasMore: true,
            mustRehydrate: false,
          }),
        )
      }
      if (url === '/sync/pull' && config?.params?.cursor === 14) {
        return asHsb(
          encodePullPage({
            changes: [
              {
                syncVersion: 15,
                entityType: 'product',
                entityId: u(10),
                operation: 'update',
                entityVersion: 2,
                data: { id: u(10), name: 'ویرایش', sell_price: 6, version: 2 },
              },
            ],
            nextCursor: 15,
            hasMore: false,
            mustRehydrate: false,
          }),
        )
      }
      throw new Error(`unexpected ${url} ${JSON.stringify(config?.params)}`)
    })

    await pullAll()

    expect(tables.product).toEqual([
      expect.objectContaining({
        id: u(10),
        name: 'ویرایش',
        sell_price: 6,
        is_active: 1,
        version: 2,
      }),
    ])
    expect(tables.customer).toEqual([expect.objectContaining({ id: u(1), is_active: 0 })])
    expect(tables.invoice!.map((r) => r.id)).toEqual([u(3)])
    expect(readCursor('ws-1')).toBe(15)
    expect(get.mock.calls.some(([url]) => url === '/sync/snapshot')).toBe(false)
  })

  it('a JSON answer (older server) is read the same way', async () => {
    localStorage.setItem('hisabche.desktop.syncCursor:ws-1', '10')
    get.mockResolvedValue(
      asJson({
        changes: [
          {
            entityType: 'product',
            entityId: u(7),
            operation: 'create',
            data: { id: u(7), name: 'x', version: 1 },
          },
        ],
        nextCursor: 11,
        hasMore: false,
        mustRehydrate: false,
      }),
    )
    await pullAll()
    expect(tables.product).toEqual([expect.objectContaining({ id: u(7) })])
    expect(readCursor('ws-1')).toBe(11)
  })

  it('a failed page leaves the cursor where the last COMMITTED page put it', async () => {
    localStorage.setItem('hisabche.desktop.syncCursor:ws-1', '10')
    upsertMany.mockImplementationOnce(async () => {
      throw new Error('disk full')
    })
    get.mockResolvedValue(
      asJson({
        changes: [
          {
            entityType: 'product',
            entityId: u(9),
            operation: 'create',
            data: { id: u(9), name: 'x' },
          },
        ],
        nextCursor: 20,
        hasMore: false,
        mustRehydrate: false,
      }),
    )
    await expect(pullAll()).rejects.toThrow('disk full')
    expect(readCursor('ws-1')).toBe(10)
  })

  it('a server error is not an empty page: the cursor does not move and nothing is retired', async () => {
    localStorage.setItem('hisabche.desktop.syncCursor:ws-1', '10')
    tables.product = [{ id: u(1), name: 'زنده', is_active: 1 }]
    get.mockRejectedValue(Object.assign(new Error('sync_pull_failed'), { status: 500 }))
    await expect(pullAll()).rejects.toThrow()
    expect(readCursor('ws-1')).toBe(10)
    expect(tables.product).toEqual([expect.objectContaining({ is_active: 1 })])
  })

  it('mustRehydrate switches to a snapshot', async () => {
    localStorage.setItem('hisabche.desktop.syncCursor:ws-1', '1')
    get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/sync/pull')
        return asJson({ changes: [], nextCursor: 1, hasMore: false, mustRehydrate: true })
      if (url === '/sync/cursor') return { data: { cursor: 99 } }
      if (url === '/sync/snapshot' && config?.params?.entity === 'product') {
        return asJson({
          rows: [{ id: u(1), name: 'p', version: 5 }],
          hasMore: false,
          nextAfter: null,
        })
      }
      return asJson({ rows: [], hasMore: false, nextAfter: null })
    })

    await pullAll()
    expect(tables.product).toEqual([expect.objectContaining({ version: 5 })])
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
