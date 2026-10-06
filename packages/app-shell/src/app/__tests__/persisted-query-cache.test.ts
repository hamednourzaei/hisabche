// ============================================
// The on-device query cache: shown at once, and only to its owner.
//
// Real QueryClient, real (jsdom) localStorage, real TanStack persister — the
// only thing simulated is time passing between two launches.
// ============================================

import { QueryClient } from '@tanstack/react-query'

import {
  PERSISTED_CACHE_KEY,
  cacheOwner,
  createPersistedQueryCache,
  createQueryCachePersister,
} from '@hisabche/api/src/lib/persisted-query-cache'

/** The persister throttles writes by one second. */
const flushWrites = () => new Promise((resolve) => setTimeout(resolve, 1100))

function launch() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  })
  const cache = createPersistedQueryCache(client, createQueryCachePersister(window.localStorage))
  return { client, cache }
}

const ALICE_SHOP = cacheOwner('alice', 'shop-1')
const BOB_SHOP = cacheOwner('bob', 'shop-1')
const ALICE_OTHER_SHOP = cacheOwner('alice', 'shop-2')

beforeEach(() => window.localStorage.clear())

describe('the numbers from last time are there when the app opens', () => {
  it('a second launch by the same owner starts with the saved answer', async () => {
    const first = launch()
    await first.cache.setOwner(ALICE_SHOP)
    await first.client.fetchQuery({
      queryKey: ['dashboard', 'kpis'],
      queryFn: () => ({ sales: 150_000 }),
    })
    await flushWrites()

    const second = launch()
    await second.cache.setOwner(ALICE_SHOP)

    // No fetch has happened in this launch — this is the device's copy.
    expect(second.client.getQueryData(['dashboard', 'kpis'])).toEqual({ sales: 150_000 })
  }, 10_000)

  it('an error is never saved, so it is never shown as data (راهنمای سشن §۷٫۳)', async () => {
    const first = launch()
    await first.cache.setOwner(ALICE_SHOP)
    await first.client
      .fetchQuery({ queryKey: ['invoices'], queryFn: () => Promise.reject(new Error('500')) })
      .catch(() => undefined)
    await first.client.fetchQuery({ queryKey: ['customers'], queryFn: () => ['c1'] })
    await flushWrites()

    const second = launch()
    await second.cache.setOwner(ALICE_SHOP)
    expect(second.client.getQueryState(['invoices'])).toBeUndefined()
    expect(second.client.getQueryData(['customers'])).toEqual(['c1'])
  }, 10_000)
})

describe("⚠️ nobody sees somebody else's numbers", () => {
  it('another person in the same business does not get the saved cache', async () => {
    const first = launch()
    await first.cache.setOwner(ALICE_SHOP)
    await first.client.fetchQuery({ queryKey: ['payroll'], queryFn: () => ({ total: 9 }) })
    await flushWrites()

    const second = launch()
    await second.cache.setOwner(BOB_SHOP)
    expect(second.client.getQueryData(['payroll'])).toBeUndefined()
    // And it is gone from the device, not merely ignored.
    expect(window.localStorage.getItem(PERSISTED_CACHE_KEY)).toBeNull()
  }, 10_000)

  it('the same person in another workspace does not get it either', async () => {
    const first = launch()
    await first.cache.setOwner(ALICE_SHOP)
    await first.client.fetchQuery({ queryKey: ['invoices'], queryFn: () => ['inv-shop-1'] })
    await flushWrites()

    const second = launch()
    await second.cache.setOwner(ALICE_OTHER_SHOP)
    expect(second.client.getQueryData(['invoices'])).toBeUndefined()
  }, 10_000)

  it('switching owner in a running app clears memory before anything is saved', async () => {
    const app = launch()
    await app.cache.setOwner(ALICE_SHOP)
    await app.client.fetchQuery({ queryKey: ['invoices'], queryFn: () => ['inv-shop-1'] })

    await app.cache.setOwner(ALICE_OTHER_SHOP)
    expect(app.client.getQueryData(['invoices'])).toBeUndefined()
    await flushWrites()

    const next = launch()
    await next.cache.setOwner(ALICE_OTHER_SHOP)
    expect(next.client.getQueryData(['invoices'])).toBeUndefined()
  }, 10_000)

  it('signing out wipes memory and the device', async () => {
    const app = launch()
    await app.cache.setOwner(ALICE_SHOP)
    await app.client.fetchQuery({ queryKey: ['invoices'], queryFn: () => ['inv'] })
    await flushWrites()
    expect(window.localStorage.getItem(PERSISTED_CACHE_KEY)).not.toBeNull()

    await app.cache.setOwner(null)
    expect(app.client.getQueryData(['invoices'])).toBeUndefined()
    expect(window.localStorage.getItem(PERSISTED_CACHE_KEY)).toBeNull()
  }, 10_000)
})

describe('cacheOwner', () => {
  it('needs both a user and a workspace', () => {
    expect(cacheOwner('alice', 'shop-1')).toBe('alice:shop-1')
    expect(cacheOwner('alice', null)).toBeNull()
    expect(cacheOwner(null, 'shop-1')).toBeNull()
  })
})

describe('⚠️ a figure somebody decides on is never the answer from before', () => {
  // Employee 1 sells the last unit. Employee 2 opens the invoice form: the
  // stock check must be the server's answer of now, not this device's copy.
  it('a query marked `persist: false` is not written to the device', async () => {
    const first = launch()
    await first.cache.setOwner(ALICE_SHOP)
    await first.client.fetchQuery({
      queryKey: ['products', 'detail', 'p1', 'on-hand'],
      queryFn: () => ({ quantity: 1 }),
      meta: { persist: false },
    })
    await first.client.fetchQuery({
      queryKey: ['products', 'detail', 'p1'],
      queryFn: () => ({ name: 'kartoon' }),
    })
    await flushWrites()

    expect(window.localStorage.getItem(PERSISTED_CACHE_KEY) ?? '').not.toContain('on-hand')

    const second = launch()
    await second.cache.setOwner(ALICE_SHOP)
    // The stock check starts with NOTHING — it has to ask the server.
    expect(second.client.getQueryState(['products', 'detail', 'p1', 'on-hand'])).toBeUndefined()
    // …while an ordinary answer is still shown at once.
    expect(second.client.getQueryData(['products', 'detail', 'p1'])).toEqual({ name: 'kartoon' })
  }, 10_000)
})
