// ============================================
// Guard: invoice-device-first.test.ts
//
// Guarantees:
// 1. Host with local engine + data ready + online => 0 POST /invoices to axios,
//    written via localRequest, requestSyncSoon triggered.
// 2. Web build (no host / no local transport) => direct to server.
// 3. Not ready + online => direct to server.
// 4. Local engine refusal: OFFLINE it is shown (the only answer there is);
//    ONLINE the server is asked once and its answer is the one shown — the
//    device may be refusing for lack of rows no pull delivers.
// 5. Without idempotencyKey => never executes on device (server path).
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const serverPost = vi.fn()
let localMockResult: unknown = null
let localShouldThrow: Error | null = null
const localCalls: Array<{ method: string; path: string; body: unknown }> = []

let mockActiveWorkspace: string | null = null
let syncRequestedCount = 0

vi.mock('../lib/client', () => ({
  default: { post: (...a: unknown[]) => serverPost(...a) },
  apiClient: { post: (...a: unknown[]) => serverPost(...a) },
  localRequest: async (method: string, path: string, body: unknown) => {
    localCalls.push({ method, path, body })
    if (localShouldThrow) throw localShouldThrow
    return localMockResult
  },
  requestSyncSoon: () => {
    syncRequestedCount += 1
  },
  onSyncRequested: vi.fn(),
  registerLocalTransport: vi.fn(),
}))

const { submitInvoice } = await import('../hooks/invoices')
const { registerDeviceReadiness, resetDeviceReadiness } = await import('../lib/execution-site')
const { registerOfflineQueue } = await import('../lib/offline-queue')
const { setActiveWorkspaceId } = await import('../lib/active-workspace')

const testInvoiceInput = {
  type: 'sale',
  total: 50_000,
  currency: 'AFN',
  items: [],
} as unknown as Parameters<typeof submitInvoice>[0]

describe('V68.3 — Local-First Device Invoice Creation', () => {
  beforeEach(() => {
    serverPost.mockReset()
    localCalls.length = 0
    localMockResult = null
    localShouldThrow = null
    mockActiveWorkspace = null
    setActiveWorkspaceId(null)
    syncRequestedCount = 0
    resetDeviceReadiness()
    registerOfflineQueue(null as unknown as Parameters<typeof registerOfflineQueue>[0])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('(الف) Host + ready + online => 0 POST to axios, 1 localRequest, and requests sync', async () => {
    mockActiveWorkspace = 'ws-test-1'
    setActiveWorkspaceId('ws-test-1')
    registerDeviceReadiness((ws, op) => ws === 'ws-test-1' && op === 'invoice.create')

    localMockResult = {
      id: 'inv-local-001',
      invoice_number: 'OFF-dev-001',
      total: 50_000,
      currency: 'AFN',
    }

    const res = await submitInvoice({
      ...testInvoiceInput,
      idempotencyKey: 'key-device-first',
    })

    expect(res).toEqual({
      id: 'inv-local-001',
      invoice_number: 'OFF-dev-001',
      total: 50_000,
      currency: 'AFN',
      pendingSync: true,
    })

    expect(serverPost).not.toHaveBeenCalled()
    expect(localCalls.length).toBe(1)
    expect(localCalls[0]?.path).toBe('/invoices')
    expect(syncRequestedCount).toBe(1)
  })

  it('(ب) Web build (no host / no local transport) => direct to server', async () => {
    mockActiveWorkspace = 'ws-test-1'
    setActiveWorkspaceId('ws-test-1')
    // The web build never registers a readiness check.

    serverPost.mockResolvedValue({
      data: { id: 'inv-server-web', invoice_number: 'INV-2026-WEB' },
    })

    const res = await submitInvoice({
      ...testInvoiceInput,
      idempotencyKey: 'key-web',
    })

    expect(res).toEqual({ id: 'inv-server-web', invoice_number: 'INV-2026-WEB' })
    expect(serverPost).toHaveBeenCalledTimes(1)
    expect(localCalls.length).toBe(0)
  })

  it('(ج) Not ready + online => fallback directly to server', async () => {
    mockActiveWorkspace = 'ws-test-1'
    setActiveWorkspaceId('ws-test-1')
    // Device is NOT ready yet
    registerDeviceReadiness(() => false)

    serverPost.mockResolvedValue({
      data: { id: 'inv-server-not-ready', invoice_number: 'INV-2026-NOT-READY' },
    })

    const res = await submitInvoice({
      ...testInvoiceInput,
      idempotencyKey: 'key-not-ready',
    })

    expect(res).toEqual({ id: 'inv-server-not-ready', invoice_number: 'INV-2026-NOT-READY' })
    expect(serverPost).toHaveBeenCalledTimes(1)
    expect(localCalls.length).toBe(0)
  })

  it('(د) Local engine 422 while OFFLINE => shown, the server is never asked', async () => {
    mockActiveWorkspace = 'ws-test-1'
    setActiveWorkspaceId('ws-test-1')
    registerDeviceReadiness(() => true)

    const engineErr = new Error('INSUFFICIENT_STOCK:variant-1') as Error & {
      response?: { status: number; data: unknown }
    }
    engineErr.response = { status: 422, data: { error: 'INSUFFICIENT_STOCK:variant-1' } }
    localShouldThrow = engineErr
    registerOfflineQueue({
      isOffline: () => true,
      enqueue: async () => undefined,
    } as unknown as Parameters<typeof registerOfflineQueue>[0])

    await expect(
      submitInvoice({
        ...testInvoiceInput,
        idempotencyKey: 'key-err',
      }),
    ).rejects.toThrow('INSUFFICIENT_STOCK:variant-1')

    expect(serverPost).not.toHaveBeenCalled()
    expect(localCalls.length).toBe(1)
  })

  it('(د۲) Local engine 422 while ONLINE => the server decides, asked exactly once', async () => {
    mockActiveWorkspace = 'ws-test-1'
    setActiveWorkspaceId('ws-test-1')
    registerDeviceReadiness(() => true)

    const engineErr = new Error('SERIAL_NOT_FOUND:imei-1') as Error & {
      response?: { status: number; data: unknown }
    }
    engineErr.response = { status: 422, data: { error: 'SERIAL_NOT_FOUND:imei-1' } }
    localShouldThrow = engineErr

    serverPost.mockResolvedValue({
      data: { id: 'inv-server-serial', invoice_number: 'INV-2026-SERIAL' },
    })

    const res = await submitInvoice({
      ...testInvoiceInput,
      idempotencyKey: 'key-refused-on-device',
    })

    expect(res).toEqual({ id: 'inv-server-serial', invoice_number: 'INV-2026-SERIAL' })
    expect(localCalls.length).toBe(1)
    expect(serverPost).toHaveBeenCalledTimes(1)
    // The device recorded nothing, so there is nothing to push.
    expect(syncRequestedCount).toBe(0)
  })

  it('(هـ) Without idempotencyKey => never executes on device, goes to server', async () => {
    mockActiveWorkspace = 'ws-test-1'
    setActiveWorkspaceId('ws-test-1')
    registerDeviceReadiness(() => true)

    serverPost.mockResolvedValue({
      data: { id: 'inv-server-no-key', invoice_number: 'INV-NO-KEY' },
    })

    const res = await submitInvoice({
      ...testInvoiceInput,
      idempotencyKey: undefined,
    })

    expect(res).toEqual({ id: 'inv-server-no-key', invoice_number: 'INV-NO-KEY' })
    expect(serverPost).toHaveBeenCalledTimes(1)
    expect(localCalls.length).toBe(0)
  })
})
