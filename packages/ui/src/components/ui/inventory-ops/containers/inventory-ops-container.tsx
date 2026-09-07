'use client'

// ============================================
// T11 — the container for the operations screen.
// ============================================

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'

import { InventoryOpsView } from '../inventory-ops-view'

export function InventoryOpsContainer() {
  const t = useTranslations()

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

  return (
    <InventoryOpsView
      t={safeT}
      fmtMoney={(value) => value.toLocaleString('fa-AF')}
      fmtDate={(value) => new Date(value).toLocaleDateString('fa-AF')}
    />
  )
}

export default InventoryOpsContainer
