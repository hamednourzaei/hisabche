// ============================================
// packages/app-shell/src/features/sync/__tests__/deposit-pull.test.ts
//
// What a device does with a deposit page that came from another device.
//
// The server half is proved in
// `backend/src/__tests__/order-deposit-sync-pull.test.ts` (the lean pull columns,
// the workspace filter, the push refusal). This is the device half:
//
//   • a device that never saw the deposit stores the receipt AND the movements,
//     so the money already spent is not offered a second time;
//   • the device that MADE a movement recognises its own echo by the
//     idempotency key and does not count the same money twice;
//   • a receipt taken offline reaches `POST /orders/:id/deposits` with the
//     device's own id, so the server writes that row instead of a second one.
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

/** The device's SQLite, as the bridge presents it. */
const localTables: Record<string, Array<Record<string, unknown>>> = {}

const upsertMany = jest.fn(async (table: string, rows: Array<Record<string, unknown>>) => {
  const store = (localTables[table] ??= [])
  for (const row of rows) {
    const index = store.findIndex((existing) => existing.id === row.id)
    if (index === -1) store.push(row)
    else store[index] = { ...store[index], ...row }
  }
  return rows.length
})

const removeMany = jest.fn(async (table: string, ids: string[]) => {
  const store = localTables[table] ?? []
  localTables[table] = store.filter((row) => !ids.includes(String(row.id)))
  return ids.length
})

const query = jest.fn(
  async ({ table, where }: { table: string; where?: Record<string, unknown>; limit?: number }) => {
    const rows = (localTables[table] ?? []).filter((row) =>
      Object.entries(where ?? {}).every(([key, value]) => row[key] === value),
    )
    return { rows, total: rows.length }
  },
)

jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({
    db: {
      queue: async () => queue,
      resolveQueue,
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

const postCalls: Array<{ url: string; body: unknown; headers?: unknown }> = []

const post = jest.fn(async (url: string, body?: unknown, config?: Record<string, unknown>) => {
  postCalls.push({ url, body, headers: config?.headers })
  return {
    data: {
      success: true,
      batchId: 'batch-ack',
      results: [{ status: 'applied', entityVersion: 2 }],
    },
  }
})

const get = jest.fn(async (_url?: string, _config?: Record<string, unknown>) => ({
  data: new TextEncoder().encode(
    JSON.stringify({ cursor: 10, hasMore: false, mustRehydrate: false, changes: [] }),
  ).buffer,
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
  getAppEdition: () => 'cloud',
  WORKSPACE_HEADER: 'x-workspace-id',
}))

jest.mock('@hisabche/store', () => ({
  useWorkspaceStore: { getState: () => ({ workspaceId: 'ws-test-alpha' }) },
  useCurrencyStore: { getState: () => ({ primaryCurrency: 'AFN' }) },
  useAuthStore: { getState: () => ({ user: { id: 'user-agent-1' } }) },
  useSyncStore: { getState: () => ({ setLastSynced: () => undefined }) },
}))

import { applyChanges, runSync, type PullPage } from '../sync-engine'

const WS = 'ws-test-alpha'
const CUSTOMER = '33333333-3333-4333-8333-333333333333'
const ORDER = '22222222-2222-4222-8222-222222222222'
const INVOICE = '44444444-4444-4444-8444-444444444444'
const DEPOSIT = '55555555-5555-4555-8555-555555555555'
const APPLICATION = '66666666-6666-4666-8666-666666666666'
const REFUND = '77777777-7777-4777-8777-777777777777'

function page(changes: PullPage['changes']): PullPage {
  return { changes, nextCursor: changes.length, hasMore: false, mustRehydrate: false }
}

/** The three rows a server sends, already projected to the lean pull columns. */
function serverChanges(): PullPage['changes'] {
  return [
    {
      entityType: 'order_deposits',
      entityId: DEPOSIT,
      operation: 'create',
      data: {
        id: DEPOSIT,
        workspace_id: WS,
        order_id: ORDER,
        customer_id: CUSTOMER,
        amount_minor: 100_000,
        payment_method: 'cash',
        applied_invoice_id: INVOICE,
        currency: 'AFN',
        posting_status: 'posted',
        created_at: '2026-11-01T08:00:00.000Z',
      },
    },
    {
      entityType: 'order_deposit_applications',
      entityId: APPLICATION,
      operation: 'create',
      data: {
        id: APPLICATION,
        workspace_id: WS,
        deposit_id: DEPOSIT,
        invoice_id: INVOICE,
        amount_minor: 40_000,
        currency: 'AFN',
        idempotency_key: 'apply-key-0001',
        created_by: 'user-agent-2',
        created_at: '2026-11-02T08:00:00.000Z',
      },
    },
    {
      entityType: 'order_deposit_refunds',
      entityId: REFUND,
      operation: 'create',
      data: {
        id: REFUND,
        workspace_id: WS,
        deposit_id: DEPOSIT,
        amount_minor: 10_000,
        currency: 'AFN',
        method: 'cash',
        reason: 'بازگشت بخشی از بیعانه',
        idempotency_key: 'refund-key-0001',
        created_by: 'user-agent-2',
        created_at: '2026-11-03T08:00:00.000Z',
      },
    },
  ]
}

function entry(
  clientId: string,
  entity: QueueEntry['entity'],
  payload: Record<string, unknown>,
): QueueEntry {
  return {
    clientId,
    entity,
    operation: 'create',
    payload,
    attempts: 0,
    status: 'pending',
    lastError: null,
    createdAt: '2026-11-03T00:00:00Z',
    userId: 'user-agent-1',
    workspaceId: WS,
  }
}

const queryClient = { invalidateQueries: jest.fn(async () => undefined) } as never

beforeEach(() => {
  queue = []
  postCalls.length = 0
  jest.clearAllMocks()
  for (const key of Object.keys(localTables)) delete localTables[key]
})

describe('a deposit page from another device', () => {
  it('a device that never saw the deposit stores the receipt and both movements', async () => {
    const written = await applyChanges(page(serverChanges()))

    // One row per change, three changes.
    expect(written).toBe(3)

    const deposits = localTables.order_deposits ?? []
    const applications = localTables.order_deposit_applications ?? []
    const refunds = localTables.order_deposit_refunds ?? []

    expect(deposits).toHaveLength(1)
    expect(deposits[0]).toMatchObject({
      id: DEPOSIT,
      amount_minor: 100_000,
      currency: 'AFN',
      posting_status: 'posted',
      origin: 'server',
      sync_state: 'synced',
    })
    // The server's ledger entry is not this device's entry: it must not arrive.
    expect(deposits[0] && 'journal_entry_id' in deposits[0]).toBe(false)

    expect(applications).toHaveLength(1)
    expect(applications[0]).toMatchObject({
      id: APPLICATION,
      deposit_id: DEPOSIT,
      amount_minor: 40_000,
      idempotency_key: 'apply-key-0001',
      // The server row exists only after the whole transaction committed.
      sync_status: 'posted',
      origin: 'server',
    })
    // ⚠️ No `payment_id`: this device has no such payment, and
    // `countsAgainstDeposit` only counts a movement whose payment is posted.
    // Filling it in would hide the application and offer the money again.
    expect(applications[0] && 'payment_id' in applications[0]).toBe(false)

    expect(refunds).toHaveLength(1)
    expect(refunds[0]).toMatchObject({
      id: REFUND,
      amount_minor: 10_000,
      reason: 'بازگشت بخشی از بیعانه',
      idempotency_key: 'refund-key-0001',
      sync_status: 'posted',
    })
  })

  it('the numbers a person reads add up: 100 000 received, 40 000 applied, 10 000 refunded, 50 000 left', () => {
    return applyChanges(page(serverChanges())).then(() => {
      const deposit = localTables.order_deposits![0]!
      const applied = (localTables.order_deposit_applications ?? []).reduce(
        (total, row) => total + Number(row.amount_minor),
        0,
      )
      const refunded = (localTables.order_deposit_refunds ?? []).reduce(
        (total, row) => total + Number(row.amount_minor),
        0,
      )

      expect(applied).toBe(40_000)
      expect(refunded).toBe(10_000)
      expect(Number(deposit.amount_minor) - applied - refunded).toBe(50_000)
    })
  })

  it('duplicate delivery of the same page is harmless: three rows, one of each', async () => {
    await applyChanges(page(serverChanges()))
    await applyChanges(page(serverChanges()))

    expect(localTables.order_deposits).toHaveLength(1)
    expect(localTables.order_deposit_applications).toHaveLength(1)
    expect(localTables.order_deposit_refunds).toHaveLength(1)
  })

  it('the device that made a movement skips its own echo, by the intent key', async () => {
    // This device applied the money offline: its own row, its own id, its own
    // payment — and the same idempotency key the server deduplicated on.
    localTables.order_deposit_applications = [
      {
        id: 'local-application-1',
        workspace_id: WS,
        deposit_id: DEPOSIT,
        invoice_id: INVOICE,
        amount_minor: 40_000,
        currency: 'AFN',
        idempotency_key: 'apply-key-0001',
        payment_id: 'local-payment-1',
        sync_status: 'posted',
        origin: 'local',
      },
    ]

    await applyChanges(page(serverChanges()))

    const applications = localTables.order_deposit_applications!
    // Still one: the server's row is the same move, not a second one.
    expect(applications).toHaveLength(1)
    expect(applications[0]!.id).toBe('local-application-1')
    // Its own payment reference stays — the server's id would point at a
    // payment this device does not hold.
    expect(applications[0]!.payment_id).toBe('local-payment-1')
    // The refund was made elsewhere and still arrives.
    expect(localTables.order_deposit_refunds).toHaveLength(1)
    expect(localTables.order_deposits).toHaveLength(1)
  })

  it('a movement for a deposit this device already holds is accepted under its own id', async () => {
    localTables.order_deposits = [
      {
        id: DEPOSIT,
        workspace_id: WS,
        order_id: ORDER,
        customer_id: CUSTOMER,
        amount_minor: 100_000,
        payment_method: 'cash',
        currency: 'AFN',
        posting_status: 'posted',
        origin: 'local',
      },
    ]

    await applyChanges(page(serverChanges()))

    // No second receipt, and no second copy of the application.
    expect(localTables.order_deposits).toHaveLength(1)
    expect(localTables.order_deposit_applications).toHaveLength(1)
    expect(localTables.order_deposit_refunds).toHaveLength(1)
  })
})

describe('a receipt taken on the device', () => {
  it('travels to the domain endpoint with the device’s own deposit id', async () => {
    queue = [
      entry('dep-receipt-1', 'order_deposits', {
        movement: 'receipt',
        id: 'device-deposit-1',
        orderId: ORDER,
        customerId: CUSTOMER,
        amountMinor: 100_000,
        paymentMethod: 'cash',
        date: '2026-11-03',
      }),
    ]

    await runSync(queryClient)

    const sent = postCalls.find((call) => call.url === `/orders/${ORDER}/deposits`)
    expect(sent).toBeDefined()
    expect(sent?.body).toMatchObject({
      id: 'device-deposit-1',
      customerId: CUSTOMER,
      amountMinor: 100_000,
      paymentMethod: 'cash',
    })
    // Nothing went down the row writer.
    expect(postCalls.some((call) => call.url === '/sync/push')).toBe(false)
    expect(queue).toHaveLength(0)
  })
})
