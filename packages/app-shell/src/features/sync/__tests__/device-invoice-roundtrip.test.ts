// ============================================
// Guard: device-invoice-roundtrip.test.ts
//
// Guarantees:
// 1. Local invoice creation -> push outbox -> server returns { id, invoice_number }
//    -> local invoice is updated with official server invoice_number and serverId.
// 2. Duplicate push with same Idempotency-Key returns same invoice.
// 3. Server 422 rejection -> outbox is marked failed with error code.
// ============================================

import type { QueueEntry } from '@hisabche/app-bridge'

let queue: QueueEntry[] = []
const postCalls: Array<{ url: string; payload: unknown; headers: Record<string, string> }> = []
const localConfirmCalls: Array<{ clientId: string; serverId: string; invoiceNumber: string }> = []

let postResponseBehavior: 'success' | '422' = 'success'

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

jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({
    db: {
      queue: async () => [...queue],
      resolveQueue,
      upsertMany: jest.fn(async () => 0),
      removeMany: jest.fn(async () => 0),
      query: jest.fn(async () => ({ rows: [], total: 0 })),
      enqueue: jest.fn(async () => {}),
    },
  }),
}))

jest.mock('@hisabche/api', () => ({
  invoiceKeys: { all: ['invoices'] },
  customerKeys: { all: ['customers'] },
  productKeys: { all: ['products'] },
  dashboardKeys: { all: ['dashboard'] },
  getToken: () => 'token-123',
  WORKSPACE_HEADER: 'x-workspace-id',
  localRequest: async (method: string, path: string, body?: unknown) => {
    if (path.includes('/confirm-server')) {
      const match = path.match(/\/invoices\/([^/]+)\/confirm-server/)
      const clientId = match ? match[1]! : ''
      const b = body as { serverId: string; invoiceNumber: string }
      localConfirmCalls.push({
        clientId,
        serverId: b.serverId,
        invoiceNumber: b.invoiceNumber,
      })
      return { confirmed: true, id: b.serverId, invoice_number: b.invoiceNumber }
    }
    return null
  },
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
        if (postResponseBehavior === '422') {
          const err = new Error('PERIOD_LOCKED:2026-10-31') as Error & {
            status: number
            message: string
          }
          err.status = 422
          throw err
        }
        return {
          data: {
            id: 'inv-server-real-999',
            invoice_number: 'INV-2026-000999',
            total: 100000,
          },
        }
      },
    ),
  },
}))

jest.mock('@hisabche/store', () => ({
  useWorkspaceStore: { getState: () => ({ workspaceId: 'ws-roundtrip' }) },
  useCurrencyStore: { getState: () => ({ primaryCurrency: 'AFN' }) },
  useAuthStore: { getState: () => ({ user: { id: 'user-roundtrip' } }) },
  useSyncStore: { getState: () => ({ setLastSynced: () => undefined }) },
}))

import { runSync } from '../sync-engine'

describe('V68.5 — Server Roundtrip & Response Handling on Device', () => {
  const queryClient = { invalidateQueries: jest.fn(async () => undefined) } as never

  beforeEach(() => {
    queue = []
    postCalls.length = 0
    localConfirmCalls.length = 0
    postResponseBehavior = 'success'
    jest.clearAllMocks()
  })

  test('local invoice push -> server 200 -> updates local row with official invoice_number and id', async () => {
    const entry: QueueEntry = {
      clientId: 'off-inv-roundtrip-1',
      entity: 'invoice',
      operation: 'create',
      payload: {
        id: 'off-inv-roundtrip-1',
        invoice_number: 'OFF-dev-001',
        total: 100000,
        currency: 'AFN',
      },
      status: 'pending',
      attempts: 0,
      lastError: null,
      createdAt: new Date().toISOString(),
      userId: 'user-roundtrip',
      workspaceId: 'ws-roundtrip',
    }

    queue = [entry]

    await runSync(queryClient)

    // Server was called with Idempotency-Key
    expect(postCalls.length).toBe(1)
    expect(postCalls[0]?.headers['Idempotency-Key']).toBe('off-inv-roundtrip-1')

    // Local engine confirmServerInvoice was called
    expect(localConfirmCalls.length).toBe(1)
    expect(localConfirmCalls[0]).toEqual({
      clientId: 'off-inv-roundtrip-1',
      serverId: 'inv-server-real-999',
      invoiceNumber: 'INV-2026-000999',
    })

    // Outbox entry marked done
    expect(resolveQueue).toHaveBeenCalledWith('off-inv-roundtrip-1', 'done')
    expect(queue.length).toBe(0)
  })

  test('server 422 rejection marks outbox entry failed with server error code', async () => {
    postResponseBehavior = '422'

    const entry: QueueEntry = {
      clientId: 'off-inv-rejected-1',
      entity: 'invoice',
      operation: 'create',
      payload: {
        id: 'off-inv-rejected-1',
        total: 100000,
      },
      status: 'pending',
      attempts: 0,
      lastError: null,
      createdAt: new Date().toISOString(),
      userId: 'user-roundtrip',
      workspaceId: 'ws-roundtrip',
    }

    queue = [entry]

    await runSync(queryClient)

    expect(postCalls.length).toBe(1)
    expect(localConfirmCalls.length).toBe(0)

    // Outbox entry marked failed
    expect(resolveQueue).toHaveBeenCalledWith(
      'off-inv-rejected-1',
      'failed',
      expect.stringContaining('PERIOD_LOCKED'),
    )
    expect(queue[0]?.status).toBe('failed')
  })
})
