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
const query = jest.fn(
  async ({ table, where }: { table: string; where?: Record<string, unknown> }) => {
    // Every where-column must match, like the real SQLite query.
    const rows = (tables[table] ?? []).filter((row) =>
      Object.entries(where ?? {}).every(([k, v]) => row[k] === v),
    )
    // The read answers a page AND the number of rows the filter matches.
    return { rows, total: rows.length }
  },
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
// The engine stamps a row that names no currency with the books currency this
// device was told by the server (useCurrencyStore). The mock had only the
// workspace store, so every pulled invoice threw on `undefined.getState`.
jest.mock('@hisabche/store', () => ({
  useWorkspaceStore: { getState: () => ({ workspaceId: 'ws-1' }) },
  useCurrencyStore: { getState: () => ({ primaryCurrency: 'AFN' }) },
  // The sync centre's «last heard from the server» stamp (F2.4).
  useSyncStore: { getState: () => ({ setLastSynced: () => undefined }) },
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
      // The operational set (F2.3): read-only reference data. This workspace
      // holds none of it, which is an EMPTY page — not an error.
      if (
        url === '/sync/snapshot' &&
        [
          'warehouse',
          'branch',
          'exchange_rate',
          'product_stock',
          'order_deposits',
          'order_deposit_applications',
          'order_deposit_refunds',
          // V70.2: pulled now, empty in this workspace too.
          'product_variants',
          'service_delivery_sessions',
          'package_credit_ledger',
          'repair_tickets',
          // Sync entity coverage: these five arrive the same way — empty in
          // this fixture, not an error the pull has to hide.
          'cost_layer',
          'stock_batches',
          'stock_serials',
          'inventory_settings',
          'account',
        ].includes(String(params.entity))
      ) {
        return asJson({ rows: [], hasMore: false, nextAfter: null })
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

describe('invoice lines travel with their invoice', () => {
  it('the device keeps exactly the server lines; an unsent local edit survives', async () => {
    localStorage.setItem('hisabche.desktop.syncCursor:ws-1', '10')
    tables.invoice_item = [
      { id: u(801), invoice_id: u(800), product_name: 'removed on server', dirty: 0 },
      { id: u(802), invoice_id: u(800), product_name: 'edited offline', dirty: 1 },
    ]
    get.mockResolvedValue(
      asHsb(
        encodePullPage({
          changes: [
            {
              syncVersion: 11,
              entityType: 'invoice',
              entityId: u(800),
              operation: 'update',
              entityVersion: 3,
              data: {
                id: u(800),
                total: 20,
                version: 3,
                items: [
                  {
                    id: u(803),
                    invoice_id: u(800),
                    product_name: 'چای',
                    quantity: 2,
                    unit_price: 10,
                    total_price: 20,
                  },
                ],
              },
            },
          ],
          nextCursor: 11,
          hasMore: false,
          mustRehydrate: false,
        }),
      ),
    )
    await pullAll()
    expect(tables.invoice_item!.map((r) => r.id).sort()).toEqual([u(802), u(803)].sort())
    expect(tables.invoice_item!.find((r) => r.id === u(803))).toMatchObject({
      quantity: 2,
      total_price: 20,
    })
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

// ============================================
// The operational set arrives POPULATED (V70.2 / audit SC-03, finding F-002).
//
// The first-pull fixture above returns EMPTY pages for the four operational
// entities, so it never proved that a delivered session, a spent credit, a
// priced variant or an open ticket is actually MAPPED and PERSISTED. A mapper
// that drops `package_credit_id` or `quantity` would pass every existing test
// while the device offered the same slot and the same credit a second time.
//
// These scenarios drive the real engine with populated server rows, through
// BOTH roads (snapshot rebuild and change-log delta), and prove: field survival,
// replay without duplicates, a later version updating the right row, cursor
// advancement, pack-scoped entity requests, and delete semantics. Tenant
// scoping itself is enforced by the server and proved on real Postgres
// (service-delivery-sync-roundtrip.pg.test.ts); here the device must store
// exactly the workspace the server sent, never inventing another.
// ============================================
describe('the operational set arrives populated, through both roads', () => {
  const WS = 'ws-1'
  const SESSION = u(6001)
  const CREDIT = u(6002)
  const VARIANT = u(6003)
  const TICKET = u(6004)
  const CUSTOMER = u(6005)

  const sessionRow = {
    id: SESSION,
    workspace_id: WS,
    customer_id: CUSTOMER,
    service_offering_id: u(6006),
    practitioner_id: null,
    branch_id: null,
    session_date: '2026-11-10',
    start_time: '10:00',
    end_time: '11:00',
    duration_minutes: 60,
    status: 'delivered',
    settlement_method: 'package_credit',
    package_credit_id: CREDIT,
    invoice_id: null,
    client_notes: null,
    internal_notes: null,
    created_at: '2026-11-10T06:00:00.000Z',
    updated_at: '2026-11-10T07:00:00.000Z',
    version: 2,
  }
  const creditRow = {
    id: CREDIT,
    workspace_id: WS,
    customer_id: CUSTOMER,
    package_product_id: u(6007),
    entry_type: 'CONSUME',
    quantity: -1,
    unit: 'session',
    source_document_type: 'service_delivery',
    source_document_id: SESSION,
    source_line_id: null,
    reference_entry_id: null,
    idempotency_key: `delivery_${SESSION}`,
    notes: null,
    expires_at: null,
    effective_date: '2026-11-10',
    created_at: '2026-11-10T07:00:00.000Z',
    updated_at: '2026-11-10T07:00:00.000Z',
    version: 1,
  }
  const variantRow = {
    id: VARIANT,
    workspace_id: WS,
    template_product_id: u(6008),
    sku: 'SHIRT-M',
    barcode: 'B-SHIRT-M',
    attributes: [{ size: 'M' }],
    price_override_minor: 120_000,
    cost_override_minor: null,
    is_active: true,
    created_at: '2026-11-01T08:00:00.000Z',
    version: 4,
  }
  const ticketRow = {
    id: TICKET,
    workspace_id: WS,
    number: 1001,
    customer_id: CUSTOMER,
    serial_id: null,
    device_label: 'iPhone 13',
    problem: 'battery drains fast',
    status: 'repairing',
    under_warranty: true,
    estimate_minor: null,
    currency: null,
    technician_employee_id: null,
    promised_on: '2026-11-12',
    invoice_id: null,
    created_by: u(6009),
    created_at: '2026-11-09T08:00:00.000Z',
    updated_at: '2026-11-09T09:00:00.000Z',
    closed_at: null,
    version: 3,
  }

  const populated: Record<string, Record<string, unknown>> = {
    service_delivery_sessions: sessionRow,
    package_credit_ledger: creditRow,
    product_variants: variantRow,
    repair_tickets: ticketRow,
  }

  it('a full rebuild stores all four with the fields the next sale depends on', async () => {
    get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      const params = config?.params ?? {}
      if (url === '/sync/cursor') return { data: { cursor: 42 } }
      if (url === '/sync/snapshot') {
        const row = populated[String(params.entity)]
        return asJson({ rows: row ? [row] : [], hasMore: false, nextAfter: null })
      }
      throw new Error(`unexpected ${url}`)
    })

    await pullAll()

    // The delivered session keeps its settlement: the calendar must not offer
    // the slot again, and the credit it spent must be the one named here.
    expect(tables.service_delivery_sessions).toEqual([
      expect.objectContaining({
        id: SESSION,
        workspace_id: WS,
        customer_id: CUSTOMER,
        status: 'delivered',
        settlement_method: 'package_credit',
        package_credit_id: CREDIT,
        session_date: '2026-11-10',
        origin: 'server',
        sync_state: 'synced',
      }),
    ])
    // The local session/credit tables predate the version column: the mapper
    // stores the settlement facts, not a version the table cannot hold.
    expect(tables.service_delivery_sessions![0]).not.toHaveProperty('version')
    expect(tables.package_credit_ledger).toEqual([
      expect.objectContaining({
        id: CREDIT,
        entry_type: 'CONSUME',
        quantity: -1,
        unit: 'session',
        source_document_type: 'service_delivery',
        source_document_id: SESSION,
        idempotency_key: `delivery_${SESSION}`,
      }),
    ])
    expect(tables.package_credit_ledger![0]).not.toHaveProperty('version')
    // The variant keeps its price override and its version (the token the next
    // offline edit sends back); jsonb arrives as an object, stored as JSON text.
    expect(tables.product_variants).toEqual([
      expect.objectContaining({
        id: VARIANT,
        sku: 'SHIRT-M',
        version: 4,
        price_override_minor: 120_000,
        cost_override_minor: null,
        attributes: '[{"size":"M"}]',
        is_active: 1,
      }),
    ])
    expect(tables.repair_tickets).toEqual([
      expect.objectContaining({
        id: TICKET,
        status: 'repairing',
        under_warranty: 1,
        version: 3,
        device_label: 'iPhone 13',
      }),
    ])
    // Every stored row belongs to the workspace the server sent — no other.
    for (const table of Object.values(tables)) {
      for (const row of table) {
        if ('workspace_id' in row) expect(row.workspace_id).toBe(WS)
      }
    }
    expect(readCursor('ws-1')).toBe(42)
  })

  it('the delta road stores them too; a replay duplicates nothing; a later version updates the right row', async () => {
    localStorage.setItem('hisabche.desktop.syncCursor:ws-1', '10')
    localStorage.setItem('hisabche:installed-packs', JSON.stringify(['core', 'workforce']))

    const createPage = {
      changes: Object.entries(populated).map(([entityType, row], i) => ({
        syncVersion: 11 + i,
        entityType,
        entityId: String(row.id),
        operation: 'create',
        entityVersion: 1,
        data: row,
      })),
      nextCursor: 14,
      hasMore: true,
      mustRehydrate: false,
    }
    const updatePage = {
      changes: [
        {
          syncVersion: 15,
          entityType: 'product_variants',
          entityId: VARIANT,
          operation: 'update',
          entityVersion: 5,
          data: { ...variantRow, sku: 'SHIRT-L', version: 5 },
        },
        {
          syncVersion: 16,
          entityType: 'service_delivery_sessions',
          entityId: SESSION,
          operation: 'update',
          entityVersion: 3,
          data: { ...sessionRow, status: 'cancelled', cancellation_reason: 'wrong customer' },
        },
      ],
      nextCursor: 16,
      hasMore: false,
      mustRehydrate: false,
    }
    get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/sync/pull' && config?.params?.cursor === 10) return asJson(createPage)
      if (url === '/sync/pull' && config?.params?.cursor === 14) return asJson(updatePage)
      throw new Error(`unexpected ${url} ${JSON.stringify(config?.params)}`)
    })

    await pullAll()

    // The workforce pack owns these entities: the delta request must ask for them.
    const firstPull = get.mock.calls.find(([url]) => url === '/sync/pull')
    const asked = String(firstPull?.[1]?.params?.entityTypes ?? '')
    for (const entity of Object.keys(populated)) expect(asked).toContain(entity)

    expect(tables.service_delivery_sessions).toHaveLength(1)
    expect(tables.package_credit_ledger).toHaveLength(1)
    expect(tables.product_variants).toEqual([
      expect.objectContaining({ id: VARIANT, sku: 'SHIRT-L', version: 5 }),
    ])
    expect(tables.service_delivery_sessions).toEqual([
      expect.objectContaining({ id: SESSION, status: 'cancelled' }),
    ])
    expect(readCursor('ws-1')).toBe(16)

    // A crash replayed the same pages (the cursor write was lost): the device
    // reconciles by id — one row per fact, never a second copy.
    localStorage.setItem('hisabche.desktop.syncCursor:ws-1', '10')
    await pullAll()

    expect(tables.service_delivery_sessions).toHaveLength(1)
    expect(tables.package_credit_ledger).toHaveLength(1)
    expect(tables.product_variants).toHaveLength(1)
    expect(tables.repair_tickets).toHaveLength(1)
    expect(tables.product_variants).toEqual([
      expect.objectContaining({ sku: 'SHIRT-L', version: 5 }),
    ])
    expect(readCursor('ws-1')).toBe(16)
  })

  it('a device without the workforce pack does not ask for its entities', async () => {
    localStorage.setItem('hisabche.desktop.syncCursor:ws-1', '10')
    localStorage.setItem('hisabche:installed-packs', JSON.stringify(['core']))
    get.mockResolvedValue(
      asJson({ changes: [], nextCursor: 10, hasMore: false, mustRehydrate: false }),
    )

    await pullAll()

    const firstPull = get.mock.calls.find(([url]) => url === '/sync/pull')
    const asked = String(firstPull?.[1]?.params?.entityTypes ?? '')
    expect(asked).toContain('invoice')
    expect(asked).not.toContain('service_delivery_sessions')
    expect(asked).not.toContain('package_credit_ledger')
    expect(asked).not.toContain('repair_tickets')
  })

  it('a server delete removes the local session; an unsent local edit is kept', async () => {
    localStorage.setItem('hisabche.desktop.syncCursor:ws-1', '10')
    localStorage.setItem('hisabche:installed-packs', JSON.stringify(['core', 'workforce']))
    tables.service_delivery_sessions = [
      { id: SESSION, workspace_id: WS, status: 'delivered', dirty: 0 },
      { id: u(6010), workspace_id: WS, status: 'scheduled', dirty: 1 },
    ]
    get.mockResolvedValue(
      asJson({
        changes: [
          {
            syncVersion: 11,
            entityType: 'service_delivery_sessions',
            entityId: SESSION,
            operation: 'delete',
            entityVersion: 4,
            data: null,
          },
          {
            syncVersion: 12,
            entityType: 'service_delivery_sessions',
            entityId: u(6010),
            operation: 'delete',
            entityVersion: 2,
            data: null,
          },
        ],
        nextCursor: 12,
        hasMore: false,
        mustRehydrate: false,
      }),
    )

    await pullAll()

    expect(tables.service_delivery_sessions!.map((r) => r.id)).toEqual([u(6010)])
    expect(readCursor('ws-1')).toBe(12)
  })
})
