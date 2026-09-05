// apps/web/app/[lang]/(dashboard)/warehouse/warehouse-client.tsx
'use client'

// G1 — the warehouse destination carries two tabs now: stock and the product
// catalogue (`?tab=products`, which is where `/product-list` redirects).
//
// The tabs live in `@hisabche/ui` rather than here on purpose. A first draft
// put them in this file, which would have given web a catalogue tab and left
// desktop without one — the divergence the shared package exists to prevent.

import { WarehouseTabsContainer, warehouseSkeleton } from '@hisabche/ui'
import { Suspense } from 'react'

export function WarehouseClient() {
  return (
    // The boundary is here rather than inside the container: `useSearchParams`
    // suspends during prerender, and the container reads it.
    <Suspense fallback={warehouseSkeleton()}>
      <WarehouseTabsContainer />
    </Suspense>
  )
}
