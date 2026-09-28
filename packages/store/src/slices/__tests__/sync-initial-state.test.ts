// ============================================
// The sync store's INITIAL state is what the server renders with.
//
// zustand 4.5 hands React `getInitialState()` as the server snapshot during
// hydration, so any field computed from the environment at `create()` time is
// a hydration mismatch waiting for two environments to disagree. They did:
// Node 22 has a global `navigator` but no `navigator.onLine`, so the server
// rendered «offline» and the browser «online» — React #418 on
// /warehouse?tab=products.
// ============================================

import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadIn(navigatorLike: object) {
  vi.resetModules()
  vi.stubGlobal('navigator', navigatorLike)
  const { useSyncStore } = await import('../sync.slice')
  return useSyncStore
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sync store initial state is environment-independent', () => {
  it('⚠️ the server (a navigator with no onLine, as in Node 22) starts online', async () => {
    const store = await loadIn({})
    expect(store.getInitialState().isOnline).toBe(true)
  })

  it('⚠️ an offline browser starts from the SAME snapshot the server rendered', async () => {
    const store = await loadIn({ onLine: false })
    expect(store.getInitialState().isOnline).toBe(true)
  })

  it('the live value can change after creation without touching the snapshot', async () => {
    const store = await loadIn({ onLine: true })
    store.getState().setOnline(false)
    expect(store.getState().isOnline).toBe(false)
    expect(store.getInitialState().isOnline).toBe(true)
  })
})
