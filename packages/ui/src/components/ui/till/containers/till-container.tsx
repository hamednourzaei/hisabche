'use client'

// ============================================
// packages/ui/src/components/ui/till/containers/till-container.tsx
//
// Data and intent for the till. Web and desktop both mount this module; the
// view below it holds no query of its own.
// ============================================

import { memo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  asList,
  useAbandonedSessions,
  useCloseSession,
  useCurrentSession,
  useOpenSession,
  useRecordCashMovement,
  useSessionLedger,
  useCashFlow,
} from '@hisabche/api'
import type { AbandonedSession } from '@hisabche/api'
import { TillView } from '../till-view'

export const TillContainer = memo(function TillContainer() {
  const translate = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const value = translate(key as Parameters<typeof translate>[0])
    return value && value !== key ? value : (fallback ?? key)
  }

  const [actionError, setActionError] = useState<string | null>(null)

  const current = useCurrentSession()
  const abandoned = useAbandonedSessions()
  const openSession = useOpenSession()
  const cashMovement = useRecordCashMovement()
  const closeSession = useCloseSession()

  const session = current.data?.session ?? null
  const ledger = useSessionLedger(session?.id ?? null)
  const [cashFlowDays, setCashFlowDays] = useState<7 | 30 | 90>(7)
  const cashFlow = useCashFlow(cashFlowDays)

  /**
   * Server refusals are shown verbatim rather than replaced with a generic
   * message. `POS_SESSION_NOT_OPEN` and `POS_VARIANCE_REASON_REQUIRED` each
   * tell the cashier something they can act on; "an error occurred" does not.
   */
  const report = useCallback((err: unknown) => {
    const message =
      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      (err as Error)?.message
    setActionError(message ?? null)
  }, [])

  const handleOpen = useCallback(
    (openingFloatMinor: number) => {
      setActionError(null)
      openSession.mutate({ openingFloatMinor }, { onError: report })
    },
    [openSession, report],
  )

  const handleCashMovement = useCallback(
    (input: { kind: 'cash_in' | 'cash_out'; amountMinor: number; reason: string }) => {
      if (!session) return
      setActionError(null)
      cashMovement.mutate({ sessionId: session.id, ...input }, { onError: report })
    },
    [cashMovement, report, session],
  )

  const handleClose = useCallback(
    (input: { countedCashMinor: number; varianceReason?: string }) => {
      if (!session) return
      setActionError(null)
      closeSession.mutate({ sessionId: session.id, ...input }, { onError: report })
    },
    [closeSession, report, session],
  )

  const handleRefresh = useCallback(() => {
    setActionError(null)
    current.refetch()
    abandoned.refetch()
    if (session) ledger.refetch()
    cashFlow.refetch()
  }, [abandoned, cashFlow, current, ledger, session])

  return (
    <TillView
      t={t}
      session={session}
      totals={current.data?.totals ?? null}
      abandoned={asList<AbandonedSession>(abandoned.data)}
      abandonedError={abandoned.error ? (abandoned.error as Error).message : null}
      isAbandonedLoading={abandoned.isLoading}
      isLoading={current.isLoading}
      error={current.error ? (current.error as Error).message : null}
      isBusy={openSession.isPending || cashMovement.isPending || closeSession.isPending}
      actionError={actionError}
      onRefresh={handleRefresh}
      onOpen={handleOpen}
      onCashMovement={handleCashMovement}
      onClose={handleClose}
      ledger={ledger.data?.entries ?? []}
      isLedgerLoading={!!session && ledger.isLoading}
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
