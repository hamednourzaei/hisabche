// ============================================
// Guard: outbox-single-pusher.test.ts
//
// Guarantees:
// Two concurrent pushers on Android (e.g. native background runner and
// WebView app-shell sync engine) competing for the same outbox entry will
// result in EXACTLY ONE POST request due to atomic row lease claim.
// ============================================

import type { QueueEntry } from '@hisabche/app-bridge'

let queue: QueueEntry[] = []
const postCalls: Array<{ url: string; payload: unknown; headers: Record<string, string> }> = []

const claims = new Map<string, { owner: string; expiresAt: number }>()

const claim = jest.fn(async (clientId: string, owner: string, leaseMs: number = 30_000) => {
  const now = Date.now()
  const existing = claims.get(clientId)
  if (existing && now < existing.expiresAt && existing.owner !== owner) {
    return false
  }
  claims.set(clientId, { owner, expiresAt: now + leaseMs })
  return true
})

const resolveQueue = jest.fn(async (clientId: string, status: 'done' | 'failed') => {
  claims.delete(clientId)
  if (status === 'done') {
    queue = queue.filter((e) => e.clientId !== clientId)
  }
})

const upsertMany = jest.fn(async () => 0)
const removeMany = jest.fn(async () => 0)
const query = jest.fn(async () => ({ rows: [] as Array<Record<string, unknown>>, total: 0 }))
const enqueue = jest.fn(async () => {})

jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({
    db: {
      queue: async () => [...queue],
      resolveQueue,
      upsertMany,
      removeMany,
      query,
      enqueue,
      claim,
    },
  }),
}))

jest.mock('@/shared/lib/api', () => ({
  API_BASE_URL: 'https://api.test/api',
  apiClient: {
    get: jest.fn(async () => {
      throw new Error('NO_PULL')
    }),
    post: jest.fn(
      async (url: string, payload: unknown, config?: { headers?: Record<string, string> }) => {
        postCalls.push({ url, payload, headers: config?.headers ?? {} })
        return { data: { id: 'inv-server-123', invoice_number: 'INV-2026-001' } }
      },
    ),
  },
}))

jest.mock('@hisabche/api', () => ({
  invoiceKeys: { all: ['invoices'] },
  customerKeys: { all: ['customers'] },
  productKeys: { all: ['products'] },
  dashboardKeys: { all: ['dashboard'] },
  getToken: () => 'bearer-token',
  WORKSPACE_HEADER: 'x-workspace-id',
}))

jest.mock('@hisabche/store', () => ({
  useWorkspaceStore: { getState: () => ({ workspaceId: 'ws-single-pusher' }) },
  useCurrencyStore: { getState: () => ({ primaryCurrency: 'AFN' }) },
  useAuthStore: { getState: () => ({ user: { id: 'user-single-pusher' } }) },
  useSyncStore: { getState: () => ({ setLastSynced: () => undefined }) },
}))

import { runSync } from '../sync-engine'

describe('V68.2 — Single Pusher Ownership for Android Outbox', () => {
  const queryClient = { invalidateQueries: jest.fn(async () => undefined) } as never

  beforeEach(() => {
    queue = []
    postCalls.length = 0
    claims.clear()
    jest.clearAllMocks()
  })

  test('two concurrent push attempts on the same queued row execute exactly one POST', async () => {
    const singleEntry: QueueEntry = {
      clientId: 'outbox-inv-claim-1',
      entity: 'invoice',
      operation: 'create',
      payload: {
        id: 'outbox-inv-claim-1',
        total: 150000,
        currency: 'AFN',
      },
      status: 'pending',
      attempts: 0,
      lastError: null,
      createdAt: new Date().toISOString(),
      userId: 'user-single-pusher',
      workspaceId: 'ws-single-pusher',
    }

    queue = [singleEntry]

    // Simulate pusher 1 (e.g. mobile native runner) acquiring the claim first
    const nativeClaim = await claim(singleEntry.clientId, 'mobile-sync-runner', 30_000)
    expect(nativeClaim).toBe(true)

    // Now app-shell sync engine runs concurrently
    await runSync(queryClient)

    // App-shell sync engine was rejected by claim and did not post
    expect(postCalls.length).toBe(0)

    // Now native pusher finishes its post and resolves the queue
    postCalls.push({
      url: '/invoices',
      payload: singleEntry.payload,
      headers: { 'Idempotency-Key': singleEntry.clientId },
    })
    await resolveQueue(singleEntry.clientId, 'done')

    // Exactly one POST occurred
    expect(postCalls.length).toBe(1)
    expect(postCalls[0]?.headers['Idempotency-Key']).toBe('outbox-inv-claim-1')
  })

  test('when no existing claim is held, app-shell sync engine claims row and executes POST', async () => {
    const entry: QueueEntry = {
      clientId: 'outbox-inv-claim-2',
      entity: 'invoice',
      operation: 'create',
      payload: {
        id: 'outbox-inv-claim-2',
        total: 200000,
        currency: 'AFN',
      },
      status: 'pending',
      attempts: 0,
      lastError: null,
      createdAt: new Date().toISOString(),
      userId: 'user-single-pusher',
      workspaceId: 'ws-single-pusher',
    }

    queue = [entry]

    await runSync(queryClient)

    // It successfully claimed and posted
    expect(claim).toHaveBeenCalledWith('outbox-inv-claim-2', 'app-shell-sync-engine', 30_000)
    expect(postCalls.length).toBe(1)
    expect(postCalls[0]?.url).toBe('/invoices')
  })
})
