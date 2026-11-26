// ============================================
// packages/app-shell/src/features/sync/__tests__/sync-outcome.test.ts
//
// Verifies X03 SyncEngine outcome reporting:
//   - pull failure returns { ok: false, pullOk: false } and NEVER updates lastSyncedAt
//   - clean push + pull returns { ok: true } and updates lastSyncedAt
// ============================================

import type { QueueEntry } from '@hisabche/app-bridge'
import type { QueryClient } from '@tanstack/react-query'

let shouldFailPull = false
let lastSyncedTimestamp: number | null = null
const setLastSynced = jest.fn((ts: number) => {
  lastSyncedTimestamp = ts
})

jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({
    db: {
      queue: async (): Promise<QueueEntry[]> => [],
      resolveQueue: jest.fn(async () => undefined),
      enqueue: jest.fn(async () => undefined),
      upsertMany: jest.fn(async () => 0),
      removeMany: jest.fn(async () => 0),
      query: jest.fn(async () => ({ rows: [], total: 0 })),
    },
  }),
}))

jest.mock('@/shared/lib/api', () => ({
  API_BASE_URL: 'https://api.test/api',
  apiClient: {
    get: jest.fn(async (url: string) => {
      if (shouldFailPull) throw new Error('PULL_NETWORK_FAILURE')
      if (url.includes('/sync/cursor')) {
        return { data: { cursor: 10 }, headers: { 'content-type': 'application/json' } }
      }
      if (url.includes('/sync/snapshot')) {
        return {
          data: new TextEncoder().encode(
            JSON.stringify({ rows: [], hasMore: false, nextAfter: null }),
          ).buffer,
          headers: { 'content-type': 'application/json' },
        }
      }
      return {
        data: new TextEncoder().encode(
          JSON.stringify({ nextCursor: 10, hasMore: false, mustRehydrate: false, changes: [] }),
        ).buffer,
        headers: { 'content-type': 'application/json' },
      }
    }),
    post: jest.fn(async () => ({ data: { success: true } })),
    put: jest.fn(async () => ({ data: { success: true } })),
    patch: jest.fn(async () => ({ data: { success: true } })),
    delete: jest.fn(async () => ({ data: { success: true } })),
  },
}))

jest.mock('@hisabche/api', () => ({
  invoiceKeys: { all: ['invoices'] },
  customerKeys: { all: ['customers'] },
  productKeys: { all: ['products'] },
  dashboardKeys: { all: ['dashboard'] },
  getToken: () => 'valid-bearer-token',
  getAppEdition: () => 'online',
  WORKSPACE_HEADER: 'x-workspace-id',
}))

jest.mock('@hisabche/store', () => ({
  useWorkspaceStore: { getState: () => ({ workspaceId: 'ws-outcome-1' }) },
  useCurrencyStore: { getState: () => ({ primaryCurrency: 'AFN' }) },
  useAuthStore: { getState: () => ({ user: { id: 'user-outcome-1' } }) },
  useSyncStore: { getState: () => ({ setLastSynced }) },
}))

import { runSync } from '../sync-engine'

describe('SyncEngine runSync outcome reporting (X03)', () => {
  const queryClient = {
    invalidateQueries: jest.fn(async () => undefined),
  } as unknown as QueryClient

  beforeEach(() => {
    shouldFailPull = false
    lastSyncedTimestamp = null
    jest.clearAllMocks()
  })

  it('returns status=partial and ok=false when pullAll throws after clean push', async () => {
    shouldFailPull = true
    const outcome = await runSync(queryClient)
    expect(outcome.pushOk).toBe(true)
    expect(outcome.pullOk).toBe(false)
    expect(outcome.ok).toBe(false)
    expect(outcome.status).toBe('partial')
    expect(outcome.error).toContain('PULL_NETWORK_FAILURE')
    expect(setLastSynced).not.toHaveBeenCalled()
    expect(lastSyncedTimestamp).toBeNull()
  })

  it('returns status=success and ok=true and calls setLastSynced when both push and pull succeed', async () => {
    shouldFailPull = false
    const outcome = await runSync(queryClient)
    expect(outcome).toMatchObject({
      ok: true,
      status: 'success',
      pushOk: true,
      pullOk: true,
      pushFailureCount: 0,
      conflictCount: 0,
      failures: [],
    })
    expect(setLastSynced).toHaveBeenCalledTimes(1)
    expect(typeof lastSyncedTimestamp).toBe('number')
  })
})
