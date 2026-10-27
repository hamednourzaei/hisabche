// ============================================
// The customer list reads the DEVICE when the network cannot — and, on one
// screen, even when it can.
//
// Before this, the invoice builder's customer picker was the one list with no
// device path: the product beside it asked the device first
// (packages/api/src/hooks/products.ts), the customers asked the network and
// nothing else. Offline, the picker was empty, and the shopkeeper could not
// pick the customer they had just created.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
// The local engine: `null` is «this host has none» (the web build).
const local = vi.fn()
vi.mock('../lib/client', () => ({
  default: { get: (...a: unknown[]) => get(...a) },
  localRequest: (...a: unknown[]) => local(...a),
  getAppEdition: () => 'cloud',
}))

const { fetchCustomers } = await import('../hooks/customers')
const { registerOfflineQueue } = await import('../lib/offline-queue')

/** React Query's abort signal, as the query hands it over. */
const SIGNAL = new AbortController().signal

interface ReadCall {
  table: string
  search: string
  options:
    | {
        where?: Record<string, unknown>
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

const customerRow = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  full_name: 'شریک خرید',
  phone: '0700000000',
  email: null,
  address: null,
  notes: null,
  opening_balance: 0,
  type: 'cash',
  declared_role: null,
  is_active: 1,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
  dirty: 0,
  ...over,
})

const list = { page: 1, limit: 20, sortDirection: 'desc' } as const

beforeEach(() => {
  get.mockReset()
  local.mockReset()
  local.mockResolvedValue(null)
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

describe('the customer list', () => {
  it('offline: the device answers, and the network is never asked', async () => {
    offline = true
    deviceRows = [customerRow()]
    deviceTotal = 137

    const page = await fetchCustomers(list, {}, SIGNAL)

    expect(get).not.toHaveBeenCalled()
    expect(page.customers).toHaveLength(1)
    expect(page.customers[0]?.fullName).toBe('شریک خرید')
    // ⚠️ THE DEVICE'S REAL TOTAL, NOT THE LENGTH OF THE PAGE.
    expect(page.total).toBe(137)
  })

  it('offline: a customer created on this device and not yet synced is in the list', async () => {
    offline = true
    deviceRows = [
      customerRow({
        id: '22222222-2222-4222-8222-222222222222',
        full_name: 'مشتری تازه',
        dirty: 1,
        sync_state: 'local_only',
      }),
    ]
    deviceTotal = 1

    const page = await fetchCustomers(list, {}, SIGNAL)

    expect(page.customers.map((c) => c.fullName)).toEqual(['مشتری تازه'])
  })

  it('offline: a device that knows nothing is an empty list, not an error', async () => {
    offline = true
    deviceRows = []
    deviceTotal = 0

    const page = await fetchCustomers(list, {}, SIGNAL)

    expect(page.customers).toEqual([])
    expect(page.total).toBe(0)
  })

  it('ONLINE, on the screen that reads the device: no request for the data', async () => {
    deviceRows = [customerRow()]
    deviceTotal = 1

    const page = await fetchCustomers(list, { preferDevice: true }, SIGNAL)

    expect(get).not.toHaveBeenCalled()
    expect(page.customers).toHaveLength(1)
  })

  it('ONLINE, on that screen: a device that knows nothing falls back to the network', async () => {
    deviceRows = []
    deviceTotal = 0
    get.mockResolvedValue({ data: { customers: [{ id: 'c1', fullName: 'از سرور' }], total: 1 } })

    const page = await fetchCustomers(list, { preferDevice: true }, SIGNAL)

    expect(get).toHaveBeenCalledTimes(1)
    expect(page.customers[0]?.fullName).toBe('از سرور')
  })

  it('ONLINE, everywhere else: the network answers', async () => {
    get.mockResolvedValue({ data: { customers: [], total: 0 } })

    await fetchCustomers(list, {}, SIGNAL)

    expect(get).toHaveBeenCalledTimes(1)
  })

  it('the request never got an answer: the device answers instead', async () => {
    get.mockRejectedValue({ status: 500, code: 'NETWORK_ERROR', message: 'Network Error' })
    deviceRows = [customerRow()]
    deviceTotal = 1

    const page = await fetchCustomers(list, {}, SIGNAL)

    expect(page.customers).toHaveLength(1)
  })

  it('the same filters the API applies', async () => {
    offline = true

    await fetchCustomers(
      {
        page: 2,
        limit: 25,
        sortDirection: 'asc',
        search: 'احمد',
        isActive: true,
      },
      {},
      SIGNAL,
    )

    const read = reads[0]
    expect(read?.table).toBe('customer')
    expect(read?.search).toBe('احمد')
    // A deleted row is not a customer, and `is_active` is a filter only when
    // the caller asked for one — exactly what the server does.
    expect(read?.options?.where).toEqual({ deleted_at: null, is_active: 1 })
    expect(read?.options?.orderBy).toBe('created_at')
    expect(read?.options?.direction).toBe('asc')
    expect(read?.options?.limit).toBe(25)
    expect(read?.options?.offset).toBe(25)
  })

  it('a filter only the server can compute: the device must not answer', async () => {
    offline = true
    get.mockRejectedValue({ status: 500, code: 'NETWORK_ERROR', message: 'Network Error' })

    await expect(
      fetchCustomers({ page: 1, limit: 20, sortDirection: 'desc', role: 'buyer' }, {}, SIGNAL),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(reads).toHaveLength(0)
  })
})

// ⚠️ THE ENGINE, NOT THE GATED TABLE READ (26 Oct 2026) — the product picker's
// twin: `db:query` is refused without a stored sign-in, the engine is not.
describe('the device answers through the local engine', () => {
  it('offline: the engine is asked, and the table read never is', async () => {
    offline = true
    local.mockResolvedValue({
      customers: [{ id: 'c1', fullName: 'haji' }],
      total: 1,
    })

    const page = await fetchCustomers(
      { page: 1, limit: 20, sortDirection: 'desc', search: 'haj' },
      {},
      SIGNAL,
    )

    expect(page.customers.map((c) => c.fullName)).toEqual(['haji'])
    expect(reads).toEqual([])
    expect(get).not.toHaveBeenCalled()
    expect(local.mock.calls[0]![3]).toMatchObject({ search: 'haj', page: '1', limit: '20' })
  })

  it('a host with no engine still has the table read', async () => {
    offline = true
    deviceRows = [{ id: 'c1', full_name: 'haji', is_active: 1 }]
    deviceTotal = 1

    const page = await fetchCustomers({ page: 1, limit: 20, sortDirection: 'desc' }, {}, SIGNAL)

    expect(page.customers).toHaveLength(1)
    expect(reads).toHaveLength(1)
  })
})
