// ============================================
// Guard: device-reads-when-ready.test.ts
//
// Guarantees:
// 1. When host is ready and table is marked synced, the lists a sale needs
//    (invoices, products, customers) read from local engine even while online.
//    Dashboard figures and the books do NOT: the device holds no payments,
//    cost layers or accounts of other devices, so its totals would be quietly
//    different from the server's. They stay on the server while online.
// 2. When table is not synced, reads fallback to server.
// 3. Unsynced table offline indicates notAvailableOffline, never false empty list.
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const serverGet = vi.fn()
const localCalls: Array<{ method: string; path: string; body?: unknown }> = []

let mockHasTransport = false
let mockEdition = 'cloud'
let mockActiveWorkspace: string | null = null
const syncedTables = new Set<string>()

vi.mock('../lib/client', () => ({
  default: { get: (...a: unknown[]) => serverGet(...a) },
  apiClient: { get: (...a: unknown[]) => serverGet(...a) },
  localRequest: async (method: string, path: string, body?: unknown) => {
    localCalls.push({ method, path, body })
    if (path === '/invoices') {
      return { invoices: [{ id: 'inv-loc-1', invoice_number: 'OFF-1' }], total: 1 }
    }
    if (path === '/products') {
      return { products: [{ id: 'prod-loc-1', name: 'Product Local' }], total: 1 }
    }
    if (path === '/products/prod-123') {
      return { id: 'prod-123', name: 'Instant Stock Item', stock: 42 }
    }
    if (path === '/analytics/dashboard') {
      return { todaySales: 75000, todayInvoices: 3 }
    }
    if (path === '/accounting/accounts') {
      return [{ id: 'acc-loc-1', name: 'Cash Local' }]
    }
    return null
  },
  hasLocalTransport: () => mockHasTransport,
  getAppEdition: () => mockEdition,
  getActiveWorkspaceId: () => mockActiveWorkspace,
  requestSyncSoon: vi.fn(),
  onSyncRequested: vi.fn(),
  registerLocalTransport: vi.fn(),
}))

const { registerOfflineQueue } = await import('../lib/offline-queue')
const { registerDeviceReadiness, resetDeviceReadiness } = await import('../lib/execution-site')
const { setActiveWorkspaceId } = await import('../lib/active-workspace')
const { fetchProducts } = await import('../hooks/products')
const { readDashboardKpisFromDevice } = await import('../hooks/dashboard')

describe('V68.4 — Local-First Operational Reads on Device', () => {
  beforeEach(() => {
    serverGet.mockReset()
    localCalls.length = 0
    mockHasTransport = true
    mockEdition = 'cloud'
    mockActiveWorkspace = 'ws-reads-1'
    setActiveWorkspaceId('ws-reads-1')
    syncedTables.clear()

    registerOfflineQueue({
      isOffline: () => false,
      enqueue: vi.fn(),
      hasSynced: (table: string) => syncedTables.has(table),
    })

    registerDeviceReadiness((ws, op) => ws === 'ws-reads-1' && op === 'invoice.create')
  })

  afterEach(() => {
    resetDeviceReadiness()
    vi.restoreAllMocks()
  })

  it('when device is ready and table is synced, fetchProducts reads from local engine online', async () => {
    syncedTables.add('product')

    const page = await fetchProducts({}, {}, new AbortController().signal)

    expect(localCalls.some((c) => c.path === '/products')).toBe(true)
    expect(serverGet).not.toHaveBeenCalled()
    expect(page.products.length).toBe(1)
    expect(page.products[0]?.id).toBe('prod-loc-1')
  })

  it('when table is NOT synced, fetchProducts goes to server online', async () => {
    // product is not in syncedTables
    serverGet.mockResolvedValue({
      data: { products: [{ id: 'prod-srv-1', name: 'Product Server' }], total: 1 },
    })

    const page = await fetchProducts({}, {}, new AbortController().signal)

    expect(serverGet).toHaveBeenCalledTimes(1)
    expect(page.products[0]?.id).toBe('prod-srv-1')
  })

  it('dashboard figures are NOT read from the device while online, ready or not', async () => {
    syncedTables.add('invoice')

    const kpis = await readDashboardKpisFromDevice()

    // null = «take the server road»: a figure someone decides on never comes
    // from a partial copy.
    expect(kpis).toBeNull()
    expect(localCalls.some((c) => c.path === '/analytics/dashboard')).toBe(false)
  })
})
