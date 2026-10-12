'use client'

// ============================================
// packages/ui/src/components/ui/till/containers/till-container.tsx
//
// Data and intent for the till. Web and desktop both mount this module; the
// view below it holds no query of its own.
//
// The page is a list of the workspace's open and suspended tills. Selecting one
// shows its transactions (the caller's own till by default); each row can be
// suspended/resumed or counted and closed. Bank transfers are not offered here.
// ============================================

import { memo, useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  useCashFlow,
  useCurrentSession,
  useOpenSession,
  useOpenSessions,
  useRecordCashMovement,
  useSession,
  useSessionLedger,
  useSetTillSuspended,
  useSetTillLabel,
  useRemoveTill,
  useTillLabels,
  useCloseSession,
  apiErrorMessage,
} from '@hisabche/api'
import { useLocalePush } from '../../../../hooks/use-locale-push'
import { useBookCurrency } from '../../../../hooks/use-book-currency'
import { TillView } from '../till-view'

export const TillContainer = memo(function TillContainer() {
  const translate = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const value = translate(key as Parameters<typeof translate>[0])
    return value && value !== key ? value : (fallback ?? key)
  }

  const [actionError, setActionError] = useState<string | null>(null)
  const [closeNotice, setCloseNotice] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const tillParam = searchParams.get('till')
  const push = useLocalePush()

  const bookCurrency = useBookCurrency()

  const current = useCurrentSession()
  const tills = useOpenSessions()
  const openSession = useOpenSession()
  const cashMovement = useRecordCashMovement()
  const setSuspended = useSetTillSuspended()
  const closeSession = useCloseSession()
  const labels = useTillLabels()
  const setLabel = useSetTillLabel()
  const { mutateAsync: saveLabel } = setLabel
  const removeTill = useRemoveTill()

  // The dialog shows what the server said; a known code gets its own sentence.
  const handleRenameTill = async (sessionId: string, label: string | null) => {
    try {
      await saveLabel({ sessionId, label })
    } catch (err) {
      const message = apiErrorMessage(err, t('common.saveError', 'انجام نشد'))
      const known = ['POS_LABEL_MIGRATION_REQUIRED', 'POS_LABEL_INVALID'].find((code) =>
        message.includes(code),
      )
      throw new Error(known ? t(`till.error_${known}`, message) : message, { cause: err })
    }
  }

  // Selected till: driven by URL ?till=<id>
  const selectedTillId = tillParam ?? null

  const selected = useSession(selectedTillId ?? '')
  const ledger = useSessionLedger(selectedTillId)
  const [cashFlowDays, setCashFlowDays] = useState<7 | 30 | 90>(7)

  // Currencies across open tills + books currency
  const availableCurrencies = useMemo(() => {
    const set = new Set<string>()
    if (bookCurrency) set.add(bookCurrency)
    for (const till of tills.data ?? []) {
      if (till.currency) set.add(till.currency)
    }
    return Array.from(set)
  }, [bookCurrency, tills.data])

  const [selectedCurrency, setSelectedCurrency] = useState<string | undefined>(undefined)
  const activeCurrency = selectedCurrency ?? bookCurrency
  const cashFlow = useCashFlow(cashFlowDays, activeCurrency)

  /**
   * Server refusals are shown verbatim rather than replaced with a generic
   * message. `POS_SESSION_ALREADY_OPEN` tells the person they already have a
   * till open in this branch; "an error occurred" would not.
   */
  const report = useCallback(
    (err: unknown) => {
      const message = apiErrorMessage(err, t('common.saveError', 'انجام نشد'))
      const rawCode = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      const code = /^([A-Z][A-Z_]{5,})/.exec(rawCode ?? message ?? '')?.[1]
      const known = [
        'POS_SESSION_ALREADY_OPEN',
        'POS_SUSPEND_MIGRATION_REQUIRED',
        'POS_VARIANCE_REASON_REQUIRED',
        'POS_SESSION_IN_USE',
        'POS_CURRENCY_MISMATCH',
        'POS_CURRENCY_SCHEMA_REQUIRED',
      ]
      setActionError(code && known.includes(code) ? t(`till.error_${code}`, message) : message)
    },
    [t],
  )

  const handleOpen = useCallback(
    (input: { openingFloatMinor: number; label?: string; currency?: string }) => {
      setActionError(null)
      setCloseNotice(null)
      openSession.mutate(input, {
        onSuccess: (session: { id?: string } | undefined) => {
          if (session?.id) push(`/till?till=${session.id}`)
          void tills.refetch()
        },
        onError: report,
      })
    },
    [openSession, push, report, tills],
  )

  const handleRecordMovement = useCallback(
    (input: { kind: 'cash_in' | 'cash_out'; amountMinor: number; reason: string }) => {
      if (!selectedTillId) return
      setActionError(null)
      setCloseNotice(null)
      cashMovement.mutate(
        {
          sessionId: selectedTillId,
          movementId: crypto.randomUUID(),
          ...input,
        },
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
    [cashFlow, cashMovement, ledger, report, selected, selectedTillId, tills],
  )

  const refreshAll = useCallback(() => {
    void tills.refetch()
    void current.refetch()
    void cashFlow.refetch()
  }, [cashFlow, current, tills])

  const handleSetSuspended = useCallback(
    (sessionId: string, suspended: boolean) => {
      setActionError(null)
      setCloseNotice(null)
      setSuspended.mutate({ sessionId, suspended }, { onSuccess: refreshAll, onError: report })
    },
    [refreshAll, report, setSuspended],
  )

  const handleRemoveTill = useCallback(
    (sessionId: string) => {
      setActionError(null)
      setCloseNotice(null)
      removeTill.mutate(sessionId, {
        onSuccess: () => {
          refreshAll()
          if (selectedTillId === sessionId) push('/till')
        },
        onError: report,
      })
    },
    [push, refreshAll, removeTill, report, selectedTillId],
  )

  const handleCloseTill = useCallback(
    (input: { sessionId: string; countedCashMinor: number; varianceReason?: string }) => {
      setActionError(null)
      setCloseNotice(null)
      closeSession.mutate(input, {
        onSuccess: (res: any) => {
          refreshAll()
          if (res?.ledger?.status === 'not_posted') {
            setCloseNotice(
              t(
                'till.foreign_not_posted',
                'ثبت در دفتر کل انجام نشد (ارز خارجی در دفتر کل پشتیبانی نمی‌شود).',
              ),
            )
          }
          if (selectedTillId === input.sessionId) push('/till')
        },
        onError: report,
      })
    },
    [closeSession, push, refreshAll, report, selectedTillId, t],
  )

  const handleRefresh = useCallback(() => {
    setActionError(null)
    setCloseNotice(null)
    current.refetch()
    tills.refetch()
    if (selectedTillId) {
      selected.refetch()
      ledger.refetch()
    }
    cashFlow.refetch()
  }, [cashFlow, current, ledger, selected, selectedTillId, tills])

  return (
    <TillView
      t={t}
      session={selectedTillId ? (selected.data?.session ?? null) : null}
      totals={selectedTillId ? (selected.data?.totals ?? null) : null}
      isSessionLoading={selectedTillId ? selected.isLoading : false}
      sessionError={selectedTillId && selected.error ? (selected.error as Error).message : null}
      tills={tills.data ?? []}
      tillsError={tills.error ? (tills.error as Error).message : null}
      isTillsLoading={tills.isLoading}
      selectedTillId={selectedTillId}
      onSelectTill={(id) => push(`/till?till=${id}`)}
      onBackToList={() => push('/till')}
      bookCurrency={bookCurrency}
      availableCurrencies={availableCurrencies}
      selectedCurrency={activeCurrency}
      onSelectCurrency={setSelectedCurrency}
      isLoading={current.isLoading}
      error={current.error ? (current.error as Error).message : null}
      isBusy={
        openSession.isPending ||
        cashMovement.isPending ||
        setSuspended.isPending ||
        removeTill.isPending ||
        closeSession.isPending
      }
      onSetSuspended={handleSetSuspended}
      onCloseTill={handleCloseTill}
      tillLabels={labels.data?.labels ?? {}}
      onRenameTill={handleRenameTill}
      onRemoveTill={handleRemoveTill}
      actionError={actionError}
      closeNotice={closeNotice}
      onRefresh={handleRefresh}
      onOpen={handleOpen}
      onRecordMovement={handleRecordMovement}
      ledger={ledger.data?.entries ?? []}
      isLedgerLoading={!!selectedTillId && ledger.isLoading}
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
