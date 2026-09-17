'use client'

// ============================================
// packages/ui/src/components/ui/till/containers/till-container.tsx
//
// Data and intent for the till. Web and desktop both mount this module; the
// view below it holds no query of its own.
//
// The page is a list of the workspace's open tills. Selecting one shows its
// transactions; the caller's own till is selected by default. Counting,
// closing and bank transfers are not offered here.
// ============================================

import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  useCashFlow,
  useCurrentSession,
  useOpenSession,
  useOpenSessions,
  useRecordCashMovement,
  useSession,
  useSessionLedger,
} from '@hisabche/api'
import { TillView } from '../till-view'

export const TillContainer = memo(function TillContainer() {
  const translate = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const value = translate(key as Parameters<typeof translate>[0])
    return value && value !== key ? value : (fallback ?? key)
  }

  const [actionError, setActionError] = useState<string | null>(null)

  const current = useCurrentSession()
  const tills = useOpenSessions()
  const openSession = useOpenSession()
  const cashMovement = useRecordCashMovement()

  // Selected till: the caller's own open till unless another row was clicked.
  const [selectedTillId, setSelectedTillId] = useState<string | null>(null)
  const ownId = current.data?.session?.id ?? null
  const firstId = tills.data?.[0]?.sessionId ?? null
  const tillIds = tills.data?.map((till) => till.sessionId) ?? []
  const stillOpen = selectedTillId !== null && tillIds.includes(selectedTillId)
  const activeId = stillOpen ? selectedTillId : (ownId ?? firstId)
  useEffect(() => {
    if (selectedTillId !== null && tills.data && !stillOpen) setSelectedTillId(null)
  }, [selectedTillId, stillOpen, tills.data])

  const selected = useSession(activeId ?? '')
  const ledger = useSessionLedger(activeId)
  const [cashFlowDays, setCashFlowDays] = useState<7 | 30 | 90>(7)
  const cashFlow = useCashFlow(cashFlowDays)

  /**
   * Server refusals are shown verbatim rather than replaced with a generic
   * message. `POS_SESSION_ALREADY_OPEN` tells the person they already have a
   * till open in this branch; "an error occurred" would not.
   */
  const report = useCallback((err: unknown) => {
    const message =
      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      (err as Error)?.message
    const code = message ? /^([A-Z][A-Z_]{5,})/.exec(message)?.[1] : undefined
    setActionError(
      code === 'POS_SESSION_ALREADY_OPEN'
        ? t('till.error_POS_SESSION_ALREADY_OPEN', message)
        : (message ?? null),
    )
  }, [])

  const handleOpen = useCallback(
    (openingFloatMinor: number) => {
      setActionError(null)
      openSession.mutate(
        { openingFloatMinor },
        {
          onSuccess: (session: { id?: string } | undefined) => {
            if (session?.id) setSelectedTillId(session.id)
            void tills.refetch()
          },
          onError: report,
        },
      )
    },
    [openSession, report, tills],
  )

  const handleAddCash = useCallback(
    (input: { amountMinor: number; reason: string }) => {
      if (!activeId) return
      setActionError(null)
      cashMovement.mutate(
        { sessionId: activeId, kind: 'cash_in', ...input },
        {
          onSuccess: () => {
            void ledger.refetch()
            void tills.refetch()
            void selected.refetch()
            void cashFlow.refetch()
          },
          onError: report,
        },
      )
    },
    [activeId, cashFlow, cashMovement, ledger, report, selected, tills],
  )

  const handleRefresh = useCallback(() => {
    setActionError(null)
    current.refetch()
    tills.refetch()
    if (activeId) {
      selected.refetch()
      ledger.refetch()
    }
    cashFlow.refetch()
  }, [activeId, cashFlow, current, ledger, selected, tills])

  return (
    <TillView
      t={t}
      session={activeId ? (selected.data?.session ?? null) : null}
      totals={activeId ? (selected.data?.totals ?? null) : null}
      tills={tills.data ?? []}
      tillsError={tills.error ? (tills.error as Error).message : null}
      isTillsLoading={tills.isLoading}
      selectedTillId={activeId}
      onSelectTill={setSelectedTillId}
      isLoading={current.isLoading}
      error={current.error ? (current.error as Error).message : null}
      isBusy={openSession.isPending || cashMovement.isPending}
      actionError={actionError}
      onRefresh={handleRefresh}
      onOpen={handleOpen}
      onAddCash={handleAddCash}
      ledger={ledger.data?.entries ?? []}
      isLedgerLoading={!!activeId && ledger.isLoading}
      ledgerError={ledger.error ? (ledger.error as Error).message : null}
      dailyCashFlow={cashFlow.data ?? []}
      cashFlowDays={cashFlowDays}
      onCashFlowDaysChange={setCashFlowDays}
      isCashFlowLoading={cashFlow.isLoading}
      cashFlowError={cashFlow.error ? (cashFlow.error as Error).message : null}
    />
  )
})

TillContainer.displayName = 'TillContainer'
