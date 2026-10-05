'use client'

// ============================================
// T11 — the container for the operations screen, and for ONE of its parts
// when a hub mounts it (reorder and dead stock in «انبار», stale opportunities
// in «مشتریان»).
// ============================================

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'

import {
  InventoryOpsView,
  OpsCashForecastSection,
  OpsDeadStockSection,
  OpsReorderSection,
  OpsShiftHistorySection,
  OpsStaleOpportunitiesSection,
  type InventoryOpsViewProps,
  type OpsSection,
} from '../inventory-ops-view'
import { useDateFormat } from '../../../../hooks/use-date-format'

/** What every part needs: the fallback translator and the two formatters. */
function useOpsProps(): InventoryOpsViewProps {
  const t = useTranslations()
  // ⚠️ THE CALENDAR FOLLOWS THE LANGUAGE. These were hardcoded to `'fa-AF'`,
  // so every reader got the Afghan solar calendar whatever they chose.
  const { date: fmtIntlDate } = useDateFormat()

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

  return {
    t: safeT,
    fmtMoney: (value) => value.toLocaleString('fa-AF'),
    fmtDate: (value) => fmtIntlDate(value),
  }
}

export function InventoryOpsContainer() {
  return <InventoryOpsView {...useOpsProps()} />
}

const SECTION = {
  reorder: OpsReorderSection,
  deadStock: OpsDeadStockSection,
  cash: OpsCashForecastSection,
  shifts: OpsShiftHistorySection,
  stale: OpsStaleOpportunitiesSection,
} as const

/** One part of the operations screen, for the hub that shares its data. */
export function OpsSectionContainer({ section }: { section: OpsSection }) {
  const props = useOpsProps()
  const Section = SECTION[section]
  return <Section {...props} />
}

export default InventoryOpsContainer
