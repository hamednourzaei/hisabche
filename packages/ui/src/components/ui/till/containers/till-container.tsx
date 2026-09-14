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
  useBankTransfer,
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
    // Known refusals in words; anything else exactly as the server sent it.
    const code = message ? /^([A-Z][A-Z_]{5,})/.exec(message)?.[1] : undefined
    setActionError(
      code === 'POS_TRANSFER_EXCEEDS_CASH'
        ? t('till.error_POS_TRANSFER_EXCEEDS_CASH', message)
        : (message ?? null),
    )
  }, [])

  const handleOpen = useCallback(
    (openingFloatMinor: number) => {
      setActionError(null)
      openSession.mutate({ openingFloatMinor }, { onError: report })
    },
    [openSession, report],
  )

  const bankTransfer = useBankTransfer()
  // One id per intended transfer: kept across retries of a failed attempt and
  // replaced only after the server has recorded it.
  const [transferId, setTransferId] = useState(() => crypto.randomUUID())

  const handleBankTransfer = useCallback(
    (input: { direction: 'to_bank' | 'from_bank'; amountMinor: number; reason: string }) => {
      if (!session) return
      setActionError(null)
      bankTransfer.mutate(
        { sessionId: session.id, transferId, ...input },
        {
          onSuccess: () => setTransferId(crypto.randomUUID()),
          onError: report,
        },
      )
    },
    [bankTransfer, report, session, transferId],
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
      isBusy={
        openSession.isPending ||
        cashMovement.isPending ||
        closeSession.isPending ||
        bankTransfer.isPending
      }
      actionError={actionError}
      onRefresh={handleRefresh}
      onOpen={handleOpen}
      onCashMovement={handleCashMovement}
      onBankTransfer={handleBankTransfer}
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
