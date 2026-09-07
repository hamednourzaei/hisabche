'use client'

// ============================================
// packages/ui/src/components/ui/cycle-count/containers/cycle-count-container.tsx
//
// T11 / L2 — wiring the counting screen to the endpoints that had no caller.
// ============================================

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  useCancelCycleCount,
  useCompleteCycleCount,
  useCycleCount,
  useCycleCounts,
  useProducts,
  useRecordCount,
} from '@hisabche/api'

import { CycleCountView } from '../cycle-count-view'

export function CycleCountContainer() {
  const t = useTranslations()
  const [activeId, setActiveId] = useState<string | undefined>(undefined)

  const counts = useCycleCounts()
  const active = useCycleCount(activeId)
  const products = useProducts()

  const record = useRecordCount(activeId ?? '')
  const complete = useCompleteCycleCount(activeId ?? '')
  const cancel = useCancelCycleCount(activeId ?? '')

  /**
   * Product id → name.
   *
   * The count endpoint returns ids only, and a row reading
   * «a1f2c3d4… : expected 40, counted 38» is unusable on a warehouse floor.
   * An id with no matching product renders as itself rather than as a blank —
   * a missing name is a fact worth seeing, not something to hide.
   */
  const productName = useCallback(
    (productId: string): string => {
      const list = (products.data ?? []) as { id: string; name?: string }[]
      return list.find((product) => product.id === productId)?.name ?? productId.slice(0, 8)
    },
    [products.data],
  )

  const safeT = useCallback(
    (key: string, fallback?: string): string => {
      try {
        const value = t(key)
        return value === key && fallback ? fallback : value
      } catch {
        return fallback ?? key
      }
    },
    [t],
  )

  const error = useMemo(() => {
    const failure = record.error ?? complete.error ?? cancel.error
    return failure ? String((failure as Error).message) : null
  }, [record.error, complete.error, cancel.error])

  return (
    <CycleCountView
      t={safeT}
      fmtMoney={(value) => value.toLocaleString('fa-AF')}
      fmtDate={(value) => new Date(value).toLocaleDateString('fa-AF')}
      productName={productName}
      counts={counts.data ?? []}
      activeCount={active.data ?? null}
      isLoading={counts.isLoading}
      isBusy={record.isPending || complete.isPending || cancel.isPending}
      error={error}
      onOpenCount={setActiveId}
      onRecord={(productId, countedQty) => record.mutate({ productId, countedQty })}
      onComplete={() => complete.mutate()}
      onCancel={(reason) => cancel.mutate(reason)}
    />
  )
}

export default CycleCountContainer
