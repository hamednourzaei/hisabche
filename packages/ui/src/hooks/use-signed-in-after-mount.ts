'use client'

import { useEffect, useState } from 'react'
import { selectHasUsableSession, useAuthStore } from '@hisabche/store'

/**
 * «Is someone signed in on this browser?» — answered only AFTER mount.
 *
 * Public pages are prerendered once for everyone, so their HTML is always the
 * signed-out header. This hook keeps the first client render identical to it
 * by contract: `false` until the effect has run, then the store's answer.
 *
 * (zustand already serves its pre-hydration state as the server snapshot during
 * SSR and hydration, so a hook read alone would not mismatch. The explicit
 * mount gate means the rule does not depend on that detail, and a signed-out
 * visitor — every PageSpeed run — never sees a second render of the header.)
 */
export function useSignedInAfterMount(): boolean {
  const hasSession = useAuthStore(selectHasUsableSession)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted && hasSession
}
