// ============================================
// The outbox belongs to the account that made the change.
//
// A queued row is somebody's work. Without an owner, the next account to sign
// in on this device sends it under their own token — into another business's
// books. And a change made in one business must go to THAT business, even
// while another one is open here.
// ============================================

import type { QueueEntry } from '@hisabche/app-bridge'

const queue: QueueEntry[] = []
const resolveQueue = jest.fn(async () => {})
const upsertMany = jest.fn(async () => 0)
const removeMany = jest.fn(async () => 0)
const query = jest.fn(async () => ({ rows: [] as Array<Record<string, unknown>>, total: 0 }))
const enqueue = jest.fn(async () => {})

jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({
    db: { queue: async () => queue, resolveQueue, upsertMany, removeMany, query, enqueue },
  }),
}))

const post = jest.fn(async (..._args: unknown[]) => ({ data: { id: 'inv-1' } }))
const get = jest.fn(async (..._args: unknown[]) => {
  throw new Error('NO_PULL_IN_THIS_TEST')
})
jest.mock('@/shared/lib/api', () => ({
  API_BASE_URL: 'https://api.test/api',
  apiClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}))
jest.mock('@hisabche/api', () => ({
  invoiceKeys: {},
  customerKeys: {},
  productKeys: {},
  dashboardKeys: {},
  getToken: () => 'token',
  WORKSPACE_HEADER: 'x-workspace-id',
}))
jest.mock('@hisabche/store', () => ({
  useWorkspaceStore: { getState: () => ({ workspaceId: 'ws-active' }) },
  useCurrencyStore: { getState: () => ({ primaryCurrency: 'AFN' }) },
  useAuthStore: { getState: () => ({ user: { id: 'user-a' } }) },
  // The sync centre's «last heard from the server» stamp (F2.4).
  useSyncStore: { getState: () => ({ setLastSynced: () => undefined }) },
}))

import { runSync } from '../sync-engine'
import { claimOwnerlessEntries, headersForEntry, isOwnedBy } from '../outbox-owner'

const entry = (over: Partial<QueueEntry> = {}): QueueEntry => ({
  clientId: 'c1',
  entity: 'invoice',
  operation: 'create',
  payload: { id: 'inv-1', customer_id: 'cust-1' },
  attempts: 0,
  status: 'pending',
  lastError: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  userId: 'user-a',
  workspaceId: 'ws-a',
  ...over,
})

const queryClient = { invalidateQueries: jest.fn(async () => {}) } as never

beforeEach(() => {
  queue.length = 0
  post.mockClear()
  enqueue.mockClear()
})

describe('who may send a queued change', () => {
  it('the account that made it', () => {
    expect(isOwnedBy(entry({ userId: 'user-a' }), 'user-a')).toBe(true)
  })

  it('another account: not this person’s to send', () => {
    expect(isOwnedBy(entry({ userId: 'user-b' }), 'user-a')).toBe(false)
  })

  it('a row with no owner: never sent on a guess', () => {
    expect(isOwnedBy(entry({ userId: null }), 'user-a')).toBe(false)
  })

  it('nobody signed in: nothing is sent', () => {
    expect(isOwnedBy(entry({ userId: 'user-a' }), null)).toBe(false)
  })
})

describe('the drain', () => {
  it('⚠️ a row with no owner is never sent', async () => {
    queue.push(entry({ clientId: 'c-ownerless', userId: null, workspaceId: null }))

    await runSync(queryClient)

    expect(post).not.toHaveBeenCalled()
  })

  it('⚠️ another account’s row is not sent', async () => {
    queue.push(entry({ clientId: 'c-other', userId: 'user-b', workspaceId: 'ws-b' }))

    await runSync(queryClient)

    expect(post).not.toHaveBeenCalled()
  })

  it('the account’s own row is sent — with ITS OWN workspace, not the active one', async () => {
    queue.push(entry({ clientId: 'c-mine', userId: 'user-a', workspaceId: 'ws-a' }))

    await runSync(queryClient)

    expect(post).toHaveBeenCalledTimes(1)
    const headers = (post.mock.calls[0]?.[2] as { headers?: Record<string, string> } | undefined)
      ?.headers
    expect(headers?.['x-workspace-id']).toBe('ws-a')
    expect(headers?.['x-workspace-id']).not.toBe('ws-active')
  })
})

describe('the explicit action', () => {
  it('the person claims the rows that have no owner, and then they are sent', async () => {
    const ownerless = entry({ clientId: 'c-ownerless', userId: null, workspaceId: null })
    queue.push(ownerless)

    const claimed = await claimOwnerlessEntries([ownerless], {
      userId: 'user-a',
      workspaceId: 'ws-active',
    })

    expect(claimed).toBe(1)
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'c-ownerless',
        userId: 'user-a',
        workspaceId: 'ws-active',
      }),
    )

    // The row now belongs to this account, so the drain sends it.
    queue[0] = { ...ownerless, userId: 'user-a', workspaceId: 'ws-active' }
    await runSync(queryClient)

    expect(post).toHaveBeenCalledTimes(1)
  })

  it('a row that already has an owner is not claimed again', async () => {
    const owned = entry({ clientId: 'c-owned', userId: 'user-b' })

    const claimed = await claimOwnerlessEntries([owned], { userId: 'user-a', workspaceId: 'ws' })

    expect(claimed).toBe(0)
    expect(enqueue).not.toHaveBeenCalled()
  })
})

describe('the headers a change travels with', () => {
  it('the row’s own workspace, and its own idempotency key', () => {
    expect(headersForEntry(entry({ clientId: 'c9', workspaceId: 'ws-b' }))).toEqual({
      'Idempotency-Key': 'c9',
      'x-workspace-id': 'ws-b',
    })
  })

  it('no workspace on the row: no workspace header', () => {
    expect(headersForEntry(entry({ workspaceId: null }))).toEqual({ 'Idempotency-Key': 'c1' })
  })
})
