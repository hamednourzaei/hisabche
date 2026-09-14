import type { QueryClient } from '@tanstack/react-query'

const mockNetinfoFetch = jest.fn()
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: () => mockNetinfoFetch(), addEventListener: jest.fn() },
}))

const mockPost = jest.fn()
jest.mock('../../../shared/lib/api', () => ({
  apiClient: { post: (...a: unknown[]) => mockPost(...a) },
}))
jest.mock('@hisabche/api', () => ({
  invoiceKeys: { all: ['invoices'] },
  dashboardKeys: { all: ['dashboard'] },
}))
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

import type { CreateInvoice } from '@hisabche/validation'
import { useOutboxStore } from '../outbox.store'
import { refreshThroughSync } from '../sync-refresh'
import { runSync } from '../sync-runner'

const queryClient = { invalidateQueries: jest.fn(async () => undefined) } as unknown as QueryClient
const payload = { type: 'sale', total: 100 } as unknown as CreateInvoice

beforeEach(() => {
  mockPost.mockReset()
  mockNetinfoFetch.mockReset()
  useOutboxStore.setState({ entries: [], lastSyncedAt: null })
})

describe('pull-to-refresh — offline', () => {
  it('touches neither the outbox nor the network, and resolves immediately', async () => {
    mockNetinfoFetch.mockResolvedValue({ isConnected: false })
    useOutboxStore
      .getState()
      .enqueue({ clientId: 'inv_offline_1', kind: 'invoice.create', payload })
    const refetch = jest.fn()

    await expect(refreshThroughSync(queryClient, refetch)).resolves.toBe('offline')

    expect(mockPost).not.toHaveBeenCalled()
    expect(refetch).not.toHaveBeenCalled()
    expect(useOutboxStore.getState().entries).toHaveLength(1)
  })
})

describe('pull-to-refresh — online', () => {
  it('sends pending writes FIRST, then refetches the screen', async () => {
    mockNetinfoFetch.mockResolvedValue({ isConnected: true })
    const order: string[] = []
    mockPost.mockImplementation(async () => {
      order.push('push')
      return { data: {} }
    })
    const refetch = jest.fn(async () => {
      order.push('refetch')
    })
    useOutboxStore.getState().enqueue({ clientId: 'inv_online_1', kind: 'invoice.create', payload })

    await expect(refreshThroughSync(queryClient, refetch)).resolves.toBe('synced')

    expect(order).toEqual(['push', 'refetch'])
    expect(useOutboxStore.getState().entries).toHaveLength(0)
  })

  it('every replay carries the entry clientId as Idempotency-Key', async () => {
    mockNetinfoFetch.mockResolvedValue({ isConnected: true })
    mockPost.mockResolvedValue({ data: {} })
    useOutboxStore
      .getState()
      .enqueue({ clientId: 'inv_key_abcdef', kind: 'invoice.create', payload })

    await refreshThroughSync(queryClient, async () => undefined)

    expect(mockPost).toHaveBeenCalledWith('/invoices', payload, {
      headers: { 'Idempotency-Key': 'inv_key_abcdef' },
    })
  })

  it('⚠️ two pulls at once send a queued invoice ONCE (they join one drain)', async () => {
    mockNetinfoFetch.mockResolvedValue({ isConnected: true })
    let release: () => void = () => undefined
    mockPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ data: {} })
        }),
    )
    useOutboxStore.getState().enqueue({ clientId: 'inv_race_1', kind: 'invoice.create', payload })

    const first = refreshThroughSync(queryClient, async () => undefined)
    const second = refreshThroughSync(queryClient, async () => undefined)
    // Let both reach runSync while the first POST is still in flight.
    await new Promise((resolve) => setTimeout(resolve, 0))
    release()
    await Promise.all([first, second])

    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('a failed refetch still ends the refresh (no endless spinner)', async () => {
    mockNetinfoFetch.mockResolvedValue({ isConnected: true })
    await expect(
      refreshThroughSync(queryClient, async () => {
        throw new Error('network')
      }),
    ).resolves.toBe('synced')
  })

  it('runSync called while a drain runs returns that same drain', async () => {
    mockNetinfoFetch.mockResolvedValue({ isConnected: true })
    let release: () => void = () => undefined
    mockPost.mockImplementation(
      () => new Promise((resolve) => (release = () => resolve({ data: {} }))),
    )
    useOutboxStore.getState().enqueue({ clientId: 'inv_same_1', kind: 'invoice.create', payload })

    const a = runSync(queryClient)
    const b = runSync(queryClient)
    expect(b).toBe(a)
    await new Promise((resolve) => setTimeout(resolve, 0))
    release()
    await a
  })
})
