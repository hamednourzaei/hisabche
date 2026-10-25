'use client'

// ============================================
// packages/ui/src/components/ui/offline-page-gate.tsx
//
// The shell's gate for a whole entry point (menu item, deep link, hub tab):
// the address is looked up in PAGE_FEATURES and, if it is a feature the device
// cannot run, the notice is drawn INSTEAD of the page — before the page mounts
// and before it asks the engine for anything. The page stays in the menu.
//
// A page with no row renders as it is; its parts gate themselves.
// ============================================

import type { ReactNode } from 'react'
import { featureForPage } from '../../lib/capability/page-features'
import { OfflineGate } from './offline-gate'

export function OfflinePageGate({
  pathname,
  search,
  children,
}: {
  pathname: string
  search: string
  children: ReactNode
}) {
  const feature = featureForPage(pathname, search)
  if (!feature) return <>{children}</>
  return <OfflineGate feature={feature}>{children}</OfflineGate>
}
