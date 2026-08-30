'use client'

// ============================================
// packages/ui/src/components/ui/bank/containers/bank-container.tsx
// ============================================

import { memo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  useBankStatements,
  useMatchSuggestions,
  useReconcileLine,
  useReconciliation,
} from '@hisabche/api'
import { BankView } from '../bank-view'

export const BankContainer = memo(function BankContainer() {
  const translate = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const value = translate(key as Parameters<typeof translate>[0])
    return value && value !== key ? value : (fallback ?? key)
  }

  const [chosenId, setChosenId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const statements = useBankStatements()
  const statementList = statements.data ?? []

  // The newest statement is the default, DERIVED rather than stored. An effect
  // that writes state on load costs a cascading render, and a stored default
  // goes stale the moment the list changes underneath it — the person is left
  // looking at a statement that is no longer the newest, with nothing saying so.
  //
  // Derived before the detail hooks, because they are keyed by it.
  const selectedId = chosenId ?? statementList[0]?.id ?? null

  const suggestions = useMatchSuggestions(selectedId ?? '')
  const reconciliation = useReconciliation(selectedId ?? '')
  const reconcile = useReconcileLine()

  const handleReconcile = useCallback(
    (input: { statementLineId: string; bookEntryId: string }) => {
      setActionError(null)
      reconcile.mutate(input, {
        onError: (err) => {
          const message =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            (err as Error)?.message
          setActionError(message ?? null)
        },
      })
    },
    [reconcile],
  )

  const handleRefresh = useCallback(() => {
    setActionError(null)
    statements.refetch()
    if (selectedId) {
      suggestions.refetch()
      reconciliation.refetch()
    }
  }, [reconciliation, selectedId, statements, suggestions])

  return (
    <BankView
      t={t}
      statements={statementList}
      selectedId={selectedId}
      suggestions={suggestions.data?.suggestions ?? []}
      reconciliation={reconciliation.data ?? null}
      isLoading={statements.isLoading}
      isDetailLoading={Boolean(selectedId) && (suggestions.isLoading || reconciliation.isLoading)}
      error={statements.error ? (statements.error as Error).message : null}
      actionError={actionError}
      isBusy={reconcile.isPending}
      onSelect={setChosenId}
      onReconcile={handleReconcile}
      onRefresh={handleRefresh}
    />
  )
})

BankContainer.displayName = 'BankContainer'
