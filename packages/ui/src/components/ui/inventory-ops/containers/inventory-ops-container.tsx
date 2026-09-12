'use client'

// ============================================
// T11 — the container for the operations screen.
// ============================================

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'

import { InventoryOpsView } from '../inventory-ops-view'
import { useDateFormat } from '../../../../hooks/use-date-format'

export function InventoryOpsContainer() {
  const t = useTranslations()
  // ⚠️ THE CALENDAR FOLLOWS THE LANGUAGE. These were hardcoded to `'fa-AF'`,
  // so every reader got the Afghan solar calendar whatever they chose.
  const { date: fmtIntlDate, lang: dateLang } = useDateFormat()

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
      fmtDate={(value) => fmtIntlDate(value)}
    />
  )
}

export default InventoryOpsContainer
