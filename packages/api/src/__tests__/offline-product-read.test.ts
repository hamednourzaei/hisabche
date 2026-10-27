// ============================================
// The product list reads the DEVICE when the network cannot — and, on one
// screen, even when it can.
//
// The product list was the first list that had a device path, but it asked
// for the first 500 rows and reported the page as the whole business. A
// business with 300 products was told it had 20.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
// The local engine: `null` is «this host has none» (the web build) — the generic
// table read is then the only device answer there is.
const local = vi.fn()
let edition: 'cloud' | 'offline' = 'cloud'
vi.mock('../lib/client', () => ({
  default: { get: (...a: unknown[]) => get(...a) },
  localRequest: (...a: unknown[]) => local(...a),
  getAppEdition: () => edition,
}))

const { fetchProducts } = await import('../hooks/products')
const { registerOfflineQueue } = await import('../lib/offline-queue')

const SIGNAL = new AbortController().signal

interface ReadCall {
  table: string
  search: string
  options:
    | {
        where?: Record<string, unknown>
        searchColumns?: readonly string[]
        orderBy?: string
        direction?: string
        limit?: number
        offset?: number
      }
    | undefined
}

let offline = false
let deviceRows: Array<Record<string, unknown>> = []
let deviceTotal = 0
let reads: ReadCall[] = []

const productRow = (over: Record<string, unknown> = {}) => ({
  id: '33333333-3333-4333-8333-333333333333',
  name: 'گردنبند',
  barcode: '1001',
  sku: 'SKU-1',
  quantity: 5,
  unit: 'piece',
  min_stock_level: 0,
  buy_price: 0,
  sell_price: 0,
  is_active: 1,
  updated_at: '2026-10-01T00:00:00.000Z',
  dirty: 0,
  ...over,
})

beforeEach(() => {
  get.mockReset()
  local.mockReset()
  local.mockResolvedValue(null)
  edition = 'cloud'
  offline = false
  deviceRows = []
  deviceTotal = 0
  reads = []
  registerOfflineQueue({
    isOffline: () => offline,
    enqueue: async () => {},
    readRows: async (table, search, options) => {
      reads.push({ table, search, options })
      return { rows: deviceRows, total: deviceTotal }
    },
  })
})

describe('the product list', () => {
  it('offline: the device answers, and the network is never asked', async () => {
    offline = true
    deviceRows = [productRow()]
    deviceTotal = 137

    const page = await fetchProducts({ page: 1, limit: 20, sortDirection: 'desc' }, {}, SIGNAL)

    expect(get).not.toHaveBeenCalled()
    expect(page.products).toHaveLength(1)
    expect(page.products[0]?.name).toBe('گردنبند')
    // ⚠️ THE DEVICE'S REAL TOTAL, NOT THE LENGTH OF THE PAGE.
    expect(page.total).toBe(137)
  })

  it('offline: the right page is asked for', async () => {
    offline = true

    await fetchProducts({ page: 3, limit: 25, sortDirection: 'asc' }, {}, SIGNAL)

    const read = reads[0]
    expect(read?.options?.limit).toBe(25)
    expect(read?.options?.offset).toBe(50)
    expect(read?.options?.direction).toBe('asc')
    expect(read?.options?.orderBy).toBe('created_at')
  })

  it('the server’s search rule: the name always, the barcode beside it', async () => {
    offline = true

    await fetchProducts({ page: 1, limit: 20, sortDirection: 'desc', search: 'گرد' }, {}, SIGNAL)
    // The server searches the name, and the barcode too whenever the text
    // normalises to a code (backend/src/services/product.service.ts:155).
    expect(reads[0]?.options?.searchColumns).toEqual(['name', 'barcode'])
    // The sku is NOT searched by the server, so it is not searched here.
    expect(reads[0]?.options?.searchColumns).not.toContain('sku')

    await fetchProducts({ page: 1, limit: 20, sortDirection: 'desc', search: '' }, {}, SIGNAL)
    expect(reads[1]?.options?.searchColumns).toEqual(['name'])
  })

  it('a product created on this device and not yet synced is in the list', async () => {
    offline = true
    deviceRows = [
      productRow({ id: '44444444-4444-4444-8444-444444444444', name: 'کالای تازه', dirty: 1 }),
    ]
    deviceTotal = 1

    const page = await fetchProducts({ page: 1, limit: 20, sortDirection: 'desc' }, {}, SIGNAL)

    expect(page.products.map((p) => p.name)).toEqual(['کالای تازه'])
  })

  it('ONLINE, on the screen that reads the device: no request for the data', async () => {
    deviceRows = [productRow()]
    deviceTotal = 1

    const page = await fetchProducts(
      { page: 1, limit: 20, sortDirection: 'desc' },
      { preferDevice: true },
      SIGNAL,
    )

    expect(get).not.toHaveBeenCalled()
    expect(page.products).toHaveLength(1)
  })

  it('ONLINE, on that screen: a device that knows nothing falls back to the network', async () => {
    get.mockResolvedValue({ data: { products: [{ id: 'p1', name: 'از سرور' }], total: 1 } })

    const page = await fetchProducts(
      { page: 1, limit: 20, sortDirection: 'desc' },
      { preferDevice: true },
      SIGNAL,
    )

    expect(get).toHaveBeenCalledTimes(1)
    expect(page.products[0]?.name).toBe('از سرور')
  })

  it('the request never got an answer: the device answers instead', async () => {
    get.mockRejectedValue({ status: 500, code: 'NETWORK_ERROR', message: 'Network Error' })
    deviceRows = [productRow()]
    deviceTotal = 1

    const page = await fetchProducts({ page: 1, limit: 20, sortDirection: 'desc' }, {}, SIGNAL)

    expect(page.products).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ THE DEVICE ANSWERS THROUGH THE LOCAL ENGINE (owner, 26 Oct 2026).
//
// «در انبار ۱۰ گرم طلا دارم و فاکتور می‌گوید کالایی پیدا نشد.» The picker read
// the device with `db:query`, which the desktop's main process refuses without a
// stored sign-in: `IPC_REJECTED:db:query`, an empty list, and no error anyone
// could see. The engine is the one reader that needs no such session.
// ═══════════════════════════════════════════════════════════════════════════
describe('the device answers through the local engine, not through the gated table read', () => {
  const engineProduct = {
    id: '0918241e-bdd4-4dc5-a29c-b9a5bd7f8b34',
    name: 'طلای ابشده',
    unit: 'gram',
    quantity: 10,
  }

  it('offline: the engine is asked, and the generic table read never is', async () => {
    offline = true
    local.mockResolvedValue({ products: [engineProduct], total: 1 })

    const page = await fetchProducts({ page: 1, limit: 100, warehouseId: 'wh-1' }, {}, SIGNAL)

    expect(page.products.map((p) => p.name)).toEqual(['طلای ابشده'])
    expect(reads).toEqual([]) // no `db:query`, so no IPC_REJECTED
    expect(get).not.toHaveBeenCalled()
  })

  it('the warehouse reaches the engine, as a string, with the page and the sort', async () => {
    offline = true
    local.mockResolvedValue({ products: [], total: 0 })

    await fetchProducts(
      { page: 2, limit: 100, warehouseId: 'wh-1', sortBy: 'name', sortDirection: 'asc' },
      {},
      SIGNAL,
    )

    const [method, path, body, params] = local.mock.calls[0]!
    expect([method, path, body]).toEqual(['GET', '/products', undefined])
    expect(params).toMatchObject({
      warehouseId: 'wh-1',
      page: '2',
      limit: '100',
      sortBy: 'name',
      sortDirection: 'asc',
    })
    // A filter nobody set is not sent: `isActive=undefined` is not «all».
    expect(params).not.toHaveProperty('isActive')
    expect(params).not.toHaveProperty('search')
  })

  it('the summary rides along, so the warehouse cards are not «نامعلوم»', async () => {
    offline = true
    const summary = { productCount: 1, totalValue: 300000000 }
    local.mockResolvedValue({ products: [engineProduct], total: 1, summary })

    const page = await fetchProducts({ includeSummary: true }, {}, SIGNAL)

    expect(page.summary).toEqual(summary)
    expect(local.mock.calls[0]![3]).toMatchObject({ includeSummary: 'true' })
  })

  it('a host with no engine still has the table read', async () => {
    offline = true
    deviceRows = [productRow()]
    deviceTotal = 1

    const page = await fetchProducts({ page: 1, limit: 20 }, {}, SIGNAL)

    expect(page.products).toHaveLength(1)
    expect(reads).toHaveLength(1)
  })

  it('the engine failing is an error, not an empty list', async () => {
    offline = true
    local.mockRejectedValue(new Error('engine down'))

    await expect(fetchProducts({}, {}, SIGNAL)).rejects.toThrow('engine down')
    expect(reads).toEqual([]) // and it does not fall into the gated read behind its back
  })

  it('a cloud device that never pulled products says «not available», not «empty»', async () => {
    offline = true
    local.mockResolvedValue({ products: [], total: 0 })
    registerOfflineQueue({
      isOffline: () => true,
      enqueue: async () => {},
      hasSynced: () => false,
    })

    const page = await fetchProducts({}, {}, SIGNAL)

    expect(page.notAvailableOffline).toBe(true)
  })

  it('the offline edition has no cloud to pull from: empty is empty', async () => {
    offline = true
    edition = 'offline'
    local.mockResolvedValue({ products: [], total: 0 })
    registerOfflineQueue({
      isOffline: () => true,
      enqueue: async () => {},
      hasSynced: () => false,
    })

    const page = await fetchProducts({}, {}, SIGNAL)

    expect(page.notAvailableOffline).toBe(false)
  })

  it('ONLINE, on the screen that prefers the device: the engine answers when it has rows', async () => {
    local.mockResolvedValue({ products: [engineProduct], total: 1 })

    const page = await fetchProducts({}, { preferDevice: true }, SIGNAL)

    expect(page.total).toBe(1)
    expect(reads).toEqual([])
    expect(get).not.toHaveBeenCalled()
  })

  it('ONLINE, an engine that knows nothing falls back to the network', async () => {
    local.mockResolvedValue({ products: [], total: 0 })
    get.mockResolvedValue({ data: { products: [engineProduct], total: 1 } })

    const page = await fetchProducts({}, { preferDevice: true }, SIGNAL)

    expect(page.total).toBe(1)
    expect(get).toHaveBeenCalledTimes(1)
  })
})
