// The sync page's stages (27 Sep 2026). It showed «pending» and «failed»:
// two words for five situations. What must hold:
//   - a server REFUSAL is recorded as one, and is not resent every run;
//   - a network drop is «will retry», and is resent;
//   - «sending» is true exactly while the push is in flight;
//   - a delivered change is listed as recorded for this session.

type Entry = {
  clientId: string
  entity: string
  operation: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  attempts: number
  status: 'pending' | 'failed'
  lastError: string | null
  createdAt: string
}

let outbox: Entry[] = []
const resolveQueue = jest.fn(
  async (clientId: string, status: 'done' | 'failed', error?: string) => {
    if (status === 'done') {
      outbox = outbox.filter((e) => e.clientId !== clientId)
      return
    }
    outbox = outbox.map((e) =>
      e.clientId === clientId
        ? { ...e, status: 'failed', attempts: e.attempts + 1, lastError: error ?? null }
        : e,
    )
  },
)

jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({
    db: {
      queue: async () => outbox,
      resolveQueue,
      upsertMany: async () => 0,
      removeMany: async () => 0,
      query: async () => [],
    },
  }),
}))

const post = jest.fn()
jest.mock('@/shared/lib/api', () => ({
  API_BASE_URL: 'https://api.test/api',
  apiClient: {
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => post(...args),
    delete: (...args: unknown[]) => post(...args),
    // The pull is not under test: it fails and runSync carries on.
    get: async () => {
      throw new Error('offline')
    },
  },
}))
jest.mock('@hisabche/api', () => ({
  invoiceKeys: { all: ['i'] },
  customerKeys: { all: ['c'] },
  productKeys: { all: ['p'] },
  dashboardKeys: { all: ['d'] },
  getToken: () => 'token',
}))
jest.mock('@hisabche/store', () => ({
  useWorkspaceStore: { getState: () => ({ workspaceId: 'ws-1' }) },
}))

import { MAX_ATTEMPTS, runSync, stagesSnapshot } from '../sync-engine'
import { REJECTED_PREFIX, reasonOf, stageOf } from '../outbox-stage'

const queryClient = { invalidateQueries: jest.fn(async () => undefined) } as never

const entry = (clientId: string, extra: Partial<Entry> = {}): Entry => ({
  clientId,
  // Invoices go the domain road (POST /invoices), so the mock sees them.
  entity: 'invoice',
  operation: 'create',
  payload: { id: clientId, total: 1 },
  attempts: 0,
  status: 'pending',
  lastError: null,
  createdAt: '2026-09-27T10:00:00.000Z',
  ...extra,
})
const stage = (clientId: string) => {
  const e = outbox.find((x) => x.clientId === clientId)!
  return stageOf(e, stagesSnapshot().inFlight, MAX_ATTEMPTS)
}

beforeEach(() => {
  outbox = []
  post.mockReset()
  resolveQueue.mockClear()
})

describe('stageOf', () => {
  const none = new Set<string>()
  it('queued → sending → retrying → rejected', () => {
    expect(stageOf(entry('a'), none, 5)).toBe('queued')
    expect(stageOf(entry('a'), new Set(['a']), 5)).toBe('sending')
    expect(
      stageOf(entry('a', { status: 'failed', attempts: 1, lastError: 'Network Error' }), none, 5),
    ).toBe('retrying')
    expect(
      stageOf(
        entry('a', { status: 'failed', attempts: 1, lastError: `${REJECTED_PREFIX}bad` }),
        none,
        5,
      ),
    ).toBe('rejected')
    expect(
      stageOf(entry('a', { status: 'failed', attempts: 5, lastError: 'Network Error' }), none, 5),
    ).toBe('rejected')
  })
  it('the reason is shown without the marker', () => {
    expect(reasonOf(`${REJECTED_PREFIX}Customer not found`)).toBe('Customer not found')
    expect(reasonOf(null)).toBeNull()
  })
})

describe('runSync records each stage', () => {
  it('⚠️ a server refusal (400) is REJECTED, not «failed like a network drop»', async () => {
    outbox = [entry('r1')]
    post.mockRejectedValueOnce({ status: 400, message: 'INVOICE_TOTAL_IS_DERIVED' })
    await runSync(queryClient)
    expect(stage('r1')).toBe('rejected')
    expect(reasonOf(outbox[0]!.lastError)).toBe('INVOICE_TOTAL_IS_DERIVED')
  })

  it('⚠️ a rejected change is NOT resent on the next run (same request, same answer)', async () => {
    outbox = [entry('r1', { status: 'failed', attempts: 1, lastError: `${REJECTED_PREFIX}x` })]
    await runSync(queryClient)
    expect(post).not.toHaveBeenCalled()
  })

  it('a network drop is «will retry», and IS resent', async () => {
    outbox = [entry('n1')]
    post.mockRejectedValueOnce({ message: 'Network Error' })
    await runSync(queryClient)
    expect(stage('n1')).toBe('retrying')
    post.mockResolvedValueOnce({ data: {} })
    await runSync(queryClient)
    expect(outbox).toHaveLength(0)
  })

  it('«sending» while the push is in flight, recorded after', async () => {
    outbox = [entry('s1')]
    let seenWhileSending: string | null = null
    post.mockImplementationOnce(async () => {
      seenWhileSending = stage('s1')
      return { data: {} }
    })
    await runSync(queryClient)
    expect(seenWhileSending).toBe('sending')
    expect(stagesSnapshot().inFlight.size).toBe(0)
    expect(stagesSnapshot().committed[0]).toMatchObject({
      clientId: 's1',
      entity: 'invoice',
      operation: 'create',
    })
  })
})
