// packages/api/src/hooks/useAuthReady.ts
'use client'

import { useEffect, useState } from 'react'
import { isTokenProviderReady, tokenReady } from '../lib/tokenProvider'

/**
 * ⚠️ STARTS `false` ON EVERY RENDERER, AND TURNS TRUE ONLY IN AN EFFECT.
 *
 * It used to seed state with `isTokenProviderReady()` during render. On the
 * server no token provider is ever registered, so that was `false`; in the
 * browser it was already `true`. Every query gated on it was therefore
 * disabled on the server (not loading → empty state) and enabled on the first
 * client render (loading → skeleton): different markup, React #418, and the
 * whole tree thrown away and re-rendered. /manufacturing showed it first.
 */
export function useAuthReady(): boolean {
  const [ready, setReady] = useState<boolean>(false)

  useEffect(() => {
    if (ready) return
    if (isTokenProviderReady()) {
      setReady(true)
      return
    }
    let mounted = true

    tokenReady.then(() => {
      if (mounted) setReady(true)
    })

    return () => {
      mounted = false
    }
  }, [ready])

  return ready
}
