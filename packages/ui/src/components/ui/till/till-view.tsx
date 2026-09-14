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
// LAYOUT — the invoices list structure: header, stat strip, work, then the
// list (abandoned drawers) on the shared DataTable.
// ============================================

import { memo, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from '../skeleton'
import { formatSelectedMoney } from '../../../lib/money-display'
import { ArrowDownLeft, ArrowUpRight, Banknote, ShoppingCart, Wallet } from 'lucide-react'
import type {
  PosSession,
  SessionTotals,
  AbandonedSession,
  PosPaymentMethod,
  DrawerEntry,
  CashFlowDay,
} from '@hisabche/api'
import { SegmentedFilter } from '../segmented-filter'
import { useDateFormat } from '../../../hooks/use-date-format'
import { DataTable, matchesSearch, type TableColumn } from '../data-table'
import {
  ActionButton,
  Badge,
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
  Stat,
  StatGrid,
} from '../capability/capability-kit'

export interface TillViewProps {
  t: (key: string, fallback?: string) => string
  session: PosSession | null
  totals: SessionTotals | null
  abandoned: AbandonedSession[]
  /** Kept apart from `abandoned`: a failed read must not read as «none». */
  abandonedError: string | null
  isAbandonedLoading: boolean
  isLoading: boolean
  error: string | null
  isBusy: boolean
  actionError: string | null
  onRefresh: () => void
  onOpen: (openingFloatMinor: number) => void
  onCashMovement: (input: {
    kind: 'cash_in' | 'cash_out'
    amountMinor: number
    reason: string
  }) => void
  onClose: (input: { countedCashMinor: number; varianceReason?: string }) => void
  /** The drawer as a ledger, from the server. Last balance = expected cash. */
  /** Cash between the till and the bank, posted to the ledger. */
  onBankTransfer: (input: {
    direction: 'to_bank' | 'from_bank'
    amountMinor: number
    reason: string
  }) => void
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

const CashFlowChart = dynamic(() => import('./till-cash-flow-chart-internal'), {
  ssr: false,
  loading: () => <Skeleton className="h-60 w-full rounded-xl" />,
})

const METHOD_ORDER: PosPaymentMethod[] = ['cash', 'card', 'transfer', 'credit', 'other']

export const TillView = memo(function TillView({
  t,
  session,
  totals,
  abandoned,
  abandonedError,
  isAbandonedLoading,
  isLoading,
  error,
  isBusy,
  actionError,
  onRefresh,
  onOpen,
  onCashMovement,
  onBankTransfer,
  onClose,
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

  const chartData = useMemo(
    () =>
      dailyCashFlow.map((d) => ({
        label: date(d.day, { month: 'short', day: 'numeric' }),
        in: d.inMinor / 100,
        out: d.outMinor / 100,
        net: d.netMinor / 100,
      })),
    [dailyCashFlow, date],
  )
  const [floatMinor, setFloatMinor] = useState(0)
  const [movementMinor, setMovementMinor] = useState(0)
  const [movementReason, setMovementReason] = useState('')
  const [countedMinor, setCountedMinor] = useState(0)
  const [varianceReason, setVarianceReason] = useState('')
  const [search, setSearch] = useState('')
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all')
  const [ledgerPage, setLedgerPage] = useState(0)

  // Today and yesterday from the server's daily aggregate (last two days of
  // the window). Missing days are real zeros there, never gaps.
  const today = dailyCashFlow[dailyCashFlow.length - 1] ?? { inMinor: 0, outMinor: 0 }
  const yesterday = dailyCashFlow[dailyCashFlow.length - 2] ?? { inMinor: 0, outMinor: 0 }

  const eventCount = ledger.filter((entry) => entry.kind !== 'opening_float').length

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

  // Presentation of the server's entries: which ones to show, and the in/out
  // sums of the session. The balance column is the server's own.
  const cashFlow = useMemo(() => {
    const events = ledger.filter((entry) => entry.kind !== 'opening_float')
    return {
      inMinor: events.filter((e) => e.amountMinor > 0).reduce((s, e) => s + e.amountMinor, 0),
      outMinor: events.filter((e) => e.amountMinor < 0).reduce((s, e) => s - e.amountMinor, 0),
    }
  }, [ledger])

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
        ),
    [ledger, ledgerFilter],
  )

  const pageCount = Math.max(1, Math.ceil(ledgerRows.length / PAGE_SIZE))
  const pagedRows = ledgerRows.slice(ledgerPage * PAGE_SIZE, (ledgerPage + 1) * PAGE_SIZE)

  // Computed in the view because it is a preview of an unsaved count, not a
  // stored fact. The server recomputes it from its own totals on close.
  const previewVariance = totals != null ? countedMinor - totals.expectedCashMinor : null

  const abandonedRows = useMemo(
    () =>
      abandoned.filter((item) =>
        matchesSearch(search, [dateTime(item.openedAt), item.orderCount, item.openedBy]),
      ),
    [abandoned, dateTime, search],
  )

  const abandonedColumns = useMemo<TableColumn<AbandonedSession>[]>(
    () => [
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
        render: (item) => <Money minor={item.expectedCashMinor} />,
      },
    ],
    [dateTime, t],
  )

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('till.title', 'صندوق')}
        description={t('till.subtitle', 'باز کردن، ثبت نقدی و شمارش صندوق')}
        action={
          <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
            {t('common.refresh', 'تازه‌سازی')}
          </ActionButton>
        }
      />

      {actionError ? <ErrorNote message={actionError} /> : null}

      {isLoading ? (
        <Loading label={t('common.loading', 'در حال بارگذاری…')} />
      ) : error ? (
        <ErrorNote
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry', 'تلاش دوباره')}
        />
      ) : null}

      {/* ─── KPIs — today against yesterday, from the daily cash-flow aggregate ─── */}
      <section
        aria-label={t('till.kpis', 'خلاصه‌ی امروز صندوق')}
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Stat
          icon={ArrowDownLeft}
          label={t('till.today_in', 'کل دریافتی امروز')}
          value={isCashFlowLoading || cashFlowError ? '—' : <Money minor={today.inMinor} />}
          hint={<DeltaHint t={t} now={today.inMinor} before={yesterday.inMinor} goodWhenUp />}
        />
        <Stat
          icon={ArrowUpRight}
          label={t('till.today_out', 'کل پرداختی امروز')}
          value={isCashFlowLoading || cashFlowError ? '—' : <Money minor={today.outMinor} />}
          hint={
            <DeltaHint t={t} now={today.outMinor} before={yesterday.outMinor} goodWhenUp={false} />
          }
        />
        <Stat
          icon={Wallet}
          label={t('till.balance_now', 'موجودی فعلی صندوق')}
          value={session && totals ? <Money minor={totals.expectedCashMinor} /> : '—'}
          hint={
            session && totals
              ? t('till.expected_hint', 'محاسبه‌ی سرور — قابل ویرایش نیست')
              : t('till.no_open_session', 'صندوقی باز نیست')
          }
        />
        <Stat
          icon={ShoppingCart}
          label={t('till.session_transactions', 'تعداد تراکنش‌های این نوبت')}
          value={session ? (isLedgerLoading || ledgerError ? '—' : eventCount) : '—'}
          hint={
            session && totals && totals.voidedCount > 0
              ? `${t('till.voided', 'ابطال‌شده')}: ${totals.voidedCount}`
              : undefined
          }
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <Panel
            title={t('till.cash_flow_title', 'جریان نقدی')}
            description={t(
              'till.cash_flow_hint',
              'دریافت و پرداخت نقدی همه‌ی صندوق‌ها و فاکتورها، به تفکیک روز.',
            )}
          >
            <SegmentedFilter
              label={t('till.cash_flow_range', 'بازه')}
              value={String(cashFlowDays)}
              onChange={(v) => onCashFlowDaysChange(Number(v) as 7 | 30 | 90)}
              options={[
                { value: '7', label: t('till.range_7', '۷ روز') },
                { value: '30', label: t('till.range_30', '۳۰ روز') },
                { value: '90', label: t('till.range_90', '۹۰ روز') },
              ]}
            />
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
                  fmt={(v) => formatSelectedMoney(v)}
                  height={240}
                />
              )}
            </div>
          </Panel>
        </div>

        <div className="min-w-0 lg:col-span-2">
          <Panel title={t('till.distribution_title', 'توزیع تراکنش‌ها')}>
            {!session ? (
              <EmptyState icon="search" title={t('till.no_open_session', 'صندوقی باز نیست')} />
            ) : isLedgerLoading ? (
              <Skeleton className="mx-auto size-44 rounded-full" />
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
      </div>

      {session && totals ? (
        <ListSection
          title={t('till.ledger_title', 'تراکنش‌های صندوق')}
          description={t(
            'till.ledger_hint',
            'هر ورود و خروج نقد با موجودی پس از آن. پرداخت‌های نقدی فاکتور خودکار اینجا می‌آیند.',
          )}
        >
          <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[hsl(var(--fg-tertiary))]">
            <span>
              {t('till.opening_float', 'نقد اولیه')}:{' '}
              <Money minor={session.openingFloatMinor} tone="muted" />
            </span>
            <span>
              <Banknote className="me-1 inline size-3.5" aria-hidden="true" />
              {t('till.gross_sales', 'فروش ناخالص')}:{' '}
              <Money minor={totals.grossSalesMinor} tone="muted" />
            </span>
            {typeof totals.settlementsMinor === 'number' && totals.settlementsMinor !== 0 ? (
              <span>
                {t('till.settlements', 'پرداخت‌های نقدی فاکتور')}:{' '}
                <Money minor={totals.settlementsMinor} signed tone="muted" />
              </span>
            ) : null}
          </p>
          <SegmentedFilter
            label={t('till.ledger_filter', 'نوع')}
            value={ledgerFilter}
            onChange={(next) => {
              setLedgerFilter(next)
              setLedgerPage(0)
            }}
            options={[
              { value: 'all', label: t('common.all', 'همه') },
              { value: 'in', label: t('till.filter_in', 'ورود') },
              { value: 'out', label: t('till.filter_out', 'خروج') },
              { value: 'invoices', label: t('till.filter_invoices', 'فاکتورها') },
            ]}
          />
          {isLedgerLoading ? (
            <Loading label={t('common.loading', 'در حال بارگذاری…')} />
          ) : ledgerError ? (
            <ErrorNote
              message={ledgerError}
              onRetry={onRefresh}
              retryLabel={t('common.retry', 'تلاش دوباره')}
            />
          ) : ledgerRows.length === 0 ? (
            <EmptyState icon="search" title={t('till.ledger_empty', 'تراکنشی با این فیلتر نیست')} />
          ) : (
            <>
              <div className="mt-3 hidden overflow-x-auto rounded-xl border border-[hsl(var(--border-default))] md:block">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-[hsl(var(--surface-muted)/0.5)] text-xs text-[hsl(var(--fg-secondary))]">
                    <tr>
                      <th className="px-3 py-2.5 text-start font-medium">
                        {t('till.col_time', 'تاریخ و زمان')}
                      </th>
                      <th className="px-3 py-2.5 text-start font-medium">
                        {t('till.col_type', 'نوع تراکنش')}
                      </th>
                      <th className="px-3 py-2.5 text-start font-medium">
                        {t('till.col_reference', 'شرح / مرجع')}
                      </th>
                      <th className="px-3 py-2.5 text-end font-medium">
                        {t('till.col_amount', 'مبلغ')}
                      </th>
                      <th className="px-3 py-2.5 text-end font-medium">
                        {t('till.balance_after', 'موجودی')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(var(--border-default))]">
                    {pagedRows.map((entry, index) => (
                      <tr key={`${entry.kind}-${entry.sourceId ?? 'float'}-${index}`}>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-[hsl(var(--fg-tertiary))]">
                          {dateTime(entry.at)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={
                              entry.amountMinor >= 0
                                ? 'text-[hsl(var(--color-success))]'
                                : 'text-[hsl(var(--color-destructive))]'
                            }
                          >
                            {t(`till.kind_${entry.kind}`, entry.kind)}
                          </span>
                        </td>
                        <td
                          className="max-w-[16rem] truncate px-3 py-2.5 text-[hsl(var(--fg-secondary))]"
                          dir="auto"
                        >
                          {entry.reference || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-end">
                          <Money
                            minor={entry.amountMinor}
                            signed
                            tone={entry.kind === 'opening_float' ? 'muted' : 'auto'}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-end">
                          <Money minor={entry.balanceMinor} tone="muted" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="mt-3 space-y-2 md:hidden">
                {pagedRows.map((entry, index) => (
                  <li
                    key={`m-${entry.kind}-${entry.sourceId ?? 'float'}-${index}`}
                    className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">
                        {t(`till.kind_${entry.kind}`, entry.kind)}
                      </span>
                      <Money
                        minor={entry.amountMinor}
                        signed
                        tone={entry.kind === 'opening_float' ? 'muted' : 'auto'}
                      />
                    </div>
                    {entry.reference ? (
                      <p
                        className="mt-0.5 truncate text-xs text-[hsl(var(--fg-secondary))]"
                        dir="auto"
                      >
                        {entry.reference}
                      </p>
                    ) : null}
                    <div className="mt-1 flex justify-between text-xs text-[hsl(var(--fg-tertiary))]">
                      <span>{dateTime(entry.at)}</span>
                      <span>
                        {t('till.balance_after', 'موجودی')}:{' '}
                        <Money minor={entry.balanceMinor} tone="muted" />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[hsl(var(--fg-tertiary))]">
                <span>
                  {t('till.showing', 'نمایش')}{' '}
                  <span className="tabular-nums">{ledgerPage * PAGE_SIZE + 1}</span>
                  {' – '}
                  <span className="tabular-nums">
                    {Math.min((ledgerPage + 1) * PAGE_SIZE, ledgerRows.length)}
                  </span>{' '}
                  {t('till.of', 'از')} <span className="tabular-nums">{ledgerRows.length}</span>
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
            </>
          )}
        </ListSection>
      ) : null}

      {!isLoading && !error && !session ? (
        <Panel
          title={t('till.open_title', 'صندوق بسته است')}
          description={t('till.open_hint', 'مبلغ نقد اولیه‌ی داخل صندوق را وارد کنید.')}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <MinorInput
                label={t('till.opening_float', 'نقد اولیه')}
                value={floatMinor}
                onChange={setFloatMinor}
                disabled={isBusy}
              />
            </div>
            <ActionButton onClick={() => onOpen(floatMinor)} disabled={isBusy}>
              {t('till.open_action', 'باز کردن صندوق')}
            </ActionButton>
          </div>
        </Panel>
      ) : null}

      {session && totals ? (
        <>
          <Panel
            title={t('till.session_title', 'صندوق باز')}
            description={t('till.opened_at', 'زمان باز شدن') + ': ' + dateTime(session.openedAt)}
            action={<Badge tone="good">{t(`till.status_${session.status}`, session.status)}</Badge>}
          >
            <div className="grid gap-2 sm:grid-cols-5">
              {METHOD_ORDER.map((method) => (
                <div
                  key={method}
                  className="rounded-xl border border-[hsl(var(--border-default))] px-3 py-2 text-sm"
                >
                  <div className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t(`till.method_${method}`, method)}
                  </div>
                  <Money minor={totals.byMethod?.[method] ?? 0} tone="muted" />
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title={t('till.movement_title', 'ورود و خروج نقدی')}
            description={t(
              'till.movement_hint',
              'برداشت از صندوق بدون دلیل، یعنی کسری بدون توضیح.',
            )}
          >
            <div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto_auto]">
              <MinorInput
                label={t('till.amount', 'مبلغ')}
                value={movementMinor}
                onChange={setMovementMinor}
                disabled={isBusy}
              />
              <Field
                label={t('till.reason', 'دلیل')}
                value={movementReason}
                onChange={setMovementReason}
                disabled={isBusy}
              />
              <ActionButton
                variant="quiet"
                className="self-end"
                // Reason is required by the server too. Disabling it here just
                // avoids a round trip to be told so.
                disabled={isBusy || movementMinor <= 0 || movementReason.trim() === ''}
                onClick={() =>
                  onCashMovement({
                    kind: 'cash_in',
                    amountMinor: movementMinor,
                    reason: movementReason.trim(),
                  })
                }
              >
                {t('till.cash_in', 'ورود نقدی')}
              </ActionButton>
              <ActionButton
                variant="quiet"
                className="self-end"
                disabled={isBusy || movementMinor <= 0 || movementReason.trim() === ''}
                onClick={() =>
                  onCashMovement({
                    kind: 'cash_out',
                    amountMinor: movementMinor,
                    reason: movementReason.trim(),
                  })
                }
              >
                {t('till.cash_out', 'خروج نقدی')}
              </ActionButton>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-[hsl(var(--border-default))] pt-3">
              <p className="w-full text-xs text-[hsl(var(--fg-tertiary))]">
                {t(
                  'till.transfer_hint',
                  'انتقال به بانک یا برداشت از بانک با سند حسابداری (بدهکار بانک / بستانکار صندوق) ثبت می‌شود.',
                )}
              </p>
              <ActionButton
                variant="quiet"
                disabled={isBusy || movementMinor <= 0 || movementReason.trim() === ''}
                onClick={() =>
                  onBankTransfer({
                    direction: 'to_bank',
                    amountMinor: movementMinor,
                    reason: movementReason.trim(),
                  })
                }
              >
                {t('till.transfer_to_bank', 'انتقال به بانک')}
              </ActionButton>
              <ActionButton
                variant="quiet"
                disabled={isBusy || movementMinor <= 0 || movementReason.trim() === ''}
                onClick={() =>
                  onBankTransfer({
                    direction: 'from_bank',
                    amountMinor: movementMinor,
                    reason: movementReason.trim(),
                  })
                }
              >
                {t('till.transfer_from_bank', 'برداشت از بانک')}
              </ActionButton>
            </div>
          </Panel>

          <Panel
            title={t('till.close_title', 'شمارش و بستن')}
            description={t('till.close_hint', 'اختلاف پیش از تأیید نشان داده می‌شود.')}
          >
            <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
              <MinorInput
                label={t('till.counted_cash', 'نقد شمرده‌شده')}
                value={countedMinor}
                onChange={setCountedMinor}
                disabled={isBusy}
              />
              <div className="self-end rounded-xl bg-[hsl(var(--surface-muted)/0.4)] px-4 py-3 text-sm">
                <span className="text-[hsl(var(--fg-tertiary))]">
                  {t('till.variance', 'اختلاف')}:{' '}
                </span>
                {previewVariance == null ? (
                  '—'
                ) : (
                  <Money minor={previewVariance} signed tone="auto" />
                )}
              </div>
            </div>

            {previewVariance != null && previewVariance !== 0 ? (
              <div className="mt-3">
                <Field
                  label={t('till.variance_reason', 'توضیح اختلاف')}
                  value={varianceReason}
                  onChange={setVarianceReason}
                  disabled={isBusy}
                />
              </div>
            ) : null}

            <ActionButton
              className="mt-4"
              // A non-zero variance must be explained before it can be sealed.
              // Once the session closes, the person who could still find the
              // missing note has gone home.
              disabled={
                isBusy ||
                (previewVariance != null && previewVariance !== 0 && varianceReason.trim() === '')
              }
              onClick={() =>
                onClose({
                  countedCashMinor: countedMinor,
                  ...(varianceReason.trim() ? { varianceReason: varianceReason.trim() } : {}),
                })
              }
            >
              {t('till.close_action', 'بستن صندوق')}
            </ActionButton>
          </Panel>
        </>
      ) : null}

      <ListSection
        title={t('till.abandoned_title', 'صندوق‌های رها شده')}
        description={t('till.abandoned_hint', 'پولی که در صندوقی است که کسی به آن دسترسی ندارد.')}
      >
        {isAbandonedLoading ? (
          <Loading label={t('common.loading', 'در حال بارگذاری…')} />
        ) : abandonedError ? (
          <ErrorNote
            message={abandonedError}
            onRetry={onRefresh}
            retryLabel={t('common.retry', 'تلاش دوباره')}
          />
        ) : (
          <DataTable
            tableId="till-abandoned"
            t={t}
            rows={abandonedRows}
            columns={abandonedColumns}
            rowKey={(item) => item.sessionId}
            searchValue={search}
            onSearchChange={setSearch}
            minWidthClass="min-w-[420px]"
            emptyState={
              <EmptyState
                icon="search"
                title={t('till.abandoned_empty', 'صندوق رها شده‌ای نیست')}
              />
            }
          />
        )}
      </ListSection>
    </CapabilityPage>
  )
})

TillView.displayName = 'TillView'
