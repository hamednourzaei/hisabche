'use client'

// ============================================
// packages/ui/src/components/ui/guide/use-guide-scope.ts
//
// What the guide may teach THIS person (owner, 15 Nov 2026): «راهنمای کسی که
// صنفش را انتخاب کرده نباید به هسته‌ای اشاره کند که لازمش نیست — وگرنه قدم بعدی
// به هیچ صفحه‌ای نمی‌رود».
//
// ⚠️ NOT A SECOND MENU. Every answer here is read from the owners the menu
// itself reads — nothing is decided twice:
//   · the role and the owner's per-person block   useMyCapabilities (hidden / blocked)
//   · the person's menu look                      usePageLook('menu') — the DNA
//                                                 suggestion is written there once
//   · the DNA suggestion before it is written     suggestedHiddenMenuPaths (same rule)
//   · a page switched off for everyone            isPageDisabled
//   · an expired subscription                     isRouteAllowedWhenExpired
//   · which modules the business runs             dnaActiveModules (same rule as the menu)
// ============================================

import { useCallback, useMemo } from 'react'
import { useMyCapabilities, useOperationalProfile } from '@hisabche/api'
import { useOnboardingStore } from '@hisabche/store'
import { isNavLocked, isPageDisabled } from '@hisabche/ui-contract'
import { usePageLook } from '../../../lib/page-look'
import { dnaActiveModules, suggestedHiddenMenuPaths } from '../../../lib/menu/dna-menu-suggestion'
import { isRouteAllowedWhenExpired, useSubscriptionLocked } from '../billing/subscription-lock'

export interface GuideScope {
  /** Is the page behind this menu path in this person's menu and open to them? */
  isReachable: (menuPath: string) => boolean
  /** The modules the business runs (an unresolved axis counts as running); null = no DNA yet. */
  activeModules: ReadonlySet<string> | null
}

export function useGuideScope(): GuideScope {
  const capabilities = useMyCapabilities().data
  const blockedKey = [
    ...(capabilities?.blockedModules ?? []),
    ...(capabilities?.hiddenModules ?? []),
  ]
    .sort()
    .join(',')
  const menu = usePageLook('menu')
  const server = useOperationalProfile().data
  const deviceDna = useOnboardingStore((state) => state.operationalDna)
  const dna = server?.dna ?? deviceDna ?? null
  const subscriptionLocked = useSubscriptionLocked()

  // Until the person saves a menu, the DNA suggestion IS their starting menu,
  // even in the moment before `useDnaMenuSuggestion` has written it.
  const hiddenKey = useMemo(() => {
    const own =
      menu.customized || !dna
        ? menu.hiddenIds
        : [...menu.hiddenIds, ...suggestedHiddenMenuPaths(dna)]
    return [...new Set(own)].sort().join(',')
  }, [menu.customized, menu.hiddenIds, dna])

  const isReachable = useCallback(
    (menuPath: string) => {
      const blocked = blockedKey ? blockedKey.split(',') : []
      const hidden = hiddenKey ? hiddenKey.split(',') : []
      if (isPageDisabled(menuPath)) return false
      if (isNavLocked(menuPath, blocked)) return false
      if (hidden.includes(menuPath)) return false
      if (subscriptionLocked && !isRouteAllowedWhenExpired(menuPath)) return false
      return true
    },
    [blockedKey, hiddenKey, subscriptionLocked],
  )

  const activeModules = useMemo(() => (dna ? dnaActiveModules(dna) : null), [dna])

  return useMemo(() => ({ isReachable, activeModules }), [isReachable, activeModules])
}
