// packages/api/src/hooks/useAuthReady.ts
'use client'

import { useSyncExternalStore } from 'react'
import { isTokenProviderReady, tokenReady } from '../lib/tokenProvider'

/**
 * ⚠️ `false` ON THE SERVER AND ON THE FIRST HYDRATION RENDER — always.
 *
 * It once seeded state with `isTokenProviderReady()` during render: `false` on the server (no
 * token provider is ever registered there), `true` in the browser. Every query gated on it was
 * disabled in the server HTML (empty state) and enabled on the first client render (skeleton):
 * different markup, React #418, and the whole tree thrown away. /manufacturing showed it first.
 *
 * 13 Nov 2026: an external store, read through `useSyncExternalStore`, instead of
 * `useState(false)` + `setReady(true)` in an effect. The server snapshot is `false`, and React
 * itself uses it for the hydration render — the guarantee above is now React's, not ours. A
 * client-only render (Windows, Android) reads the provider directly and skips the extra render.
 */
function subscribe(onReady: () => void): () => void {
  let live = true
  void tokenReady.then(() => {
    if (live) onReady()
  })
  return () => {
    live = false
  }
}

const notOnServer = (): boolean => false

export function useAuthReady(): boolean {
  return useSyncExternalStore(subscribe, isTokenProviderReady, notOnServer)
}
