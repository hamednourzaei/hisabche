// ============================================
// Guard: payment-device-first.test.ts (V70 §8)
//
// 1. Ready device => the payment is written by the local engine (0 POST to the
//    server), under the intent key as its id, and a sync is requested.
// 2. Web (no readiness registered) => the server, with the same key.
// 3. Device not ready for THIS workspace => the server.
// 4. A device refusal ONLINE asks the server once (a fee is booked only there);
//    OFFLINE the device's refusal is shown and the server is never asked.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const serverPost = vi.fn()
let localResult: unknown = null
let localError: Error | null = null
const localCalls: Array<{ method: string; path: string; body: unknown }> = []
let syncRequested = 0

vi.mock('../lib/client', () => ({
  default: { post: (...a: unknown[]) => serverPost(...a) },
  apiClient: { post: (...a: unknown[]) => serverPost(...a), get: vi.fn() },
  localRequest: async (method: string, path: string, body: unknown) => {
    localCalls.push({ method, path, body })
    if (localError) throw localError
    return localResult
  },
  requestSyncSoon: () => {
    syncRequested += 1
  },
  onSyncRequested: vi.fn(),
  registerLocalTransport: vi.fn(),
}))

const { submitPayment } = await import('../hooks/payments')
const { registerDeviceReadiness, resetDeviceReadiness } = await import('../lib/execution-site')
const { registerOfflineQueue } = await import('../lib/offline-queue')
const { setActiveWorkspaceId } = await import('../lib/active-workspace')

type Input = Parameters<typeof submitPayment>[0]
const INPUT = {
  direction: 'in',
  partyType: 'customer',
  partyId: '00000000-0000-4000-8000-000000000001',
  amount: 400,
  currency: 'AFN',
} as Input

const offlineQueue = (offline: boolean) =>
  ({ isOffline: () => offline }) as unknown as Parameters<typeof registerOfflineQueue>[0]

describe('V70 §8 — a payment is recorded on a ready device first', () => {
  beforeEach(() => {
    serverPost.mockReset()
    localCalls.length = 0
    localResult = null
    localError = null
    syncRequested = 0
    resetDeviceReadiness()
    setActiveWorkspaceId('ws-1')
    registerOfflineQueue(null as unknown as Parameters<typeof registerOfflineQueue>[0])
  })

  it('ready device: local engine, intent key as id, no server call, sync requested', async () => {
    registerDeviceReadiness((ws, op) => ws === 'ws-1' && op === 'payment.record')
    localResult = { id: 'pay_key_1', paymentNumber: 'RCT-00001', amount: 400 }

    const res = await submitPayment(INPUT, 'pay_key_1')

    expect(res).toEqual({
      id: 'pay_key_1',
      paymentNumber: 'RCT-00001',
      amount: 400,
      pendingSync: true,
    })
    expect(serverPost).not.toHaveBeenCalled()
    expect(localCalls).toEqual([
      { method: 'POST', path: '/payments', body: { ...INPUT, id: 'pay_key_1' } },
    ])
    expect(syncRequested).toBe(1)
  })

  it('web: the server, with the same key', async () => {
    serverPost.mockResolvedValue({ data: { id: 'srv-1' } })
    const res = await submitPayment(INPUT, 'pay_key_2')
    expect(res).toEqual({ id: 'srv-1' })
    expect(localCalls.length).toBe(0)
    expect(serverPost).toHaveBeenCalledWith('/payments', INPUT, {
      headers: { 'Idempotency-Key': 'pay_key_2' },
    })
  })

  it('a device ready only for invoices does not record payments', async () => {
    registerDeviceReadiness((_ws, op) => op === 'invoice.create')
    serverPost.mockResolvedValue({ data: { id: 'srv-2' } })
    await submitPayment(INPUT, 'pay_key_3')
    expect(localCalls.length).toBe(0)
    expect(serverPost).toHaveBeenCalledTimes(1)
  })

  it('online: a device refusal asks the server once, under the same key', async () => {
    registerDeviceReadiness(() => true)
    registerOfflineQueue(offlineQueue(false))
    localError = new Error('PAYMENT_FEE_ONLINE_ONLY')
    serverPost.mockResolvedValue({ data: { id: 'srv-3' } })

    const res = await submitPayment({ ...INPUT, feeAmount: 5 } as Input, 'pay_key_4')

    expect(res).toEqual({ id: 'srv-3' })
    expect(serverPost).toHaveBeenCalledTimes(1)
    expect(serverPost.mock.calls[0]?.[2]).toEqual({ headers: { 'Idempotency-Key': 'pay_key_4' } })
  })

  it('offline: the device refusal is the answer; the server is never asked', async () => {
    registerDeviceReadiness(() => true)
    registerOfflineQueue(offlineQueue(true))
    localError = new Error('PAYMENT_EXCHANGE_RATE_REQUIRED')

    await expect(submitPayment(INPUT, 'pay_key_5')).rejects.toThrow(
      'PAYMENT_EXCHANGE_RATE_REQUIRED',
    )
    expect(serverPost).not.toHaveBeenCalled()
  })
})
