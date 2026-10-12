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
import dynamic from 'next/dynamic'
import { Skeleton } from '../skeleton'
import { formatSelectedMoney, documentIntlLocale } from '../../../lib/money-display'
import { formatMoney, FRACTION_DIGITS, type KnownCurrency } from '@hisabche/formatting'
import { CURRENCY_CODES } from '@hisabche/validation'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
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
  Panel,
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
  cashFlowDays: 7 | 30 | 90
  onCashFlowDaysChange: (days: 7 | 30 | 90) => void
  isCashFlowLoading: boolean
  cashFlowError: string | null
}

type LedgerFilter = 'all' | 'in' | 'out' | 'invoices'
const LEDGER_FILTERS: readonly LedgerFilter[] = ['all', 'in', 'out', 'invoices']
type CashFlowRange = '7' | '30' | '90'

const PAGE_SIZE = 10

const DistributionChart = dynamic(() => import('./till-distribution-chart-internal'), {
  ssr: false,
  loading: () => <Skeleton className="mx-auto size-44 rounded-full" />,
})

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

const CashFlowChart = dynamic(() => import('./till-cash-flow-chart-internal'), {
  ssr: false,
  loading: () => <Skeleton className="h-60 w-full rounded-xl" />,
})

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
  cashFlowDays,
  onCashFlowDaysChange,
  isCashFlowLoading,
  cashFlowError,
}: TillViewProps) {
  const { dateTime, date } = useDateFormat()

  const chartDigits =
    selectedCurrency && selectedCurrency in FRACTION_DIGITS
      ? FRACTION_DIGITS[selectedCurrency as KnownCurrency]
      : 2
  const chartFactor = 10 ** chartDigits

  const chartData = useMemo(
    () =>
      dailyCashFlow.map((d) => ({
        label: date(d.day, { month: 'short', day: 'numeric' }),
        in: d.inMinor / chartFactor,
        out: d.outMinor / chartFactor,
        net: d.netMinor / chartFactor,
      })),
    [dailyCashFlow, date, chartFactor],
  )

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
  const openMovementForm = () => {
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

  // On the list no till is selected, so there is no balance to show. That is
  // not «no till is open»: say which of the two it is, and nothing while the
  // list itself is still loading or could not be read.
  const noTillHint =
    isTillsLoading || tillsError
      ? undefined
      : tills.length > 0
        ? t('till.select_a_till', 'یک صندوق را انتخاب کنید')
        : t('till.no_open_session', 'صندوقی باز نیست')

  // Kinds of cash event in this session, counted from the drawer ledger.
  const distribution = useMemo(() => {
    const COLORS: Record<string, string> = {
      sale: 'hsl(var(--color-success))',
      settlement_in: 'hsl(var(--color-info))',
      settlement_out: 'hsl(var(--color-warning))',
      cash_in: 'hsl(var(--color-primary))',
      cash_out: 'hsl(var(--color-destructive))',
      transfer_to_bank: 'hsl(var(--fg-secondary))',
      transfer_from_bank: 'hsl(var(--fg-tertiary))',
    }
    const counts = new Map<string, number>()
    for (const entry of ledger) {
      if (entry.kind === 'opening_float') continue
      counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([kind, count]) => ({
        key: kind,
        label: t(`till.kind_${kind}`, kind),
        count,
        color: COLORS[kind] ?? 'hsl(var(--fg-tertiary))',
      }))
  }, [ledger, t])

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
      {
        id: 'margin',
        labelKey: 'till.col_margin',
        labelFallback: 'درصد سود',
        align: 'end',
        showFrom: 'md',
        sortValue: (entry) => entry.marginPercent ?? null,
        render: (entry) => (
          <span className="tabular-nums" dir="ltr">
            <MarginCell value={entry.marginPercent} />
          </span>
        ),
      },
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
    [dateTime, session?.currency, t],
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
        id: 'openedAt',
        labelKey: 'till.opened_at',
        labelFallback: 'زمان باز شدن',
        locked: true,
        sortValue: (item) => item.openedAt,
        render: (item) => (
          <span className="text-[hsl(var(--fg-primary))]">{dateTime(item.openedAt)}</span>
        ),
      },
      {
        id: 'hoursOpen',
        labelKey: 'till.hours_open',
        labelFallback: 'ساعت باز',
        align: 'end',
        sortValue: (item) => item.hoursOpen,
        render: (item) => (
          <span className="tabular-nums text-[hsl(var(--fg-secondary))]">
            {Math.round(item.hoursOpen)}
            {t('till.hours_short', 'س')}
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
        id: 'expectedCash',
        labelKey: 'till.expected_cash',
        labelFallback: 'نقد مورد انتظار',
        align: 'end',
        sortValue: (item) => item.expectedCashMinor,
        render: (item) => (
          <Money
            minor={item.expectedCashMinor}
            currency={item.currency ?? bookCurrency ?? undefined}
          />
        ),
      },
      {
        id: 'status',
        labelKey: 'till.col_status',
        labelFallback: 'وضعیت',
        align: 'end',
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
        id: 'actions',
        labelKey: 'till.col_actions',
        labelFallback: 'عملیات',
        align: 'end',
        locked: true,
        render: (item) => (
          // stopPropagation: the row click selects the till; these act on it.
          <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
            <ActionButton
              variant="quiet"
              className="min-h-8 px-3 text-xs"
              disabled={isBusy}
              aria-label={t('till.rename', 'ویرایش نام صندوق')}
              onClick={() => {
                setRenameError(null)
                setNameDraft(tillLabels[item.sessionId] ?? '')
                setRenaming(item)
              }}
            >
              <Pencil className="me-1 size-3.5" aria-hidden="true" />
              {t('common.edit', 'ویرایش')}
            </ActionButton>
            <ActionButton
              variant="quiet"
              className="min-h-8 px-3 text-xs"
              disabled={isBusy}
              onClick={() => onSetSuspended(item.sessionId, item.status !== 'suspended')}
            >
              {item.status === 'suspended' ? t('till.resume', 'ادامه') : t('till.suspend', 'تعلیق')}
            </ActionButton>
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
              {t('till.close_action', 'بستن صندوق')}
            </ActionButton>
            <ActionButton
              variant="quiet"
              className="min-h-8 px-3 text-xs"
              disabled={isBusy}
              aria-label={t('till.remove_title', 'حذف صندوق')}
              onClick={() => setRemoving(item)}
            >
              <Trash2 className="me-1 size-3.5" aria-hidden="true" />
              {t('common.delete', 'حذف')}
            </ActionButton>
          </span>
        ),
      },
    ],
    [dateTime, t, isBusy, onSetSuspended, tillLabels, onSelectTill, bookCurrency],
  )

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('till.title', 'صندوق')}
        description={t('till.subtitle', 'باز کردن، ثبت نقدی و شمارش صندوق')}
        action={
          <span className="flex flex-wrap items-center justify-end gap-2">
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

      {actionError ? <ErrorNote message={actionError} /> : null}

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
        <Stat
          icon={Wallet}
          label={t('till.balance_now', 'موجودی فعلی صندوق')}
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
              : noTillHint
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
              ? `${t('till.voided', 'ابطال‌شده')}: ${totals.voidedCount}`
              : undefined
          }
        />
      </section>

      {/* ─── Detail State (?till=<id>) vs List State ─── */}
      {selectedTillId ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ActionButton variant="quiet" onClick={onBackToList} className="gap-1">
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
              {t('till.back_to_tills', '← صندوق‌ها')}
            </ActionButton>
            {session && session.status === 'open' ? (
              <ActionButton onClick={openMovementForm} disabled={isBusy}>
                <Plus className="me-1 size-4" aria-hidden="true" />
                {t('till.add_cash', 'ثبت تراکنش نقدی')}
              </ActionButton>
            ) : null}
          </div>

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
              {/* Header card / summary of selected till */}
              <div className="mb-4 grid gap-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.3)] p-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('till.col_status', 'وضعیت')}
                  </span>
                  <div className="mt-1">
                    <span
                      className={
                        session.status === 'suspended'
                          ? 'rounded-full bg-[hsl(var(--color-warning)/0.12)] px-2 py-0.5 text-xs text-[hsl(var(--color-warning))]'
                          : 'rounded-full bg-[hsl(var(--color-success)/0.12)] px-2 py-0.5 text-xs text-[hsl(var(--color-success))]'
                      }
                    >
                      {session.status === 'suspended'
                        ? t('till.status_suspended', 'معلق')
                        : t('till.status_open', 'باز')}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('till.col_currency', 'ارز')}
                  </span>
                  <div className="mt-1 font-semibold uppercase">
                    {session.currency ?? bookCurrency ?? '—'}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('till.opened_at', 'زمان باز شدن')}
                  </span>
                  <div className="mt-1 text-sm">{dateTime(session.openedAt)}</div>
                </div>
                <div>
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">
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
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">
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
                <div>
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('till.expected_cash', 'نقد مورد انتظار')}
                  </span>
                  <div className="mt-1 text-base font-bold">
                    <Money
                      minor={totals.expectedCashMinor}
                      currency={session.currency ?? undefined}
                    />
                  </div>
                </div>
              </div>

              {/* Movement dialog */}
              {movementOpen && session.status === 'open' ? (
                <div className="mb-4 space-y-3 rounded-xl border border-[hsl(var(--border-default))] p-4">
                  <p className="text-sm font-medium">
                    {t('till.record_movement', 'ثبت تراکنش نقدی')}
                  </p>
                  <SegmentedControl
                    label={t('till.movement_direction', 'جهت تراکنش')}
                    options={[
                      { value: 'cash_in', label: t('till.direction_in', 'ورودی به صندوق') },
                      { value: 'cash_out', label: t('till.direction_out', 'خروجی از صندوق') },
                    ]}
                    value={movementKind}
                    onChange={(v) => setMovementKind(v as 'cash_in' | 'cash_out')}
                  />
                  <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
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
                  </div>
                  <div className="flex gap-2">
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
                    <ActionButton
                      variant="quiet"
                      onClick={() => setMovementOpen(false)}
                      disabled={isBusy}
                    >
                      {t('common.cancel', 'انصراف')}
                    </ActionButton>
                  </div>
                </div>
              ) : null}

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
          {/* What kinds of cash event THIS till has seen. It was on the list,
              where no till is selected, and said «صندوقی باز نیست» there
              whatever was open. */}
          {session && totals && !sessionNotFound ? (
            <div className="min-w-0">
              <Panel title={t('till.distribution_title', 'توزیع تراکنش‌ها')}>
                {isLedgerLoading ? (
                  <Skeleton className="mx-auto size-44 rounded-full" />
                ) : ledgerError ? (
                  <ErrorNote
                    message={ledgerError}
                    onRetry={onRefresh}
                    retryLabel={t('common.retry', 'تلاش دوباره')}
                  />
                ) : distribution.length === 0 ? (
                  <EmptyState
                    icon="search"
                    title={t('till.ledger_empty', 'تراکنشی با این فیلتر نیست')}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                    <DistributionChart
                      data={distribution}
                      centerLabel={t('till.transactions', 'تراکنش')}
                      size={168}
                    />
                    <ul className="w-full space-y-2 text-sm">
                      {distribution.map((slice) => (
                        <li key={slice.key} className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="size-3 shrink-0 rounded-full"
                              style={{ backgroundColor: slice.color }}
                            />
                            <span className="truncate">{slice.label}</span>
                          </span>
                          <span
                            className="shrink-0 tabular-nums text-[hsl(var(--fg-secondary))]"
                            dir="ltr"
                          >
                            {slice.count} · {Math.round((slice.count / eventCount) * 1000) / 10}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>
            </div>
          ) : null}
        </div>
      ) : (
        /* ─── LIST STATE (default) ─── */
        <>
          <div className="grid gap-4">
            <div className="min-w-0">
              <Panel
                title={t('till.cash_flow_title', 'جریان نقدی')}
                description={t(
                  'till.cash_flow_hint',
                  'دریافت و پرداخت نقدی همه‌ی صندوق‌ها و فاکتورها، به تفکیک روز.',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SegmentedControl
                    label={t('till.cash_flow_range', 'بازه')}
                    value={String(cashFlowDays) as CashFlowRange}
                    onChange={(next) => onCashFlowDaysChange(Number(next) as 7 | 30 | 90)}
                    options={[
                      { value: '7', label: t('till.range_7', '۷ روز') },
                      { value: '30', label: t('till.range_30', '۳۰ روز') },
                      { value: '90', label: t('till.range_90', '۹۰ روز') },
                    ]}
                  />
                  {availableCurrencies && availableCurrencies.length > 1 ? (
                    // One currency at a time. There is no «all currencies»:
                    // afghani and dollars on one axis is not a total, and the
                    // option used to show the books currency under that name.
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
                  ) : null}
                </div>
                <div className="mt-3">
                  {isCashFlowLoading ? (
                    <Skeleton className="h-60 w-full rounded-xl" />
                  ) : cashFlowError ? (
                    <ErrorNote
                      message={cashFlowError}
                      onRetry={onRefresh}
                      retryLabel={t('common.retry', 'تلاش دوباره')}
                    />
                  ) : dailyCashFlow.every((d) => d.inMinor === 0 && d.outMinor === 0) ? (
                    <EmptyState
                      icon="search"
                      title={t('till.cash_flow_empty', 'در این بازه جریان نقدی ثبت نشده')}
                    />
                  ) : (
                    <CashFlowChart
                      data={chartData}
                      labels={{
                        in: t('till.filter_in', 'ورود'),
                        out: t('till.filter_out', 'خروج'),
                        net: t('till.net_session', 'خالص جریان نقد'),
                      }}
                      fmt={(v) =>
                        selectedCurrency && selectedCurrency in FRACTION_DIGITS
                          ? formatMoney(v, selectedCurrency as KnownCurrency, documentIntlLocale())
                          : formatSelectedMoney(v)
                      }
                      height={240}
                    />
                  )}
                </div>
              </Panel>
            </div>
          </div>

          {/* ─── Tills — every open till; click one to see its transactions ─── */}
          <ListSection
            title={t('till.tills_title', 'صندوق‌ها')}
            description={t(
              'till.tills_hint',
              'صندوق‌های باز این کسب‌وکار. روی هر صندوق بزنید تا تراکنش‌هایش را ببینید.',
            )}
          >
            {closing ? (
              <div className="mb-3 space-y-3 rounded-xl border border-[hsl(var(--border-default))] p-3">
                <p className="text-sm font-medium">
                  {t('till.close_title', 'شمارش و بستن')} — {dateTime(closing.openedAt)}
                </p>
                <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                  <MinorInput
                    label={t('till.counted_cash', 'نقد شمرده‌شده')}
                    value={countedMinor}
                    onChange={setCountedMinor}
                    currency={closing.currency ?? bookCurrency ?? undefined}
                    disabled={isBusy}
                  />
                  <div className="self-end rounded-xl bg-[hsl(var(--surface-muted)/0.4)] px-4 py-3 text-sm">
                    {t('till.expected_cash', 'نقد مورد انتظار')}:{' '}
                    <Money
                      minor={closing.expectedCashMinor}
                      currency={closing.currency ?? bookCurrency ?? undefined}
                      tone="muted"
                    />{' '}
                    · {t('till.variance', 'اختلاف')}:{' '}
                    <Money
                      minor={closeVariance}
                      currency={closing.currency ?? bookCurrency ?? undefined}
                      signed
                      tone="auto"
                    />
                  </div>
                </div>
                {closeVariance !== 0 ? (
                  <Field
                    label={t('till.variance_reason', 'توضیح اختلاف')}
                    value={varianceReason}
                    onChange={setVarianceReason}
                    disabled={isBusy}
                  />
                ) : null}
                <div className="flex gap-2">
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
                  <ActionButton variant="quiet" onClick={() => setClosing(null)} disabled={isBusy}>
                    {t('common.cancel', 'انصراف')}
                  </ActionButton>
                </div>
              </div>
            ) : null}
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
            <p className="text-sm text-[hsl(var(--fg-secondary))]">
              {tillLabels[removing.sessionId] ?? dateTime(removing.openedAt)}
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
                disabled={isBusy || !bookCurrency || !currencyDraft}
              >
                {t('till.open_action', 'باز کردن صندوق')}
              </ActionButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </CapabilityPage>
  )
})

TillView.displayName = 'TillView'
