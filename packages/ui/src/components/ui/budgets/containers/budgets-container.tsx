'use client'

// ============================================
// packages/ui/src/components/ui/budgets/containers/budgets-container.tsx
// ============================================

import { memo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  asList,
  useBudgetVariance,
  useBudgets,
  useCheckSpend,
  type Budget,
  type BudgetCheck,
  type VarianceRow,
} from '@hisabche/api'
import { BudgetsView } from '../budgets-view'

export const BudgetsContainer = memo(function BudgetsContainer() {
  const translate = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const value = translate(key as Parameters<typeof translate>[0])
    return value && value !== key ? value : (fallback ?? key)
  }

  const [actionError, setActionError] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<BudgetCheck | null>(null)

  const budgets = useBudgets()
  const variance = useBudgetVariance()
  const checkSpend = useCheckSpend()

  const handleCheckSpend = useCallback(
    (input: { accountId: string; amountMinor: number; onDate: string }) => {
      setActionError(null)
      // The previous answer is cleared first: a stale "allowed" left on screen
      // while a new check runs is the one thing this control must never show.
      setCheckResult(null)
      checkSpend.mutate(input, {
        onSuccess: setCheckResult,
        onError: (err) => {
          const message =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            (err as Error)?.message
          setActionError(message ?? null)
        },
      })
    },
    [checkSpend],
  )

  const handleRefresh = useCallback(() => {
    setActionError(null)
    setCheckResult(null)
    budgets.refetch()
    variance.refetch()
  }, [budgets, variance])

  return (
    <BudgetsView
      t={t}
      budgets={asList<Budget>(budgets.data)}
      variance={asList<VarianceRow>(variance.data)}
      isVarianceLoading={variance.isLoading}
      varianceError={variance.error ? (variance.error as Error).message : null}
      isLoading={budgets.isLoading}
      error={budgets.error ? (budgets.error as Error).message : null}
      actionError={actionError}
      isBusy={checkSpend.isPending}
      checkResult={checkResult}
      onCheckSpend={handleCheckSpend}
      onRefresh={handleRefresh}
    />
  )
})

BudgetsContainer.displayName = 'BudgetsContainer'
