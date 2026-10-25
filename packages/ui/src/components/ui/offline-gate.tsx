'use client'

// ============================================
// packages/ui/src/components/ui/offline-gate.tsx
//
// The one wrapper a screen uses to say «this part needs the online edition».
//
// It asks `useActionAvailability` — the feature registry and the offline
// endpoint matrix — and nothing else. A screen never writes `if (offline)`:
//
//   available        → the children render, offline and online alike
//   online_required  → the notice «this needs the online edition» (the screen
//                      stays in the product; only its use is refused)
//   not_supported    → the notice «not in this edition»
//
// The hook is called before any return, so it is never conditional.
// ============================================

import type { ReactNode } from 'react'
import type { FeatureKey } from '@hisabche/validation'
import { useActionAvailability } from '../../lib/capability/use-action-availability'
import { CloudRequiredNotice, type CloudRequiredVariant } from './cloud-required-notice'

export interface OfflineGateProps {
  feature: FeatureKey
  children: ReactNode
  variant?: CloudRequiredVariant | undefined
}

export function OfflineGate({ feature, children, variant = 'card' }: OfflineGateProps) {
  const availability = useActionAvailability(feature)
  if (!availability.requiresOnline) return <>{children}</>
  return (
    <CloudRequiredNotice
      variant={variant}
      kind={availability.offline === 'not_supported' ? 'not_supported' : 'online_required'}
    />
  )
}
