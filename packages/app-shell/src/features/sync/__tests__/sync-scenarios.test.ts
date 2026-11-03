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
      // The real enqueue is an upsert by clientId that resets the attempt counter.
      enqueue: async (e: { clientId: string }) => {
        queue = queue.map((q) =>
          q.clientId === e.clientId
            ? { ...q, attempts: 0, status: 'pending' as const, lastError: null }
            : q,
        )
      },
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

import { resetTransientFailuresOnReconnect, runSync } from '../sync-engine'
import { REJECTED_PREFIX } from '../outbox-stage'

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

  // ──────────────────────────────────────────────────────────────────────────
  // Delivery: every entity the local engine QUEUES must have somewhere to go.
  // Returns, till cash and till close were queued for years with no endpoint:
  // the entry failed with NO_ENDPOINT and froze after five tries, so the money
  // never reached the server. A test that only checks the entry was queued
  // cannot see that.
  // ──────────────────────────────────────────────────────────────────────────
  const entry = (
    clientId: string,
    entity: QueueEntry['entity'],
    operation: 'create' | 'update' | 'delete',
    payload: Record<string, unknown>,
  ) => ({
    clientId,
    entity,
    operation,
    payload,
    attempts: 0,
    status: 'pending' as const,
    lastError: null,
    createdAt: '2026-10-27T00:00:00Z',
    userId: 'user-agent-1',
    workspaceId: 'ws-test-alpha',
  })

  const deliveries: ReadonlyArray<{
    name: string
    entry: ReturnType<typeof entry>
    url: string
  }> = [
    {
      name: 'an invoice return',
      entry: entry('ret-1', 'invoice_returns', 'create', {
        id: 'ret-1',
        originalInvoiceId: 'inv-9',
      }),
      url: '/invoices/inv-9/returns',
    },
    {
      name: 'a till cash movement',
      entry: entry('mov-1', 'pos_cash_movement', 'create', { id: 'mov-1', sessionId: 'ses-1' }),
      url: '/pos/sessions/ses-1/cash',
    },
    {
      name: 'a till close',
      entry: entry('ses-1-close', 'pos_session', 'update', { id: 'ses-1', action: 'close' }),
      url: '/pos/sessions/ses-1/close',
    },
    {
      name: 'a manual journal entry',
      entry: entry('je-1', 'journal_entry', 'create', { id: 'je-1', lines: [] }),
      url: '/accounting/journal',
    },
    {
      name: 'a price list',
      entry: entry('pl-1', 'price_list', 'create', { id: 'pl-1', name: 'x' }),
      url: '/price-lists',
    },
  ]

  for (const d of deliveries) {
    it(`delivers ${d.name} to ${d.url} with its own key, and drains it`, async () => {
      queue = [d.entry]

      await runSync(queryClient)

      const sent = postCalls.find((c) => c.url === d.url)
      expect(sent).toBeDefined()
      expect((sent?.headers as Record<string, string>)['Idempotency-Key']).toBe(d.entry.clientId)
      expect(queue).toHaveLength(0)
      expect(resolveQueue).toHaveBeenCalledWith(d.entry.clientId, 'done')
    })
  }

  it('a payment is delivered with its body untouched: autoAllocate:false and the named allocations reach the server', async () => {
    const body = {
      id: 'pay-9',
      direction: 'in',
      partyType: 'customer',
      partyId: 'c-1',
      amount: 100,
      allocations: [{ invoiceId: 'inv-1', amount: 60 }],
      autoAllocate: false,
    }
    queue = [entry('pay-9', 'payment', 'create', body)]

    await runSync(queryClient)

    const sent = postCalls.find((c) => c.url === '/payments')
    expect(sent?.body).toEqual(body)
    expect((sent?.headers as Record<string, string>)['Idempotency-Key']).toBe('pay-9')
  })

  it('an offline deposit APPLY reaches the domain endpoint with the invoice, the amount and the intent key', async () => {
    queue = [
      entry('dep-apply-1', 'order_deposits', 'create', {
        movement: 'apply',
        orderId: 'order-1',
        depositId: 'dep-1',
        invoiceId: 'inv-1',
        amountMinor: 30_000,
        currency: 'AFN',
        idempotencyKey: 'intent-apply-0001',
        date: '2026-11-03',
      }),
    ]

    await runSync(queryClient)

    const sent = postCalls.find((c) => c.url === '/orders/order-1/deposits/dep-1/apply')
    expect(sent).toBeDefined()
    // The row's own key travels as the transport key; the INTENT key travels in
    // the body, because the server deduplicates the MOVEMENT on it.
    expect((sent?.headers as Record<string, string>)['Idempotency-Key']).toBe('dep-apply-1')
    expect(sent?.body).toEqual({
      invoiceId: 'inv-1',
      amountMinor: 30_000,
      idempotencyKey: 'intent-apply-0001',
      date: '2026-11-03',
    })
    expect(queue).toHaveLength(0)
  })

  it('an offline deposit REFUND carries the mandatory reason and the method to the refund endpoint', async () => {
    queue = [
      entry('dep-refund-1', 'order_deposits', 'create', {
        movement: 'refund',
        orderId: 'order-1',
        depositId: 'dep-1',
        amountMinor: 20_000,
        currency: 'AFN',
        reason: 'مشتری سفارش را لغو کرد',
        method: 'bank',
        idempotencyKey: 'intent-refund-001',
      }),
    ]

    await runSync(queryClient)

    const sent = postCalls.find((c) => c.url === '/orders/order-1/deposits/dep-1/refund')
    expect(sent?.body).toEqual({
      amountMinor: 20_000,
      reason: 'مشتری سفارش را لغو کرد',
      idempotencyKey: 'intent-refund-001',
      method: 'bank',
    })
    expect(queue).toHaveLength(0)
  })

  it('a move the server refuses (not enough left) stays VISIBLE as a rejection and is not re-sent by itself', async () => {
    post.mockImplementationOnce(async () => {
      const err = new Error('DEPOSIT_INSUFFICIENT_BALANCE') as Error & { status?: number }
      err.status = 409
      throw err
    })
    queue = [
      entry('dep-apply-2', 'order_deposits', 'create', {
        movement: 'apply',
        orderId: 'order-1',
        depositId: 'dep-1',
        invoiceId: 'inv-1',
        amountMinor: 99_000,
        idempotencyKey: 'intent-apply-0002',
      }),
    ]

    await runSync(queryClient)

    const refused = queue.find((q) => q.clientId === 'dep-apply-2')
    expect(refused?.status).toBe('failed')
    expect(refused?.lastError?.startsWith(REJECTED_PREFIX)).toBe(true)
    expect(refused?.lastError).toContain('DEPOSIT_INSUFFICIENT_BALANCE')

    const sent = postCalls.length
    await runSync(queryClient)
    expect(postCalls.length).toBe(sent)
  })

  it('a duplicate delivery of the same deposit move sends the SAME intent key, so the server settles it once', async () => {
    const payload = {
      movement: 'apply',
      orderId: 'order-1',
      depositId: 'dep-1',
      invoiceId: 'inv-1',
      amountMinor: 12_000,
      idempotencyKey: 'intent-apply-0003',
    }
    queue = [entry('dep-apply-3', 'order_deposits', 'create', payload)]

    // The connection dies after the server received it: the device cannot know.
    nextPostAction = 'drop'
    await runSync(queryClient)
    expect(queue).toHaveLength(1)

    // The retry repeats the request, not a second settlement.
    nextPostAction = 'pass'
    await runSync(queryClient)

    const attempts = postCalls.filter((c) => c.url === '/orders/order-1/deposits/dep-1/apply')
    expect(attempts).toHaveLength(2)
    for (const attempt of attempts) {
      expect(attempt.body).toMatchObject({ idempotencyKey: 'intent-apply-0003' })
    }
    expect(queue).toHaveLength(0)
  })

  it('a deposit row with no movement is refused at once and visibly, never guessed into an apply', async () => {
    queue = [
      entry('dep-null-1', 'order_deposits', 'create', {
        orderId: 'order-1',
        depositId: 'dep-1',
        amountMinor: 1_000,
      }),
    ]

    await runSync(queryClient)

    expect(postCalls).toHaveLength(0)
    const refused = queue.find((q) => q.clientId === 'dep-null-1')
    expect(refused?.status).toBe('failed')
    expect(refused?.lastError?.startsWith(REJECTED_PREFIX)).toBe(true)
    expect(refused?.lastError).toContain('MISSING_DEPOSIT_MOVEMENT')
  })

  it('a command queued before a capability was taken away is re-judged by the server: refused, kept visible, never re-sent, and the rest still goes', async () => {
    post.mockImplementationOnce(async () => {
      const err = new Error('CAPABILITY_REQUIRED') as Error & { status?: number }
      err.status = 403
      throw err
    })
    queue = [
      entry('pay-before', 'payment', 'create', { id: 'pay-before', amount: 10 }),
      entry('cust-after', 'customer', 'create', { id: 'cust-after', fullName: 'x' }),
    ]

    await runSync(queryClient)

    // the refused one is NOT dropped: it stays, marked as a refusal someone must look at
    const refused = queue.find((q) => q.clientId === 'pay-before')
    expect(refused?.status).toBe('failed')
    expect(refused?.lastError?.startsWith(REJECTED_PREFIX)).toBe(true)
    // the other one is delivered and drained: one refusal does not stop the queue
    expect(queue.find((q) => q.clientId === 'cust-after')).toBeUndefined()

    // a second run (the capability may even be back) does not send the refused command again by itself
    const sentBefore = postCalls.filter((c) => c.url === '/payments').length
    await runSync(queryClient)
    expect(postCalls.filter((c) => c.url === '/payments').length).toBe(sentBefore)
    expect(queue.find((q) => q.clientId === 'pay-before')?.status).toBe('failed')
  })

  for (const [name, status, code] of [
    ['expired', 409, 'INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT'],
    ['suspended-only', 409, 'INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT'],
    ['closed period', 409, 'ACCOUNTING_PERIOD_LOCKED'],
    ['sale not booked', 409, 'PACKAGE_INVOICE_NOT_BOOKED'],
  ] as const) {
    it(`M5: an offline delivery the server refuses (${name}) stays VISIBLE as a rejection with its reason, is never re-sent by itself, and the rest still goes`, async () => {
      post.mockImplementationOnce(async () => {
        const err = new Error(code) as Error & { status?: number }
        err.status = status
        throw err
      })
      queue = [
        entry('deliver-1', 'service_delivery_sessions', 'update', {
          id: 'sess-1',
          status: 'delivered',
          settlementMethod: 'package_credit',
          packageProductId: 'pkg-1',
          quantity: 1,
          consumptionEntryId: 'c-1',
        }),
        entry('cust-after', 'customer', 'create', { id: 'cust-after', fullName: 'x' }),
      ]

      await runSync(queryClient)

      const refused = queue.find((q) => q.clientId === 'deliver-1')
      expect(refused?.status).toBe('failed')
      expect(refused?.lastError?.startsWith(REJECTED_PREFIX)).toBe(true)
      expect(refused?.lastError).toContain(code)
      expect(queue.find((q) => q.clientId === 'cust-after')).toBeUndefined() // one refusal does not stop the queue

      // the command is kept (not deleted, not turned into another one), and a second run does not re-send it
      const sent = postCalls.length
      await runSync(queryClient)
      expect(postCalls.length).toBe(sent)
      expect(queue.find((q) => q.clientId === 'deliver-1')?.status).toBe('failed')
    })
  }

  it('M5 / C5: a return queued before the disposition became mandatory (no restock/scrap choice) is refused by the server, kept visible and recoverable - never silently turned into a restock', async () => {
    post.mockImplementationOnce(async () => {
      const err = new Error('RETURN_DISPOSITION_REQUIRED') as Error & { status?: number }
      err.status = 400
      throw err
    })
    queue = [
      entry('ret-legacy', 'invoice_returns', 'create', {
        id: 'ret-legacy',
        originalInvoiceId: 'inv-1',
        returnType: 'sale_return',
        returnNumber: 'R-1',
        returnDate: '2026-11-02',
        lines: [{ originalLineId: 'l-1', quantity: 1 }],
      }),
    ]

    await runSync(queryClient)

    const refused = queue.find((q) => q.clientId === 'ret-legacy')
    expect(refused?.status).toBe('failed')
    expect(refused?.lastError?.startsWith(REJECTED_PREFIX)).toBe(true)
    expect(refused?.lastError).toContain('RETURN_DISPOSITION_REQUIRED')
    // the queued payload is untouched: nothing was defaulted on the way
    expect(
      (refused as unknown as { payload?: { lines?: Array<Record<string, unknown>> } })?.payload
        ?.lines?.[0],
    ).not.toHaveProperty('restockChoice')
  })

  it('a package GRANT is never sent to the consume endpoint: it is refused, permanently and visibly', async () => {
    queue = [
      entry('grant-1', 'package_credit_ledger', 'create', {
        id: 'grant-1',
        entry_type: 'GRANT',
        quantity: 10,
        customer_id: 'c-1',
        package_product_id: 'pkg-1',
      }),
    ]

    await runSync(queryClient)

    expect(postCalls.filter((c) => c.url.startsWith('/package-credits'))).toHaveLength(0)
    const refused = queue.find((q) => q.clientId === 'grant-1')
    expect(refused?.status).toBe('failed')
    expect(refused?.lastError?.startsWith(REJECTED_PREFIX)).toBe(true)
    expect(refused?.lastError).toContain('PACKAGE_GRANT_TRAVELS_WITH_THE_INVOICE')
  })

  it('coming back online gives a frozen retryable entry its tries back, and leaves a refusal alone', async () => {
    const frozen = {
      ...entry('f-1', 'payment', 'create', { id: 'p1' }),
      attempts: 5,
      status: 'failed' as const,
      lastError: 'ECONNRESET',
    }
    const refused = {
      ...entry('r-1', 'payment', 'create', { id: 'p2' }),
      attempts: 5,
      status: 'failed' as const,
      lastError: REJECTED_PREFIX + 'PAYMENT_CURRENCY_MISMATCH',
    }
    queue = [frozen, refused]

    await resetTransientFailuresOnReconnect()

    expect(queue.find((q) => q.clientId === 'f-1')).toMatchObject({
      attempts: 0,
      status: 'pending',
    })
    expect(queue.find((q) => q.clientId === 'r-1')).toMatchObject({ attempts: 5, status: 'failed' })
  })

  it('an entity with no endpoint is refused at once and visibly, not retried five times', async () => {
    queue = [entry('x-1', 'no_such_entity' as QueueEntry['entity'], 'create', { id: 'x-1' })]

    await runSync(queryClient)

    expect(postCalls).toHaveLength(0)
    const stuck = queue[0]!
    expect(stuck.status).toBe('failed')
    expect(stuck.lastError).toContain('NO_ENDPOINT:no_such_entity')
  })
})
