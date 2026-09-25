// ============================================
// An invoice with no network is queued on a device that can queue it —
// and ONLY when there was no answer. A refusal from the server is shown.
//
// Before this, nothing ever put a write in the device queue: offline, the
// confirm button spun and the sale was lost.
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.fn()
vi.mock('../lib/client', () => ({ default: { post: (...a: unknown[]) => post(...a) } }))

const { submitInvoice } = await import('../hooks/invoices')
const { registerOfflineQueue } = await import('../lib/offline-queue')

type Entry = Parameters<Parameters<typeof registerOfflineQueue>[0]['enqueue']>[0]

const input = { type: 'sale', total: 30_000, items: [] } as unknown as Parameters<
  typeof submitInvoice
>[0]
let offline = false
let queued: Entry[] = []

beforeEach(() => {
  post.mockReset()
  offline = false
  queued = []
  registerOfflineQueue({ isOffline: () => offline, enqueue: async (e) => void queued.push(e) })
})
afterEach(() => vi.restoreAllMocks())

describe('submitInvoice', () => {
  it('online: sends it, queues nothing', async () => {
    post.mockResolvedValue({ data: { id: 'inv-1' } })
    await expect(submitInvoice({ ...input, idempotencyKey: 'k1' })).resolves.toEqual({
      id: 'inv-1',
    })
    expect(queued).toEqual([])
  })

  it('known offline: queues the identical request under its idempotency key, without trying', async () => {
    offline = true
    const result = await submitInvoice({ ...input, idempotencyKey: 'k2' })
    expect(post).not.toHaveBeenCalled()
    expect(result.pendingSync).toBe(true)
    expect(queued).toEqual([
      { entity: 'invoice', operation: 'create', clientId: 'k2', payload: input },
    ])
  })

  it('the request never got an answer: queued', async () => {
    post.mockRejectedValue({ status: 500, code: 'NETWORK_ERROR', message: 'Network Error' })
    const result = await submitInvoice({ ...input, idempotencyKey: 'k3' })
    expect(result.pendingSync).toBe(true)
    expect(queued).toHaveLength(1)
  })

  it('⚠️ the server REFUSED it: shown, never queued (a queued refusal is retried forever)', async () => {
    post.mockRejectedValue({ status: 400, code: 'INSUFFICIENT_STOCK', message: 'stock' })
    await expect(submitInvoice({ ...input, idempotencyKey: 'k4' })).rejects.toMatchObject({
      status: 400,
    })
    post.mockRejectedValue({ status: 500, code: 'UNKNOWN_ERROR', message: 'boom' })
    await expect(submitInvoice({ ...input, idempotencyKey: 'k5' })).rejects.toMatchObject({
      status: 500,
    })
    expect(queued).toEqual([])
  })

  it('⚠️ no idempotency key: never queued — a replay could be a second sale', async () => {
    offline = true
    post.mockRejectedValue({ status: 500, code: 'NETWORK_ERROR', message: 'Network Error' })
    await expect(submitInvoice({ ...input })).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(queued).toEqual([])
  })
})
