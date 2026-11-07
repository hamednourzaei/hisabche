'use client'

// ============================================
// V54 5.6 — offer the DNA's menu suggestion once, on every host.
//
// Mounted by `GlobalPageCustomizer` (web header + phone row, desktop and
// mobile shells), so the same business gets the same starting menu wherever
// the person signs in. The DNA read is the workspace's own (server) copy, or
// the one the wizard just set on this device; an INFERRED guess is never used.
// See `lib/menu/dna-menu-suggestion.ts` for what may be suggested away.
// ============================================

import { useEffect } from 'react'
import { useOperationalProfile } from '@hisabche/api'
import { useOnboardingStore } from '@hisabche/store'
import { usePageLook } from '../lib/page-look'
import { suggestedHiddenMenuPaths } from '../lib/menu/dna-menu-suggestion'

export function useDnaMenuSuggestion(): void {
  const server = useOperationalProfile().data
  const deviceDna = useOnboardingStore((state) => state.operationalDna)
  const menu = usePageLook('menu')

  const dna = server?.dna ?? deviceDna
  // The server's version when it holds the DNA; the device copy is «device».
  const token = server?.dna ? `v${server.version}` : 'device'
  const { ready, suggest } = menu

  useEffect(() => {
    if (!ready || !dna) return
    suggest(suggestedHiddenMenuPaths(dna), token)
  }, [ready, dna, token, suggest])
}
