// ============================================
// packages/ui/src/hooks/use-account-drilldown.ts
//
// OPTION 35: KPI DRILL-THROUGH
//
// Allows dashboard KPI cards (revenue, receivables, payables, cash)
// to drill down directly to the corresponding accounting ledger or journal.
// ============================================

import { useCallback } from 'react'
import { useLocalePush } from './use-locale-push'

export type DrilldownTarget = 'receivables' | 'payables' | 'revenue' | 'expenses' | 'cash'

export function useAccountDrilldown() {
  const push = useLocalePush()

  const drilldown = useCallback(
    (target: DrilldownTarget) => {
      switch (target) {
        case 'receivables':
          push('/customers?view=credit')
          break
        case 'payables':
          push('/accounting?tab=books&view=journal')
          break
        case 'revenue':
          push('/accounting?tab=reports&view=incomeStatement')
          break
        case 'expenses':
          push('/accounting?tab=reports&view=incomeStatement')
          break
        case 'cash':
          push('/accounting?tab=treasury&view=bank')
          break
        default:
          push('/accounting')
      }
    },
    [push],
  )

  return { drilldown }
}
