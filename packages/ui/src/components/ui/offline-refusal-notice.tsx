'use client'

// ============================================
// packages/ui/src/components/ui/offline-refusal-notice.tsx
//
// The last net under the gates. A request the offline gate refuses (a button,
// a deep section, a background read nobody wrapped in <OfflineGate>) is
// announced by the api client; this draws ONE inline notice above the page so
// the person reads «this needs the online edition» instead of a failed list.
// It clears when the route changes. The words come from the endpoint matrix.
// ============================================

import { useEffect, useState } from 'react'
import { onOfflineRefusal, type OfflineRefusal } from '@hisabche/api'
import { CloudRequiredNotice } from './cloud-required-notice'

export function OfflineRefusalNotice({ routeKey }: { routeKey: string }) {
  const [refusal, setRefusal] = useState<OfflineRefusal | null>(null)

  useEffect(() => onOfflineRefusal(setRefusal), [])
  useEffect(() => setRefusal(null), [routeKey])

  if (!refusal) return null
  return (
    <CloudRequiredNotice
      variant="inline"
      kind={refusal.availability}
      onDismiss={() => setRefusal(null)}
    />
  )
}
