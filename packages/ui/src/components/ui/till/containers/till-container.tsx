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
  // On one till's page the day's figures are that till's currency: a dollar
  // till under «today's receipts» in afghani would be two currencies on one
  // screen with one label. On the list it is the one the person picked.
  const tillCurrency = selectedTillId
    ? (selected.data?.session?.currency ??
      (tills.data ?? []).find((till) => till.sessionId === selectedTillId)?.currency)
    : undefined
  const activeCurrency = tillCurrency ?? (selectedCurrency || bookCurrency)

  // What the server said, or a sentence of ours — never the transport's own
  // «Request failed with status code 500».
  const said = (failure: unknown): string | null =>
    failure ? apiErrorMessage(failure, t('common.loadError', 'خطا در بارگذاری')) : null
  const sessionNotFound =
    (selected.error as { response?: { status?: number } } | null)?.response?.status === 404
  // Read for «today» and «yesterday» on the figures at the top — the last two
  // days of the shortest window the server offers. (The chart that used to
  // show the whole window was removed on 13 October.)
  const cashFlow = useCashFlow(7, activeCurrency)

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
    async (input: { openingFloatMinor: number; label?: string; currency?: string }) => {
      setActionError(null)
      setCloseNotice(null)
      try {
        const session = await openSession.mutateAsync(input)
        if (session?.id) push(`/till?till=${session.id}`)
        void tills.refetch()
        return true
      } catch (err) {
        report(err)
        return false
      }
    },
    [openSession, push, report, tills],
  )

  const handleRecordMovement = useCallback(
    async (input: {
      kind: 'cash_in' | 'cash_out'
      amountMinor: number
      reason: string
      movementId: string
    }) => {
      if (!selectedTillId) return false
      setActionError(null)
      setCloseNotice(null)
      try {
        // The id came with the form: sending it again is the same movement.
        await cashMovement.mutateAsync({ sessionId: selectedTillId, ...input })
        void ledger.refetch()
        void tills.refetch()
        void selected.refetch()
        void cashFlow.refetch()
        return true
      } catch (err) {
        report(err)
        return false
      }
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
    async (input: { sessionId: string; countedCashMinor: number; varianceReason?: string }) => {
      setActionError(null)
      setCloseNotice(null)
      try {
        const closed = await closeSession.mutateAsync(input)
        refreshAll()
        if (closed?.ledger?.status === 'not_posted') {
          setCloseNotice(
            t(
              'till.foreign_not_posted',
              'ثبت در دفتر کل انجام نشد (ارز خارجی در دفتر کل پشتیبانی نمی‌شود).',
            ),
          )
        }
        if (selectedTillId === input.sessionId) push('/till')
        return true
      } catch (err) {
        report(err)
        return false
      }
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
      sessionError={selectedTillId ? said(selected.error) : null}
      sessionNotFound={Boolean(selectedTillId) && sessionNotFound}
      tills={tills.data ?? []}
      tillsError={said(tills.error)}
      isTillsLoading={tills.isLoading}
      selectedTillId={selectedTillId}
      onSelectTill={(id) => push(`/till?till=${id}`)}
      onBackToList={() => push('/till')}
      bookCurrency={bookCurrency}
      availableCurrencies={availableCurrencies}
      selectedCurrency={activeCurrency}
      onSelectCurrency={setSelectedCurrency}
      isLoading={current.isLoading}
      error={said(current.error)}
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
      ledgerError={said(ledger.error)}
      dailyCashFlow={cashFlow.data ?? []}
      isCashFlowLoading={cashFlow.isLoading}
      cashFlowError={said(cashFlow.error)}
    />
  )
})

TillContainer.displayName = 'TillContainer'
