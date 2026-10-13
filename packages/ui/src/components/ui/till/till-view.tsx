'use client'

// ============================================
// packages/ui/src/components/ui/till/till-view.tsx
//
// The cash drawer.
//
// ---------------------------------------------------------------------------
// WHAT THIS SCREEN IS FOR
//
// Not selling — selling happens on the invoice screen. This is the drawer
// around the selling: opening it with a float, recording money that goes in or
// out for a reason, and counting it at the end.
//
// The one figure that matters is the VARIANCE, and it is shown before the
// close is confirmed, not after. A cashier who learns the drawer is short
// after the session is sealed can no longer count again; one who sees it while
// standing at the till usually finds the missing note.
//
// Expected cash is derived by the server from the session's own movements and
// is never editable here. A field a person can type into is a field that can
// be made to agree with whatever is in the drawer, which is precisely the
// control this screen exists to provide.
//
// ---------------------------------------------------------------------------
// LAYOUT — header, today's KPIs and charts, the list of open tills (with
// «افزودن صندوق»), then selecting a till enters the detail view showing
// that till's transactions and ledger.
// ============================================

import { memo, useEffect, useMemo, useState } from 'react'
import { Skeleton } from '../skeleton'
import { FRACTION_DIGITS } from '@hisabche/formatting'
import { CURRENCY_CODES } from '@hisabche/validation'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  MoreHorizontal,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  Wallet,
} from 'lucide-react'
import type {
  PosSession,
  SessionTotals,
  AbandonedSession,
  DrawerEntry,
  CashFlowDay,
} from '@hisabche/api'
import { SegmentedControl } from '../segmented-control'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu'
import { useDateFormat } from '../../../hooks/use-date-format'
import { DataTable, TableFilterSelect, matchesSearch, type TableColumn } from '../data-table'
import {
  ActionButton,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  ErrorNote,
  Field,
  ListSection,
  Loading,
  MinorInput,
  Money,
  SelectField,
  Stat,
} from '../capability/capability-kit'

export interface TillViewProps {
  t: (key: string, fallback?: string) => string
  /** The till whose transactions are shown (selected in the list). */
  session: PosSession | null
  totals: SessionTotals | null
  isSessionLoading?: boolean
  sessionError?: string | null
  /**
   * The selected till is not this workspace's (or does not exist). Kept apart
   * from `sessionError`: «the read failed» is not «there is no such till».
   */
  sessionNotFound?: boolean
  /** Every open till in the workspace. */
  tills: AbandonedSession[]
  /** Kept apart from `tills`: a failed read must not read as «none». */
  tillsError: string | null
  isTillsLoading: boolean
  selectedTillId: string | null
  onSelectTill: (sessionId: string) => void
  onBackToList?: () => void
  bookCurrency?: string | undefined
  availableCurrencies?: string[]
  selectedCurrency?: string | undefined
  onSelectCurrency?: (currency: string) => void
  isLoading: boolean
  error: string | null
  isBusy: boolean
  actionError: string | null
  closeNotice?: string | null
  onRefresh: () => void
  /**
   * «افزودن صندوق» — opens a till with its opening float, name and currency.
   * Resolves true once the server has opened it; false when it refused (the
   * reason is in `actionError`). The form stays as typed until then.
   */
  onOpen: (input: {
    openingFloatMinor: number
    label?: string
    currency?: string
  }) => Promise<boolean>
  /** Row actions: «تعلیق» / «ادامه» and «بستن». */
  onSetSuspended: (sessionId: string, suspended: boolean) => void
  /** Resolves true once closed; false when refused — the count is kept. */
  onCloseTill: (input: {
    sessionId: string
    countedCashMinor: number
    varianceReason?: string
  }) => Promise<boolean>
  /** Session id → the name a person gave that till. */
  tillLabels: Record<string, string>
  /** Resolves when the name is stored; rejects with the reason when it is not. */
  onRenameTill: (sessionId: string, label: string | null) => Promise<void>
  /** Remove a till that was never used; the server refuses one that has seen money. */
  onRemoveTill: (sessionId: string) => void
  /** «ورود و خروج نقدی» — cash_in or cash_out on the selected till. */
  onRecordMovement: (input: {
    kind: 'cash_in' | 'cash_out'
    amountMinor: number
    reason: string
    /** Made once per form fill and resent unchanged, so a retry is the same movement. */
    movementId: string
  }) => Promise<boolean>
  /** The drawer as a ledger, from the server. Last balance = expected cash. */
  ledger: DrawerEntry[]
  isLedgerLoading: boolean
  ledgerError: string | null
  dailyCashFlow: CashFlowDay[]
  isCashFlowLoading: boolean
  cashFlowError: string | null
}

type LedgerFilter = 'all' | 'in' | 'out' | 'invoices'
const LEDGER_FILTERS: readonly LedgerFilter[] = ['all', 'in', 'out', 'invoices']

const PAGE_SIZE = 10

/**
 * «+13% نسبت به روز قبل». Tone follows MEANING, not the sign: more cash in is
 * good, more cash out is not. No yesterday figure → no claim at all.
 */
function DeltaHint({
  t,
  now,
  before,
  goodWhenUp,
}: {
  t: (key: string, fallback?: string) => string
  now: number
  before: number
  goodWhenUp: boolean
}) {
  if (before === 0) return null
  const pct = Math.round(((now - before) / before) * 1000) / 10
  const good = goodWhenUp ? pct >= 0 : pct <= 0
  return (
    <span
      className={good ? 'text-[hsl(var(--color-success))]' : 'text-[hsl(var(--color-destructive))]'}
    >
      <span dir="ltr" className="tabular-nums">
        {pct > 0 ? '+' : ''}
        {pct}%
      </span>{' '}
      {t('till.vs_yesterday', 'نسبت به روز قبل')}
    </span>
  )
}

/**
 * Profit % of the sale a cash receipt settled — computed by the accounting
 * core (request #91). No figure («—») when it is not a sale receipt or the sale
 * has no recorded cost; a guessed 100% would be worse than none.
 */
function MarginCell({ value }: { value: number | null | undefined }) {
  if (typeof value !== 'number') return <span className="text-[hsl(var(--fg-tertiary))]">—</span>
  return (
    <span
      className={
        value < 0 ? 'text-[hsl(var(--color-destructive))]' : 'text-[hsl(var(--color-success))]'
      }
    >
      {Math.round(value * 10) / 10}%
    </span>
  )
}

export const TillView = memo(function TillView({
  t,
  session,
  totals,
  isSessionLoading = false,
  sessionError = null,
  sessionNotFound = false,
  tills,
  tillsError,
  isTillsLoading,
  selectedTillId,
  onSelectTill,
  onBackToList,
  bookCurrency,
  availableCurrencies = [],
  selectedCurrency,
  onSelectCurrency,
  isLoading,
  error,
  isBusy,
  actionError,
  closeNotice,
  onRefresh,
  onOpen,
  onRecordMovement,
  onSetSuspended,
  onCloseTill,
  tillLabels,
  onRenameTill,
  onRemoveTill,
  ledger,
  isLedgerLoading,
  ledgerError,
  dailyCashFlow,
  isCashFlowLoading,
  cashFlowError,
}: TillViewProps) {
  const { dateTime } = useDateFormat()

  const [floatMinor, setFloatMinor] = useState(0)
  const [labelDraft, setLabelDraft] = useState('')
  const [currencyDraft, setCurrencyDraft] = useState<string>(bookCurrency ?? '')
  const [addTillOpen, setAddTillOpen] = useState(false)

  useEffect(() => {
    if (bookCurrency && !currencyDraft) {
      setCurrencyDraft(bookCurrency)
    }
  }, [bookCurrency, currencyDraft])

  // ⚠️ MINOR UNITS BELONG TO A CURRENCY. 100.00 afghani is 10000 minor; kept
  // across a switch to a currency with no decimals it would open the till with
  // ten thousand. Changing the currency empties the amount.
  const chooseCurrency = (next: string) => {
    if (next !== currencyDraft) setFloatMinor(0)
    setCurrencyDraft(next)
  }

  const currencyOptions = useMemo(() => {
    return CURRENCY_CODES.filter((code) => code in FRACTION_DIGITS).map((code) => ({
      value: code,
      label: t(`currency.${code.toLowerCase()}`, code),
    }))
  }, [t])

  // Movement dialog state (detail view)
  const [movementOpen, setMovementOpen] = useState(false)
  const [movementKind, setMovementKind] = useState<'cash_in' | 'cash_out'>('cash_in')
  const [movementAmountMinor, setMovementAmountMinor] = useState(0)
  const [movementReason, setMovementReason] = useState('')
  // One id per form fill. It is renewed only after the server has recorded
  // the movement, so pressing «ثبت» again after a lost answer is the SAME
  // movement to the server, never a second one in the drawer.
  const [movementRequestId, setMovementRequestId] = useState('')
  const openMovementForm = (kind: 'cash_in' | 'cash_out') => {
    setMovementKind(kind)
    setMovementRequestId((current) => current || crypto.randomUUID())
    setMovementOpen(true)
  }

  const [tillSearch, setTillSearch] = useState('')
  // «ویرایش»: the till being named, the draft and what the server said.
  const [renaming, setRenaming] = useState<AbandonedSession | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)

  const saveName = async () => {
    if (!renaming) return
    setIsRenaming(true)
    setRenameError(null)
    try {
      // An emptied field takes the name away.
      await onRenameTill(renaming.sessionId, nameDraft.trim() || null)
      setRenaming(null)
    } catch (reason) {
      setRenameError(
        reason instanceof Error && reason.message
          ? reason.message
          : t('common.saveError', 'انجام نشد'),
      )
    } finally {
      setIsRenaming(false)
    }
  }

  // Row «حذف»: the till waiting for a yes.
  const [removing, setRemoving] = useState<AbandonedSession | null>(null)
  // Row «بستن»: the till being counted, and the count.
  const [closing, setClosing] = useState<AbandonedSession | null>(null)
  const [countedMinor, setCountedMinor] = useState(0)
  const [varianceReason, setVarianceReason] = useState('')
  const closeVariance = closing ? countedMinor - closing.expectedCashMinor : 0

  const [ledgerSearch, setLedgerSearch] = useState('')
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all')
  const [ledgerPage, setLedgerPage] = useState(0)

  // Another till → its own first page, filter and search.
  useEffect(() => {
    setLedgerPage(0)
    setLedgerSearch('')
    setLedgerFilter('all')
  }, [selectedTillId])

  // Today and yesterday from the server's daily aggregate (last two days of
  // the window). Missing days are real zeros there, never gaps.
  const today = dailyCashFlow[dailyCashFlow.length - 1] ?? { inMinor: 0, outMinor: 0 }
  const yesterday = dailyCashFlow[dailyCashFlow.length - 2] ?? { inMinor: 0, outMinor: 0 }

  const eventCount = ledger.filter((entry) => entry.kind !== 'opening_float').length

  // «+13% نسبت به روز قبل» is a claim about two loaded days. While the
  // aggregate is loading or its read failed there is nothing to compare.
  const cashFlowKnown = !isCashFlowLoading && !cashFlowError

  // On the list no till is selected, so «the balance of the till» has no
  // answer. What does: how many tills are open, and what the server recorded
  // in the tills of ONE currency. Amounts of two currencies are never added.
  const listCurrency = selectedCurrency ?? bookCurrency
  const tillsOfListCurrency = tills.filter(
    (item) => (item.currency ?? bookCurrency) === listCurrency,
  )
  const recordedInListCurrency = tillsOfListCurrency.reduce(
    (sum, item) => sum + item.expectedCashMinor,
    0,
  )
  const tillsKnown = !isTillsLoading && !tillsError

  const nameOfTill = (sessionId: string) => tillLabels[sessionId] ?? t('till.unnamed', 'بدون نام')
  const statusWord = (status: string | null | undefined) =>
    status === 'suspended' ? t('till.status_suspended', 'معلق') : t('till.status_open', 'باز')
  // The till open on the detail page, as the list knows it (what «count and
  // close» needs). Null while the list has not arrived.
  const selectedListed = selectedTillId
    ? (tills.find((item) => item.sessionId === selectedTillId) ?? null)
    : null
  const startClosing = (item: AbandonedSession) => {
    setClosing(item)
    setCountedMinor(0)
    setVarianceReason('')
  }
  // «درصد سود» says something only about a sale receipt. A drawer that has
  // none (an opening float, deposits, withdrawals) does not get a column of dashes.
  const hasMargin = ledger.some((entry) => typeof entry.marginPercent === 'number')

  // Presentation of the server's entries: which ones to show.
  const ledgerRows = useMemo(
    () =>
      [...ledger]
        .reverse()
        .filter((entry) =>
          ledgerFilter === 'all'
            ? true
            : ledgerFilter === 'in'
              ? entry.amountMinor > 0 && entry.kind !== 'opening_float'
              : ledgerFilter === 'out'
                ? entry.amountMinor < 0
                : entry.kind === 'settlement_in' || entry.kind === 'settlement_out',
        )
        .filter((entry) =>
          matchesSearch(ledgerSearch, [
            entry.reference,
            t(`till.kind_${entry.kind}`, entry.kind),
            dateTime(entry.at),
          ]),
        ),
    [ledger, ledgerFilter, ledgerSearch, t, dateTime],
  )

  const pageCount = Math.max(1, Math.ceil(ledgerRows.length / PAGE_SIZE))
  const pagedRows = ledgerRows.slice(ledgerPage * PAGE_SIZE, (ledgerPage + 1) * PAGE_SIZE)

  const ledgerColumns = useMemo<TableColumn<DrawerEntry>[]>(
    () => [
      {
        id: 'at',
        labelKey: 'till.col_time',
        labelFallback: 'تاریخ و زمان',
        sortValue: (entry) => entry.at,
        render: (entry) => (
          <span className="whitespace-nowrap text-xs text-[hsl(var(--fg-tertiary))]">
            {dateTime(entry.at)}
          </span>
        ),
      },
      {
        id: 'kind',
        labelKey: 'till.col_type',
        labelFallback: 'نوع تراکنش',
        locked: true,
        sortValue: (entry) => entry.kind,
        render: (entry) => (
          <span
            className={
              entry.amountMinor >= 0
                ? 'text-[hsl(var(--color-success))]'
                : 'text-[hsl(var(--color-destructive))]'
            }
          >
            {t(`till.kind_${entry.kind}`, entry.kind)}
          </span>
        ),
      },
      {
        id: 'reference',
        labelKey: 'till.col_reference',
        labelFallback: 'شرح / مرجع',
        showFrom: 'md',
        sortValue: (entry) => entry.reference ?? '',
        render: (entry) => (
          <span className="block max-w-[16rem] truncate text-[hsl(var(--fg-secondary))]" dir="auto">
            {entry.reference || '—'}
          </span>
        ),
      },
      {
        id: 'amount',
        labelKey: 'till.col_amount',
        labelFallback: 'مبلغ',
        align: 'end',
        sortValue: (entry) => entry.amountMinor,
        render: (entry) => (
          <Money
            minor={entry.amountMinor}
            currency={session?.currency ?? undefined}
            signed
            tone={entry.kind === 'opening_float' ? 'muted' : 'auto'}
          />
        ),
      },
      ...(hasMargin
        ? [
            {
              id: 'margin',
              labelKey: 'till.col_margin',
              labelFallback: 'درصد سود',
              align: 'end' as const,
              showFrom: 'md' as const,
              sortValue: (entry: DrawerEntry) => entry.marginPercent ?? null,
              render: (entry: DrawerEntry) => (
                <span className="tabular-nums" dir="ltr">
                  <MarginCell value={entry.marginPercent} />
                </span>
              ),
            },
          ]
        : []),
      {
        id: 'balance',
        labelKey: 'till.balance_after',
        labelFallback: 'موجودی',
        align: 'end',
        render: (entry) => (
          <Money minor={entry.balanceMinor} currency={session?.currency ?? undefined} tone="auto" />
        ),
      },
    ],
    [dateTime, session?.currency, t, hasMargin],
  )

  const tillRows = useMemo(
    () =>
      tills.filter((item) =>
        matchesSearch(tillSearch, [
          tillLabels[item.sessionId] ?? '',
          dateTime(item.openedAt),
          item.orderCount,
          item.openedBy,
        ]),
      ),
    [tills, dateTime, tillSearch, tillLabels],
  )

  const tillColumns = useMemo<TableColumn<AbandonedSession>[]>(
    () => [
      {
        id: 'till',
        labelKey: 'till.col_till',
        labelFallback: 'صندوق',
        locked: true,
        render: (item) => (
          <button
            type="button"
            onClick={() => onSelectTill(item.sessionId)}
            className="text-start font-medium text-[hsl(var(--color-primary))] hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--color-primary))]"
          >
            {tillLabels[item.sessionId] ?? t('till.unnamed', 'بدون نام')}
          </button>
        ),
      },
      {
        id: 'expectedCash',
        labelKey: 'till.expected_cash',
        labelFallback: 'موجودی ثبت‌شده در سیستم',
        align: 'end',
        locked: true,
        sortValue: (item) => item.expectedCashMinor,
        render: (item) => (
          <Money
            minor={item.expectedCashMinor}
            currency={item.currency ?? bookCurrency ?? undefined}
          />
        ),
      },
      {
        id: 'currency',
        labelKey: 'till.col_currency',
        labelFallback: 'ارز',
        align: 'start',
        sortValue: (item) => item.currency ?? '',
        render: (item) => (
          <span className="rounded bg-[hsl(var(--surface-muted))] px-1.5 py-0.5 text-xs font-semibold uppercase text-[hsl(var(--fg-secondary))]">
            {item.currency ?? bookCurrency ?? '—'}
          </span>
        ),
      },
      {
        id: 'status',
        labelKey: 'till.col_status',
        labelFallback: 'وضعیت',
        align: 'start',
        sortValue: (item) => item.status ?? 'open',
        render: (item) => (
          <span
            className={
              item.status === 'suspended'
                ? 'rounded-full bg-[hsl(var(--color-warning)/0.12)] px-2 py-0.5 text-xs text-[hsl(var(--color-warning))]'
                : 'rounded-full bg-[hsl(var(--color-success)/0.12)] px-2 py-0.5 text-xs text-[hsl(var(--color-success))]'
            }
          >
            {item.status === 'suspended'
              ? t('till.status_suspended', 'معلق')
              : t('till.status_open', 'باز')}
          </span>
        ),
      },
      {
        id: 'openedAt',
        labelKey: 'till.opened_at',
        labelFallback: 'زمان باز شدن',
        showFrom: 'md',
        sortValue: (item) => item.openedAt,
        render: (item) => (
          <span className="text-[hsl(var(--fg-secondary))]">{dateTime(item.openedAt)}</span>
        ),
      },
      {
        id: 'hoursOpen',
        labelKey: 'till.hours_open',
        labelFallback: 'ساعت باز',
        align: 'end',
        showFrom: 'md',
        sortValue: (item) => item.hoursOpen,
        render: (item) => (
          <span className="tabular-nums text-[hsl(var(--fg-secondary))]">
            {Math.round(item.hoursOpen)} {t('till.hours_short', 'ساعت')}
          </span>
        ),
      },
      {
        id: 'orderCount',
        labelKey: 'till.orders',
        labelFallback: 'فروش‌ها',
        align: 'end',
        showFrom: 'md',
        sortValue: (item) => item.orderCount,
        render: (item) => <span className="tabular-nums">{item.orderCount}</span>,
      },
      {
        id: 'actions',
        labelKey: 'till.col_actions',
        labelFallback: 'عملیات',
        align: 'end',
        locked: true,
        render: (item) => (
          // stopPropagation: the row click selects the till; these act on it.
          // ONE visible action — the one a day ends with. Everything else is
          // behind «more», and removing is last and marked as what it is.
          <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <ActionButton
              variant="quiet"
              className="min-h-8 px-3 text-xs"
              disabled={isBusy}
              onClick={() => {
                setClosing(item)
                setCountedMinor(0)
                setVarianceReason('')
              }}
            >
              {t('till.close_title', 'شمارش و بستن')}
            </ActionButton>
            <DropdownMenu>
              {/* A bare <button>: Radix's Slot clones exactly one element. */}
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={isBusy}
                  aria-label={t('till.more_actions', 'عملیات بیشتر')}
                  title={t('till.more_actions', 'عملیات بیشتر')}
                  className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] focus:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--color-primary))] disabled:opacity-50"
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setRenameError(null)
                    setNameDraft(tillLabels[item.sessionId] ?? '')
                    setRenaming(item)
                  }}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  {t('till.rename', 'ویرایش نام صندوق')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onSetSuspended(item.sessionId, item.status !== 'suspended')}
                >
                  {item.status === 'suspended'
                    ? t('till.resume', 'ادامه')
                    : t('till.suspend', 'تعلیق')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(item)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  {t('till.remove_title', 'حذف صندوق')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        ),
      },
    ],
    [dateTime, t, isBusy, onSetSuspended, tillLabels, onSelectTill, bookCurrency],
  )

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={selectedTillId && session ? nameOfTill(session.id) : t('till.title', 'صندوق')}
        description={
          selectedTillId && session
            ? `${session.currency ?? bookCurrency ?? ''} · ${statusWord(session.status)} · ${t('till.opened_at', 'زمان باز شدن')}: ${dateTime(session.openedAt)}`
            : t('till.subtitle', 'باز کردن، ثبت نقدی و شمارش صندوق')
        }
        action={
          <span className="flex flex-wrap items-center justify-end gap-2">
            {selectedTillId ? (
              <ActionButton variant="quiet" onClick={onBackToList} className="gap-1">
                <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
                {t('till.back_to_tills', '← صندوق‌ها')}
              </ActionButton>
            ) : null}
            <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
              {t('common.refresh', 'تازه‌سازی')}
            </ActionButton>
            {!selectedTillId ? (
              <ActionButton onClick={() => setAddTillOpen(true)} disabled={isBusy}>
                <Plus className="me-1 size-4" aria-hidden="true" />
                {t('till.add_till', 'افزودن صندوق')}
              </ActionButton>
            ) : null}
          </span>
        }
      />

      {closeNotice ? (
        <div
          role="status"
          className="rounded-xl border border-[hsl(var(--color-info)/0.3)] bg-[hsl(var(--color-info)/0.08)] px-4 py-3 text-sm text-[hsl(var(--color-info))]"
        >
          <p>{closeNotice}</p>
        </div>
      ) : null}

      {actionError && !addTillOpen && !movementOpen && !closing ? (
        <ErrorNote message={actionError} />
      ) : null}

      {error ? (
        <ErrorNote
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry', 'تلاش دوباره')}
        />
      ) : null}

      {/* ─── KPIs — rendered directly under header/error, frame renders immediately without layout jump ─── */}
      <section
        aria-label={t('till.kpis', 'خلاصه‌ی امروز صندوق')}
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Stat
          icon={ArrowDownLeft}
          label={t('till.today_in', 'کل دریافتی امروز')}
          value={
            isCashFlowLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : cashFlowError ? (
              '—'
            ) : (
              <Money minor={today.inMinor} currency={selectedCurrency} />
            )
          }
          hint={
            cashFlowKnown ? (
              <DeltaHint t={t} now={today.inMinor} before={yesterday.inMinor} goodWhenUp />
            ) : undefined
          }
        />
        <Stat
          icon={ArrowUpRight}
          label={t('till.today_out', 'کل پرداختی امروز')}
          value={
            isCashFlowLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : cashFlowError ? (
              '—'
            ) : (
              <Money minor={today.outMinor} currency={selectedCurrency} />
            )
          }
          hint={
            cashFlowKnown ? (
              <DeltaHint
                t={t}
                now={today.outMinor}
                before={yesterday.outMinor}
                goodWhenUp={false}
              />
            ) : undefined
          }
        />
        {selectedTillId ? (
          <>
            <Stat
              icon={Wallet}
              label={t('till.expected_cash', 'موجودی ثبت‌شده در سیستم')}
              value={
                isSessionLoading ? (
                  <Skeleton className="h-7 w-20" />
                ) : session && totals ? (
                  <Money
                    minor={totals.expectedCashMinor}
                    currency={session.currency ?? selectedCurrency}
                  />
                ) : (
                  '—'
                )
              }
              hint={
                session && totals
                  ? t('till.expected_hint', 'محاسبه‌ی سرور — قابل ویرایش نیست')
                  : undefined
              }
            />
            <Stat
              icon={ShoppingCart}
              label={t('till.session_transactions', 'تعداد تراکنش‌های این نوبت')}
              value={
                isSessionLoading ? (
                  <Skeleton className="h-7 w-20" />
                ) : session ? (
                  isLedgerLoading || ledgerError ? (
                    '—'
                  ) : (
                    eventCount
                  )
                ) : (
                  '—'
                )
              }
              hint={
                session && totals && totals.voidedCount > 0
                  ? `${t('till.transactions_hint', 'بدون نقد اولیه')} · ${t('till.voided', 'ابطال‌شده')}: ${totals.voidedCount}`
                  : t('till.transactions_hint', 'بدون نقد اولیه')
              }
            />
          </>
        ) : (
          <>
            <Stat
              icon={Wallet}
              label={t('till.open_tills_cash', 'موجودی ثبت‌شده‌ی صندوق‌های باز')}
              value={
                isTillsLoading ? (
                  <Skeleton className="h-7 w-20" />
                ) : tillsKnown && listCurrency ? (
                  <Money minor={recordedInListCurrency} currency={listCurrency} />
                ) : (
                  '—'
                )
              }
              hint={
                tillsKnown && listCurrency
                  ? `${t('till.only_currency', 'فقط صندوق‌های این ارز')}: ${listCurrency}`
                  : undefined
              }
            />
            <Stat
              icon={ShoppingCart}
              label={t('till.open_tills', 'صندوق‌های باز')}
              value={
                isTillsLoading ? <Skeleton className="h-7 w-20" /> : tillsKnown ? tills.length : '—'
              }
              hint={
                tillsKnown && tills.length === 0
                  ? t('till.no_open_session', 'صندوقی باز نیست')
                  : undefined
              }
            />
          </>
        )}
      </section>

      {/* ─── Detail State (?till=<id>) vs List State ─── */}
      {selectedTillId ? (
        <div className="space-y-4">
          {session && session.status === 'open' ? (
            <div className="flex flex-wrap items-center gap-2" data-till-actions>
              <ActionButton onClick={() => openMovementForm('cash_in')} disabled={isBusy}>
                <ArrowDownLeft className="me-1 size-4" aria-hidden="true" />
                {t('till.add_cash', 'واریز نقدی')}
              </ActionButton>
              <ActionButton
                variant="quiet"
                onClick={() => openMovementForm('cash_out')}
                disabled={isBusy}
              >
                <ArrowUpRight className="me-1 size-4" aria-hidden="true" />
                {t('till.take_cash', 'برداشت نقدی')}
              </ActionButton>
              <ActionButton
                variant="quiet"
                // The list knows what closing needs; until it has arrived
                // there is nothing to count against.
                disabled={isBusy || !selectedListed}
                onClick={() => (selectedListed ? startClosing(selectedListed) : undefined)}
              >
                {t('till.close_title', 'شمارش و بستن')}
              </ActionButton>
            </div>
          ) : null}

          {isSessionLoading ? (
            <Loading label={t('common.loading', 'در حال بارگذاری…')} />
          ) : sessionError && !sessionNotFound ? (
            // The read failed. That is not «there is no such till».
            <ErrorNote
              message={sessionError}
              onRetry={onRefresh}
              retryLabel={t('common.retry', 'تلاش دوباره')}
            />
          ) : sessionNotFound || !session || !totals ? (
            <EmptyState
              icon="search"
              title={t('till.not_found', 'صندوق مورد نظر یافت نشد.')}
              {...(onBackToList
                ? {
                    action: {
                      label: t('till.back_to_tills', '← صندوق‌ها'),
                      onClick: onBackToList,
                    },
                  }
                : {})}
            />
          ) : (
            <ListSection
              title={
                tillLabels[session.id]
                  ? `${tillLabels[session.id]} — ${t('till.ledger_title', 'دفتر روزنامه صندوق')}`
                  : t('till.ledger_title', 'دفتر روزنامه صندوق')
              }
              description={t(
                'till.ledger_hint',
                'هر ورود و خروج نقد با موجودی پس از آن. پرداخت‌های نقدی فاکتور خودکار اینجا می‌آیند.',
              )}
            >
              {/* What the drawer started with and sold. The recorded balance
                  is the figure at the top — it is not repeated here. */}
              <div
                className="mb-4 space-y-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.3)] p-4"
                data-till-money
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-[hsl(var(--fg-secondary))]">
                      {t('till.opening_float', 'نقد اولیه')}
                    </span>
                    <div className="mt-1">
                      <Money
                        minor={session.openingFloatMinor}
                        currency={session.currency ?? undefined}
                        tone="muted"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-[hsl(var(--fg-secondary))]">
                      {t('till.gross_sales', 'فروش ناخالص')}
                    </span>
                    <div className="mt-1">
                      <Money
                        minor={totals.grossSalesMinor}
                        currency={session.currency ?? undefined}
                        tone="muted"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[hsl(var(--fg-secondary))]">
                  {t(
                    'till.recorded_cash_hint',
                    'موجودی ثبت‌شده = نقد اولیه + ورودهای نقدی − خروج‌های نقدی، طبق ثبت‌های سیستم. مبلغ واقعی داخل صندوق تا وقتی آن را نشمارید معلوم نیست.',
                  )}
                </p>
              </div>

              {isLedgerLoading ? (
                <Loading label={t('common.loading', 'در حال بارگذاری…')} />
              ) : ledgerError ? (
                <ErrorNote
                  message={ledgerError}
                  onRetry={onRefresh}
                  retryLabel={t('common.retry', 'تلاش دوباره')}
                />
              ) : (
                <>
                  <DataTable
                    tableId="till-ledger"
                    t={t}
                    rows={pagedRows}
                    columns={ledgerColumns}
                    // The balance after it tells apart two movements of the
                    // same kind and amount in the same second.
                    rowKey={(entry) =>
                      `${entry.sourceId ?? ''}-${entry.at}-${entry.kind}-${entry.amountMinor}-${entry.balanceMinor}`
                    }
                    searchValue={ledgerSearch}
                    onSearchChange={(value) => {
                      setLedgerSearch(value)
                      setLedgerPage(0)
                    }}
                    actions={
                      <TableFilterSelect
                        label={t('till.ledger_filter', 'نوع')}
                        value={ledgerFilter}
                        onChange={(next) => {
                          setLedgerFilter(LEDGER_FILTERS.find((known) => known === next) ?? 'all')
                          setLedgerPage(0)
                        }}
                        allValue="all"
                        options={[
                          { value: 'all', label: t('common.all', 'همه') },
                          { value: 'in', label: t('till.filter_in', 'ورود') },
                          { value: 'out', label: t('till.filter_out', 'خروج') },
                          { value: 'invoices', label: t('till.filter_invoices', 'فاکتورها') },
                        ]}
                      />
                    }
                    minWidthClass="min-w-[420px] sm:min-w-[640px]"
                    emptyState={
                      <EmptyState
                        icon="search"
                        title={t('till.ledger_empty', 'تراکنشی با این فیلتر نیست')}
                      />
                    }
                  />

                  {ledgerRows.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[hsl(var(--fg-tertiary))]">
                      <span>
                        {t('till.showing', 'نمایش')}{' '}
                        <span className="tabular-nums">{ledgerPage * PAGE_SIZE + 1}</span>
                        {' – '}
                        <span className="tabular-nums">
                          {Math.min((ledgerPage + 1) * PAGE_SIZE, ledgerRows.length)}
                        </span>{' '}
                        {t('till.of', 'از')}{' '}
                        <span className="tabular-nums">{ledgerRows.length}</span>
                      </span>
                      {pageCount > 1 ? (
                        <span className="flex items-center gap-1">
                          <ActionButton
                            variant="quiet"
                            className="min-h-9"
                            disabled={ledgerPage === 0}
                            onClick={() => setLedgerPage((p) => Math.max(0, p - 1))}
                            aria-label={t('till.prev_page', 'صفحه‌ی قبل')}
                          >
                            ‹
                          </ActionButton>
                          <span className="tabular-nums px-2">
                            {ledgerPage + 1} / {pageCount}
                          </span>
                          <ActionButton
                            variant="quiet"
                            className="min-h-9"
                            disabled={ledgerPage >= pageCount - 1}
                            onClick={() => setLedgerPage((p) => Math.min(pageCount - 1, p + 1))}
                            aria-label={t('till.next_page', 'صفحه‌ی بعد')}
                          >
                            ›
                          </ActionButton>
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </ListSection>
          )}
        </div>
      ) : (
        /* ─── LIST STATE (default) ─── */
        <>
          {availableCurrencies && availableCurrencies.length > 1 ? (
            // One currency at a time. There is no «all currencies»: afghani and
            // dollars in one figure is not a total.
            <div className="flex justify-end" data-till-currency>
              <TableFilterSelect
                label={t('till.filter_currency', 'ارز')}
                value={selectedCurrency ?? ''}
                onChange={(cur) => onSelectCurrency?.(cur)}
                allValue={bookCurrency ?? ''}
                options={availableCurrencies.map((c) => ({
                  value: c,
                  label: t(`currency.${c.toLowerCase()}`, c),
                }))}
              />
            </div>
          ) : null}

          {/* ─── Tills — every open till; click one to see its transactions ─── */}
          <ListSection
            title={t('till.tills_title', 'صندوق‌ها')}
            description={t(
              'till.tills_hint',
              'صندوق‌های باز این کسب‌وکار. روی هر صندوق بزنید تا تراکنش‌هایش را ببینید.',
            )}
          >
            {isTillsLoading ? (
              <Loading label={t('common.loading', 'در حال بارگذاری…')} />
            ) : tillsError ? (
              <ErrorNote
                message={tillsError}
                onRetry={onRefresh}
                retryLabel={t('common.retry', 'تلاش دوباره')}
              />
            ) : (
              <DataTable
                tableId="till-list"
                t={t}
                rows={tillRows}
                columns={tillColumns}
                rowKey={(item) => item.sessionId}
                onRowClick={(item) => onSelectTill(item.sessionId)}
                searchValue={tillSearch}
                onSearchChange={setTillSearch}
                minWidthClass="min-w-[480px]"
                emptyState={
                  <EmptyState icon="search" title={t('till.no_open_session', 'صندوقی باز نیست')} />
                }
              />
            )}
          </ListSection>
        </>
      )}

      {removing ? (
        <Dialog open onOpenChange={(open) => !open && setRemoving(null)}>
          <DialogContent className="sm:max-w-sm" data-remove-till="">
            <DialogHeader>
              <DialogTitle>{t('till.remove_title', 'حذف صندوق')}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-[hsl(var(--fg-primary))]">
              <span className="font-medium">{nameOfTill(removing.sessionId)}</span>
              <span className="ms-2 text-xs text-[hsl(var(--fg-secondary))]">
                {removing.currency ?? bookCurrency ?? ''} · {statusWord(removing.status)} ·{' '}
                {dateTime(removing.openedAt)}
              </span>
            </p>
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t(
                'till.remove_hint',
                'فقط صندوقی حذف می‌شود که هیچ فروش، نقد یا پرداختی در آن ثبت نشده باشد. صندوقی که پول دیده است باید بسته شود.',
              )}
            </p>
            <DialogFooter className="gap-2">
              <ActionButton variant="quiet" onClick={() => setRemoving(null)} disabled={isBusy}>
                {t('common.cancel', 'انصراف')}
              </ActionButton>
              <ActionButton
                disabled={isBusy}
                onClick={() => {
                  onRemoveTill(removing.sessionId)
                  setRemoving(null)
                }}
              >
                {t('common.delete', 'حذف')}
              </ActionButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {renaming ? (
        <Dialog open onOpenChange={(open) => !open && setRenaming(null)}>
          <DialogContent className="sm:max-w-sm" data-rename-till="">
            <DialogHeader>
              <DialogTitle>{t('till.rename', 'ویرایش نام صندوق')}</DialogTitle>
            </DialogHeader>
            <Field
              label={t('till.name', 'نام صندوق')}
              value={nameDraft}
              onChange={(value) => setNameDraft(value.slice(0, 80))}
              disabled={isRenaming}
            />
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t(
                'till.rename_hint',
                'فقط نام قابل ویرایش است؛ پول و تراکنش‌های صندوق تغییر نمی‌کند. برای کنار گذاشتن صندوق، آن را ببندید.',
              )}
            </p>
            {renameError ? <ErrorNote message={renameError} /> : null}
            <DialogFooter className="gap-2">
              <ActionButton variant="quiet" onClick={() => setRenaming(null)} disabled={isRenaming}>
                {t('common.cancel', 'انصراف')}
              </ActionButton>
              <ActionButton onClick={() => void saveName()} disabled={isRenaming}>
                {t('common.save', 'ذخیره')}
              </ActionButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {addTillOpen ? (
        <Dialog open onOpenChange={(open) => !open && setAddTillOpen(false)}>
          <DialogContent className="sm:max-w-sm" data-add-till="">
            <DialogHeader>
              <DialogTitle>{t('till.add_till', 'افزودن صندوق')}</DialogTitle>
            </DialogHeader>
            <Field
              label={t('till.name', 'نام صندوق')}
              name="label"
              value={labelDraft}
              onChange={(value) => setLabelDraft(value.slice(0, 80))}
              disabled={isBusy}
            />
            <p className="text-xs text-[hsl(var(--fg-secondary))]">
              {t('till.name_required', 'نام لازم است: با چند صندوق، نام تنها راه شناختن آن‌هاست.')}
            </p>
            <SelectField
              label={t('till.currency', 'ارز / واحد')}
              value={currencyDraft}
              onChange={chooseCurrency}
              options={currencyOptions}
              disabled={isBusy || !bookCurrency}
            />
            <MinorInput
              label={t('till.opening_float', 'نقد اولیه')}
              value={floatMinor}
              onChange={setFloatMinor}
              currency={currencyDraft}
              disabled={isBusy}
            />
            {actionError ? <ErrorNote message={actionError} /> : null}
            <DialogFooter className="gap-2">
              <ActionButton variant="quiet" onClick={() => setAddTillOpen(false)} disabled={isBusy}>
                {t('common.cancel', 'انصراف')}
              </ActionButton>
              <ActionButton
                onClick={() => {
                  // The dialog closes when the till exists — not when the
                  // button was pressed. A refusal leaves what was typed.
                  void onOpen({
                    openingFloatMinor: floatMinor,
                    ...(labelDraft.trim() ? { label: labelDraft.trim() } : {}),
                    ...(currencyDraft ? { currency: currencyDraft } : {}),
                  }).then((opened) => {
                    if (!opened) return
                    setAddTillOpen(false)
                    setFloatMinor(0)
                    setLabelDraft('')
                  })
                }}
                disabled={isBusy || !bookCurrency || !currencyDraft || labelDraft.trim() === ''}
              >
                {t('till.open_action', 'باز کردن صندوق')}
              </ActionButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {movementOpen && session && session.status === 'open' ? (
        <Dialog open onOpenChange={(open) => !open && !isBusy && setMovementOpen(false)}>
          <DialogContent className="sm:max-w-sm" data-movement-till="">
            <DialogHeader>
              <DialogTitle>
                {t('till.record_movement', 'ثبت تراکنش نقدی')} — {nameOfTill(session.id)}
              </DialogTitle>
            </DialogHeader>
            <SegmentedControl
              label={t('till.movement_direction', 'جهت تراکنش')}
              options={[
                { value: 'cash_in', label: t('till.direction_in', 'ورودی به صندوق') },
                { value: 'cash_out', label: t('till.direction_out', 'خروجی از صندوق') },
              ]}
              value={movementKind}
              onChange={(v) => setMovementKind(v as 'cash_in' | 'cash_out')}
            />
            <MinorInput
              label={t('till.amount', 'مبلغ')}
              value={movementAmountMinor}
              onChange={setMovementAmountMinor}
              currency={session.currency ?? undefined}
              disabled={isBusy}
            />
            <Field
              label={t('till.reason', 'دلیل')}
              value={movementReason}
              onChange={setMovementReason}
              disabled={isBusy}
            />
            {actionError ? <ErrorNote message={actionError} /> : null}
            <DialogFooter className="gap-2">
              <ActionButton
                variant="quiet"
                onClick={() => setMovementOpen(false)}
                disabled={isBusy}
              >
                {t('common.cancel', 'انصراف')}
              </ActionButton>
              <ActionButton
                disabled={
                  isBusy ||
                  !movementRequestId ||
                  movementAmountMinor <= 0 ||
                  movementReason.trim() === ''
                }
                onClick={() => {
                  // Closed and emptied only once the server has it. A
                  // refusal keeps the amount and the reason on screen.
                  void onRecordMovement({
                    kind: movementKind,
                    amountMinor: movementAmountMinor,
                    reason: movementReason.trim(),
                    movementId: movementRequestId,
                  }).then((recorded) => {
                    if (!recorded) return
                    setMovementOpen(false)
                    setMovementAmountMinor(0)
                    setMovementReason('')
                    setMovementRequestId('')
                  })
                }}
              >
                {t('till.add_cash_confirm', 'ثبت')}
              </ActionButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {closing ? (
        <Dialog open onOpenChange={(open) => !open && !isBusy && setClosing(null)}>
          <DialogContent className="sm:max-w-sm" data-close-till="">
            <DialogHeader>
              <DialogTitle>
                {t('till.close_title', 'شمارش و بستن')} — {nameOfTill(closing.sessionId)}
              </DialogTitle>
            </DialogHeader>
            {/* Three different things, on three lines: what the system
                recorded, what a person counted, and the gap between them. */}
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[hsl(var(--surface-muted)/0.4)] px-4 py-3 text-sm">
              <span>{t('till.expected_cash', 'موجودی ثبت‌شده در سیستم')}</span>
              <Money
                minor={closing.expectedCashMinor}
                currency={closing.currency ?? bookCurrency ?? undefined}
                tone="muted"
              />
            </div>
            <MinorInput
              label={t('till.counted_cash', 'موجودی شمارش‌شده')}
              value={countedMinor}
              onChange={setCountedMinor}
              currency={closing.currency ?? bookCurrency ?? undefined}
              disabled={isBusy}
            />
            <div
              className="flex items-center justify-between gap-2 px-1 text-sm"
              data-close-variance
            >
              <span>{t('till.variance', 'مغایرت صندوق')}</span>
              <Money
                minor={closeVariance}
                currency={closing.currency ?? bookCurrency ?? undefined}
                signed
                tone="auto"
              />
            </div>
            {closeVariance !== 0 ? (
              <Field
                label={t('till.variance_reason', 'توضیح اختلاف')}
                value={varianceReason}
                onChange={setVarianceReason}
                disabled={isBusy}
              />
            ) : null}
            {actionError ? <ErrorNote message={actionError} /> : null}
            <DialogFooter className="gap-2">
              <ActionButton variant="quiet" onClick={() => setClosing(null)} disabled={isBusy}>
                {t('common.cancel', 'انصراف')}
              </ActionButton>
              <ActionButton
                disabled={isBusy || (closeVariance !== 0 && varianceReason.trim() === '')}
                onClick={() => {
                  // The count stays until the till is closed: a refusal
                  // (a variance with no reason, a lost connection) must
                  // not make a person count the drawer again.
                  void onCloseTill({
                    sessionId: closing.sessionId,
                    countedCashMinor: countedMinor,
                    ...(varianceReason.trim() ? { varianceReason: varianceReason.trim() } : {}),
                  }).then((closed) => {
                    if (closed) setClosing(null)
                  })
                }}
              >
                {t('till.close_action', 'بستن صندوق')}
              </ActionButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </CapabilityPage>
  )
})

TillView.displayName = 'TillView'
