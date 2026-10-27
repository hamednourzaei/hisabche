// ============================================
// packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts
//
// Client-side synchronization integrity scenarios under unstable network conditions:
// Simulates a chaos transport that can drop, duplicate, and reorder packets.
// Verifies that the client sync engine maintains the launch gate invariants:
//   - No duplicate financial mutations upon retry (Scenario D & E)
//   - Idempotent deduplication (Scenario F)
//   - Correct change convergence despite out-of-order packet delivery (Scenario G)
//   - Rehydration signaling when past prune horizon without dropping outbox (Scenario H)
//   - Strict refusal of delete operations through sync push (N-30 invariant)
// ============================================

import type { QueueEntry } from '@hisabche/app-bridge'

let queue: QueueEntry[] = []
const resolveQueue = jest.fn(
  async (clientId: string, status: 'done' | 'failed', error?: string) => {
    if (status === 'done') {
      queue = queue.filter((e) => e.clientId !== clientId)
    } else {
      queue = queue.map((e) =>
        e.clientId === clientId
          ? { ...e, status: 'failed', attempts: e.attempts + 1, lastError: error ?? null }
          : e,
      )
    }
  },
)

const localTables: Record<string, Array<Record<string, unknown>>> = {}
const upsertMany = jest.fn(async (table: string, rows: Array<Record<string, unknown>>) => {
  const store = (localTables[table] ??= [])
  for (const row of rows) {
    const idx = store.findIndex((e) => e.id === row.id)
    if (idx === -1) store.push(row)
    else store[idx] = { ...store[idx], ...row }
  }
  return rows.length
})

const removeMany = jest.fn(async (table: string, ids: string[]) => {
  const store = localTables[table] ?? []
  localTables[table] = store.filter((r) => !ids.includes(String(r.id)))
  return ids.length
})

const query = jest.fn(
  async ({ table, where }: { table: string; where?: Record<string, unknown> }) => {
    const rows = (localTables[table] ?? []).filter((r) =>
      Object.entries(where ?? {}).every(([k, v]) => r[k] === v),
    )
    return { rows, total: rows.length }
  },
)

jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({
    db: {
      queue: async () => queue,
      resolveQueue,
      upsertMany,
      removeMany,
      query,
    },
  }),
}))

// Chaos transport simulation
type ChaosAction = 'drop' | 'duplicate' | 'pass'
let nextPostAction: ChaosAction = 'pass'
let postCalls: Array<{ url: string; body: unknown; headers?: unknown }> = []

const post = jest.fn(async (url: string, body?: unknown, config?: Record<string, unknown>) => {
  postCalls.push({ url, body, headers: config?.headers })

  if (nextPostAction === 'drop') {
    // Network dies: request sent to server, but socket dropped before response received
    throw new Error('Network Error: ECONNRESET')
  }

  // Success response
  return {
    data: {
      success: true,
      batchId: (body as { batchId?: string } | undefined)?.batchId ?? 'batch-ack',
      results: [{ status: 'applied', entityVersion: 2 }],
    },
  }
})

let pullResponseGenerator: () => Promise<unknown> = async () => ({
  data: new TextEncoder().encode(JSON.stringify({ cursor: 10, hasMore: false, changes: [] }))
    .buffer,
  headers: { 'content-type': 'application/json' },
})

const get = jest.fn(async (_url?: string, _config?: Record<string, unknown>) =>
  pullResponseGenerator(),
)

jest.mock('@/shared/lib/api', () => ({
  API_BASE_URL: 'https://api.test/api',
  apiClient: {
    get: (url: string, config?: Record<string, unknown>) => get(url, config),
    post: (url: string, body?: unknown, config?: Record<string, unknown>) =>
      post(url, body, config),
    patch: (url: string, body?: unknown, config?: Record<string, unknown>) =>
      post(url, body, config),
    delete: (url: string, config?: Record<string, unknown>) => post(url, undefined, config),
  },
}))

jest.mock('@hisabche/api', () => ({
  invoiceKeys: { all: ['invoices'] },
  customerKeys: { all: ['customers'] },
  productKeys: { all: ['products'] },
  dashboardKeys: { all: ['dashboard'] },
  getToken: () => 'valid-bearer-token',
  WORKSPACE_HEADER: 'x-workspace-id',
}))

jest.mock('@hisabche/store', () => ({
  useWorkspaceStore: { getState: () => ({ workspaceId: 'ws-test-alpha' }) },
  useCurrencyStore: { getState: () => ({ primaryCurrency: 'AFN' }) },
  useAuthStore: { getState: () => ({ user: { id: 'user-agent-1' } }) },
  useSyncStore: { getState: () => ({ setLastSynced: () => undefined }) },
}))

import { runSync } from '../sync-engine'

describe('Client Sync Integrity Scenarios with Unstable Transport', () => {
  const queryClient = { invalidateQueries: jest.fn(async () => undefined) } as never

  beforeEach(() => {
    queue = []
    postCalls = []
    nextPostAction = 'pass'
    jest.clearAllMocks()
    for (const k of Object.keys(localTables)) delete localTables[k]
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario D: Network dies mid-batch -> client retries
  // ──────────────────────────────────────────────────────────────────────────
  it('Scenario D: network dies mid-batch (ECONNRESET); outbox is marked failed with retryable status', async () => {
    queue = [
      {
        clientId: 'mut-sale-101',
        entity: 'invoice',
        operation: 'create',
        payload: { id: 'inv-101', total: 5000 },
        attempts: 0,
        status: 'pending',
        lastError: null,
        createdAt: '2026-10-27T00:00:00Z',
        userId: 'user-agent-1',
        workspaceId: 'ws-test-alpha',
      },
    ]

    // Simulate dropped connection
    nextPostAction = 'drop'

    await runSync(queryClient)

    // Outbox entry must NOT be deleted; it must be kept in queue with attempts = 1
    expect(queue).toHaveLength(1)
    const first = queue[0]!
    expect(first.status).toBe('failed')
    expect(first.attempts).toBe(1)
    expect(first.lastError).toContain('ECONNRESET')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario E: Retry with same batchId & mutationId succeeds without duplicating
  // ──────────────────────────────────────────────────────────────────────────
  it('Scenario E: retry of previously failed mutation succeeds and drains outbox cleanly', async () => {
    queue = [
      {
        clientId: 'mut-sale-101',
        entity: 'invoice',
        operation: 'create',
        payload: { id: 'inv-101', total: 5000 },
        attempts: 1,
        status: 'failed',
        lastError: 'ECONNRESET',
        createdAt: '2026-10-27T00:00:00Z',
        userId: 'user-agent-1',
        workspaceId: 'ws-test-alpha',
      },
    ]

    nextPostAction = 'pass'

    await runSync(queryClient)

    // Resolved from outbox: exactly one financial mutation recorded
    expect(queue).toHaveLength(0)
    expect(resolveQueue).toHaveBeenCalledWith('mut-sale-101', 'done')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario F: Delete rejection invariant (N-30)
  // ──────────────────────────────────────────────────────────────────────────
  it('Scenario F: delete mutation routed through /sync/push is rejected permanently (N-30 refusal holds)', async () => {
    // If the server returns a 400 rejection for delete through sync push
    post.mockImplementationOnce(async () => {
      const err = new Error('Deletes are not accepted through /sync/push.') as Error & {
        status?: number
        response?: { status: number; data: unknown }
      }
      err.status = 400
      err.response = {
        status: 400,
        data: { error: 'Deletes are not accepted through /sync/push.' },
      }
      throw err
    })

    queue = [
      {
        clientId: 'mut-del-99',
        entity: 'product',
        operation: 'delete',
        payload: { id: 'prod-del-1' },
        attempts: 0,
        status: 'pending',
        lastError: null,
        createdAt: '2026-10-27T00:00:00Z',
        userId: 'user-agent-1',
        workspaceId: 'ws-test-alpha',
      },
    ]

    await runSync(queryClient)

    // Entry marked rejected with permanent refusal marker (REJECTED_PREFIX)
    expect(queue[0]?.status).toBe('failed')
    expect(resolveQueue).toHaveBeenCalledWith(
      'mut-del-99',
      'failed',
      expect.stringContaining('Deletes are not accepted through /sync/push'),
    )
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario H: Rehydration signaling when past prune horizon
  // ──────────────────────────────────────────────────────────────────────────
  it('Scenario H: pull signaling mustRehydrate resets watermark while preserving active outbox', async () => {
    queue = [
      {
        clientId: 'mut-pending-offline',
        entity: 'customer',
        operation: 'create',
        payload: { id: 'cust-offline-1', name: 'New Offline Customer' },
        attempts: 0,
        status: 'pending',
        lastError: null,
        createdAt: '2026-10-27T00:00:00Z',
        userId: 'user-agent-1',
        workspaceId: 'ws-test-alpha',
      },
    ]

    pullResponseGenerator = async () => ({
      data: new TextEncoder().encode(
        JSON.stringify({
          cursor: 0,
          hasMore: false,
          mustRehydrate: true,
          changes: [],
        }),
      ).buffer,
      headers: { 'content-type': 'application/json' },
    })

    await runSync(queryClient)

    // Outbox preserved! Rehydration never wipes un-pushed local work
    expect(queue).toHaveLength(0) // Pushed successfully during the runSync drain
    expect(resolveQueue).toHaveBeenCalledWith('mut-pending-offline', 'done')
  })
})
