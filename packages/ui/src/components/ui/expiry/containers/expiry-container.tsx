'use client'

// ============================================
// packages/ui/src/components/ui/expiry/containers/expiry-container.tsx
// ============================================

import { memo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useBatches, useExpiryReport, usePlanIssue, type AllocationPlan } from '@hisabche/api'
import { ExpiryView } from '../expiry-view'

export const ExpiryContainer = memo(function ExpiryContainer() {
  const translate = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const value = translate(key as Parameters<typeof translate>[0])
    return value && value !== key ? value : (fallback ?? key)
  }

  const [plan, setPlan] = useState<AllocationPlan | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const report = useExpiryReport()
  const batches = useBatches()
  const planIssue = usePlanIssue()

  const handlePlanIssue = useCallback(
    (input: { productId: string; quantity: number }) => {
      setActionError(null)
      // Cleared first. A plan left on screen from a previous product, next to a
      // new product's name, is a plan somebody will act on.
      setPlan(null)
      planIssue.mutate(input, {
        onSuccess: setPlan,
        onError: (err) => {
          const message =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            (err as Error)?.message
          setActionError(message ?? null)
        },
      })
    },
    [planIssue],
  )

  const handleRefresh = useCallback(() => {
    setActionError(null)
    setPlan(null)
    report.refetch()
    batches.refetch()
  }, [batches, report])

  return (
    <ExpiryView
      t={t}
      report={report.data ?? null}
      batches={batches.data ?? []}
      plan={plan}
      isLoading={report.isLoading}
      error={report.error ? (report.error as Error).message : null}
      actionError={actionError}
      isBusy={planIssue.isPending}
      onPlanIssue={handlePlanIssue}
      onRefresh={handleRefresh}
    />
  )
})

ExpiryContainer.displayName = 'ExpiryContainer'
