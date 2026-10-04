'use client'

// ============================================
// packages/ui/src/components/ui/bank/containers/bank-container.tsx
// ============================================

import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  asList,
  useAccounts,
  useBankStatements,
  useImportStatement,
  useMatchSuggestions,
  useReconcileLine,
  useReconciliation,
  type BankStatement,
  type MatchSuggestion,
  apiErrorMessage,
} from '@hisabche/api'
import { BankView } from '../bank-view'
import { BankCategorySuggestions } from '../bank-category-suggestions'

export const BankContainer = memo(function BankContainer() {
  const translate = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const value = translate(key as Parameters<typeof translate>[0])
    return value && value !== key ? value : (fallback ?? key)
  }

  const [chosenId, setChosenId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const statements = useBankStatements()
  const statementList = asList<BankStatement>(statements.data)

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
  const importStatement = useImportStatement()
  const accounts = useAccounts()
  const [importError, setImportError] = useState<string | null>(null)

  // Where a statement can belong: the posting accounts automatic posting uses
  // for bank and cash. A group account can carry no posting of its own.
  const bankAccounts = useMemo(
    () =>
      asList<{
        id: string
        code: string
        name: string
        role: string | null
        isGroup: boolean
        isActive: boolean
      }>(accounts.data)
        .filter((a) => (a.role === 'bank' || a.role === 'cash') && !a.isGroup && a.isActive)
        .map(({ id, code, name }) => ({ id, code, name })),
    [accounts.data],
  )

  const handleReconcile = useCallback(
    (input: { statementLineId: string; bookEntryId: string }) => {
      setActionError(null)
      reconcile.mutate(input, {
        onError: (err) => {
          const message = apiErrorMessage(err, t('common.saveError', 'انجام نشد'))
          setActionError(message)
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
      suggestions={asList<MatchSuggestion>(suggestions.data?.suggestions)}
      categorySlot={selectedId ? <BankCategorySuggestions statementId={selectedId} /> : null}
      reconciliation={reconciliation.data ?? null}
      isLoading={statements.isLoading}
      isDetailLoading={Boolean(selectedId) && (suggestions.isLoading || reconciliation.isLoading)}
      detailError={
        selectedId && (suggestions.error || reconciliation.error)
          ? ((suggestions.error ?? reconciliation.error) as Error).message
          : null
      }
      error={statements.error ? (statements.error as Error).message : null}
      actionError={actionError}
      isBusy={reconcile.isPending}
      onSelect={setChosenId}
      onReconcile={handleReconcile}
      onRefresh={handleRefresh}
      importer={{
        accounts: bankAccounts,
        accountsLoading: accounts.isLoading,
        accountsError: accounts.error
          ? apiErrorMessage(accounts.error, t('common.loadError', 'دریافت انجام نشد'))
          : null,
        isImporting: importStatement.isPending,
        error: importError,
        onImport: (input) => {
          setImportError(null)
          importStatement.mutate(input, {
            onSuccess: (created) => setChosenId(created.id),
            onError: (err) =>
              setImportError(apiErrorMessage(err, t('common.saveError', 'انجام نشد'))),
          })
        },
      }}
    />
  )
})

BankContainer.displayName = 'BankContainer'
