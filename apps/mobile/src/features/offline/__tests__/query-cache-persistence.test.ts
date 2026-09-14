jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient } from '@tanstack/react-query'

import {
  cacheScope,
  clearPersistedQueryCaches,
  restoreQueryCache,
  saveQueryCache,
  shouldPersist,
  storageKey,
} from '../query-cache-persistence'

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe('what is stored', () => {
  it('only successful reads of the list families', () => {
    const ok = { status: 'success' } as never
    expect(shouldPersist({ queryKey: ['invoices', 'list', {}], state: ok })).toBe(true)
    expect(shouldPersist({ queryKey: ['customers'], state: ok })).toBe(true)
    expect(shouldPersist({ queryKey: ['products', 'list'], state: ok })).toBe(true)
    expect(shouldPersist({ queryKey: ['transactions'], state: ok })).toBe(true)
    expect(shouldPersist({ queryKey: ['billing'], state: ok })).toBe(false)
    expect(shouldPersist({ queryKey: ['invoices'], state: { status: 'error' } as never })).toBe(
      false,
    )
  })
})

describe('restart without a connection', () => {
  it('a saved list comes back in a fresh client (the local data offline screens show)', async () => {
    const before = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
    before.setQueryData(['invoices', 'list', { page: 1 }], { invoices: [{ id: 'i1' }] })
    before.setQueryData(['billing', 'status'], { plan: 'pro' })
    await saveQueryCache(before, 'ws-1')

    const after = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
    const restored = await restoreQueryCache(after, 'ws-1')

    expect(restored).toBe(1)
    expect(after.getQueryData(['invoices', 'list', { page: 1 }])).toEqual({
      invoices: [{ id: 'i1' }],
    })
    expect(after.getQueryData(['billing', 'status'])).toBeUndefined()
  })

  it('⚠️ another workspace never receives this one’s data', async () => {
    const before = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
    before.setQueryData(['customers'], [{ id: 'secret' }])
    await saveQueryCache(before, 'ws-1')

    const other = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
    expect(await restoreQueryCache(other, 'ws-2')).toBe(0)
    expect(other.getQueryData(['customers'])).toBeUndefined()
  })

  it('a corrupt entry is dropped, never breaks start-up', async () => {
    await AsyncStorage.setItem(storageKey('ws-1'), '{not json')
    await expect(
      restoreQueryCache(
        new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } }),
        'ws-1',
      ),
    ).resolves.toBe(0)
    expect(await AsyncStorage.getItem(storageKey('ws-1'))).toBeNull()
  })
})

describe('sign-out', () => {
  it('deletes every stored cache and nothing else', async () => {
    await AsyncStorage.setItem(storageKey('ws-1'), '{}')
    await AsyncStorage.setItem(storageKey('user-u1'), '{}')
    await AsyncStorage.setItem('hisabche.outbox', '{"keep":true}')

    await clearPersistedQueryCaches()

    expect(await AsyncStorage.getItem(storageKey('ws-1'))).toBeNull()
    expect(await AsyncStorage.getItem(storageKey('user-u1'))).toBeNull()
    expect(await AsyncStorage.getItem('hisabche.outbox')).toBe('{"keep":true}')
  })

  it('scope is the workspace when known, else the user, else nothing', () => {
    expect(cacheScope(null)).toBeNull()
    expect(cacheScope({ user: { id: 'u1' } })).toBe('user-u1')
    expect(cacheScope({ user: { id: 'u1' }, workspace: { workspaceId: 'ws-9' } })).toBe('ws-9')
  })
})
