// ============================================
// packages/app-shell/src/features/packs/prefetch.ts
//
// V62 Slice 4 (§4.2 step 6) — Prefetch installed feature-pack chunks during
// browser idle time (`requestIdleCallback`) so first navigation is instant
// without blocking cold-start parse or paint.
// ============================================

import type { PackId } from '@hisabche/validation'

const PACK_PREFETCHERS: Partial<Record<PackId, ReadonlyArray<() => Promise<unknown>>>> = {
  operations: [
    () => import('@/features/inventory-ops/operations-page'),
    () => import('@/features/cycle-count/stock-count-page'),
  ],
  manufacturing: [() => import('@/features/manufacturing/manufacturing-page')],
  workforce: [() => import('@/features/team-and-payroll/tap-page')],
  approvals: [() => import('@/features/approvals/approvals-page')],
  intelligence: [
    () => import('@/features/analysis/analysis-page'),
    () => import('@/features/ai/assistant-page'),
  ],
  marketplace: [
    () => import('@/features/marketplace/marketplace-page'),
    () => import('@/features/market/market-seller-page'),
  ],
}

export function prefetchInstalledPacks(installedPacks: readonly PackId[]): void {
  for (const packId of installedPacks) {
    const loaders = PACK_PREFETCHERS[packId]
    if (!loaders) continue
    for (const load of loaders) {
      void load().catch(() => {
        // Non-fatal: route lazy() will retry on navigation.
      })
    }
  }
}

export function scheduleIdlePackPrefetch(getInstalledPacks: () => readonly PackId[]): () => void {
  if (typeof window === 'undefined') return () => {}

  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
  ).requestIdleCallback

  if (typeof ric === 'function') {
    const id = ric(() => prefetchInstalledPacks(getInstalledPacks()), { timeout: 3000 })
    return () => {
      ;(window as Window & { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback?.(
        id,
      )
    }
  }

  const timer = window.setTimeout(() => prefetchInstalledPacks(getInstalledPacks()), 1500)
  return () => window.clearTimeout(timer)
}
