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
vi.mock('../lib/client', () => ({ default: { get: (...a: unknown[]) => get(...a) } }))

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
