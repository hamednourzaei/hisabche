// ============================================
// PENDING_CREDIT_VALIDATION (V53 OD-3): an invoice made offline that takes the customer past their credit
// limit is kept whole on the device, refused by the server on sync, shown as waiting for approval, and
// re-sent — same clientId, so the same Idempotency-Key — only with an approver's reason.
//
// The sync engine runs for real; only the network (a server that applies the credit rule) and the device
// database (an in-memory outbox) are stubbed. The device never decides the credit question itself.
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

jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({
    db: {
      queue: async () => queue,
      resolveQueue,
      // The real enqueue is an upsert by clientId: the payload is replaced, attempts and error reset.
      enqueue: async (e: { clientId: string; payload: Record<string, unknown> }) => {
        queue = queue.map((q) =>
          q.clientId === e.clientId
            ? { ...q, payload: e.payload, attempts: 0, status: 'pending' as const, lastError: null }
            : q,
        )
      },
      upsertMany: async () => 0,
      removeMany: async () => 0,
      query: async () => ({ rows: [], total: 0 }),
    },
  }),
}))

// ─── The server's credit rule, as the backend applies it ────────────────────
type ServerError = Error & { status?: number }
const refuse = (status: number, message: string): never => {
  const error = new Error(message) as ServerError
  error.status = status
  throw error
}

let mayOverride = true
let created: Array<{ key: string; body: Record<string, unknown> }> = []
const post = jest.fn(async (url: string, body?: unknown, config?: Record<string, unknown>) => {
  const payload = (body ?? {}) as Record<string, unknown>
  const key = String((config?.headers as Record<string, string> | undefined)?.['Idempotency-Key'])
  if (url !== '/invoices') return { data: { success: true, results: [{ status: 'applied' }] } }

  // A repeat of an invoice the server already made answers with that invoice: no second sale.
  if (created.some((c) => c.key === key)) return { data: { id: 'inv-1', idempotentReplay: true } }

  const reason = (payload.creditOverride as { reason?: string } | undefined)?.reason
  if (payload.overLimit) {
    if (!reason) return refuse(409, 'CREDIT_LIMIT_EXCEEDED: over by 100')
    if (!mayOverride) return refuse(403, 'CREDIT_OVERRIDE_FORBIDDEN')
  }
  created.push({ key, body: payload })
  return { data: { id: 'inv-1' } }
})

const get = jest.fn(async (_url?: string, _config?: Record<string, unknown>) => ({
  data: new TextEncoder().encode(JSON.stringify({ cursor: 1, hasMore: false, changes: [] })).buffer,
  headers: { 'content-type': 'application/json' },
}))

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
import { REJECTED_PREFIX, creditRefusalOf, stageOf, withCreditOverride } from '../outbox-stage'

const sale = (over: Record<string, unknown> = {}): QueueEntry => ({
  clientId: 'mut-credit-1',
  entity: 'invoice',
  operation: 'create',
  payload: { id: 'inv-1', total: 600, customerId: 'cust-1', overLimit: true, ...over },
  attempts: 0,
  status: 'pending',
  lastError: null,
  createdAt: '2026-11-03T00:00:00Z',
  userId: 'user-agent-1',
  workspaceId: 'ws-test-alpha',
})

describe('PENDING_CREDIT_VALIDATION', () => {
  const queryClient = { invalidateQueries: jest.fn(async () => undefined) } as never
  const stageNow = () => stageOf(queue[0]!, new Set(), 5)

  beforeEach(() => {
    queue = [sale()]
    created = []
    mayOverride = true
    jest.clearAllMocks()
  })

  it('an over-limit sale is refused on sync, kept whole, and waits for approval', async () => {
    await runSync(queryClient)

    expect(created).toHaveLength(0) // nothing was made on the server
    expect(queue).toHaveLength(1) // and nothing was thrown away on the device
    expect(queue[0]?.lastError).toBe(`${REJECTED_PREFIX}CREDIT_LIMIT_EXCEEDED: over by 100`)
    expect(stageNow()).toBe('credit_validation')
    expect(creditRefusalOf(queue[0]?.lastError)).toEqual({
      code: 'CREDIT_LIMIT_EXCEEDED',
      overBy: '100',
    })
    expect(queue[0]?.payload.total).toBe(600)
  })

  it('a refusal is not retried by itself — only a person moves it', async () => {
    await runSync(queryClient)
    const callsAfterFirst = post.mock.calls.length
    await runSync(queryClient)
    await runSync(queryClient)
    expect(post.mock.calls.length).toBe(callsAfterFirst)
    expect(stageNow()).toBe('credit_validation')
  })

  it('a sale inside the limit goes through untouched', async () => {
    queue = [sale({ overLimit: false })]
    await runSync(queryClient)
    expect(created).toHaveLength(1)
    expect(queue).toHaveLength(0)
  })

  it('approval needs a reason: none, empty, and one letter send nothing', () => {
    const payload = queue[0]!.payload
    expect(withCreditOverride(payload, '')).toBeNull()
    expect(withCreditOverride(payload, '   ')).toBeNull()
    expect(withCreditOverride(payload, 'x')).toBeNull()
    expect(payload).not.toHaveProperty('creditOverride')
  })

  it('approved: the SAME clientId is re-sent with the reason, and the sale is made once', async () => {
    await runSync(queryClient)
    const approved = withCreditOverride(queue[0]!.payload, '  تأیید تلفنی مدیر ')!
    queue = queue.map((q) => ({
      ...q,
      payload: approved,
      attempts: 0,
      status: 'pending',
      lastError: null,
    }))

    await runSync(queryClient)

    expect(created).toHaveLength(1)
    expect(created[0]?.key).toBeDefined()
    expect(created[0]?.body.creditOverride).toEqual({ reason: 'تأیید تلفنی مدیر' })
    expect(queue).toHaveLength(0)
  })

  it('without the permission the server refuses the approval, and the sale stays recoverable', async () => {
    mayOverride = false
    await runSync(queryClient)
    queue = queue.map((q) => ({
      ...q,
      payload: withCreditOverride(q.payload, 'ok, I say so')!,
      attempts: 0,
      status: 'pending',
      lastError: null,
    }))

    await runSync(queryClient)

    expect(created).toHaveLength(0)
    expect(queue).toHaveLength(1)
    expect(queue[0]?.lastError).toBe(`${REJECTED_PREFIX}CREDIT_OVERRIDE_FORBIDDEN`)
    // It is a different refusal now: not a credit question any more, a permission one.
    expect(stageNow()).toBe('rejected')
    expect(queue[0]?.payload.total).toBe(600)
  })

  it('duplicate delivery of an approved sale does not make a second one', async () => {
    await runSync(queryClient)
    const approved = withCreditOverride(queue[0]!.payload, 'approved by phone')!
    const approvedEntry = {
      ...queue[0]!,
      payload: approved,
      attempts: 0,
      status: 'pending' as const,
      lastError: null,
    }

    queue = [approvedEntry]
    await runSync(queryClient)
    expect(created).toHaveLength(1)

    // The same entry arrives again (a lost acknowledgement).
    queue = [approvedEntry]
    await runSync(queryClient)
    expect(created).toHaveLength(1)
    expect(queue).toHaveLength(0)
  })

  it('the device never decides: the payload it sends carries no limit, exposure or verdict of its own', () => {
    const keys = Object.keys(withCreditOverride(queue[0]!.payload, 'because')!)
    expect(keys).not.toContain('creditLimit')
    expect(keys).not.toContain('creditVerdict')
  })

  it('another refusal is never mistaken for a credit one', () => {
    expect(creditRefusalOf(`${REJECTED_PREFIX}INVOICE_EXCHANGE_RATE_REQUIRED`)).toBeNull()
    expect(creditRefusalOf('CREDIT_LIMIT_EXCEEDED')).toBeNull() // a network-style failure, not a refusal
    expect(creditRefusalOf(null)).toBeNull()
  })
})
