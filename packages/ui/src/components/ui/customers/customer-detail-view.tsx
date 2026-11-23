'use client'

// ============================================
// Customer 360 — view. Presentational only; every figure arrives from the
// container, which gets it from the server (see customer-detail-container.tsx).
//
// Layout (owner-approved mockup, 21 Nov 2026 — docs/design-mockups/customer-360):
//   · phone (<md):   identity → balance hero → KPIs → aging → tabs; the two
//                    money actions live in a sticky bottom bar. Lists become
//                    cards through the shared DataTable itself.
//   · tablet (md+):  one column; the action row sits under the identity card,
//                    KPIs go four across, aging five across.
//   · desktop (≥1200px): two columns — a sticky rail (identity, balance,
//                    KPIs, aging) beside the action row and the tabs card, so
//                    the net balance stays in view while the statement scrolls.
//
// The money picture is unchanged in substance: net balance (sign is the
// meaning), receivable/payable, what is owed by due date and by age, then the
// four parts of the account. Two currencies are never added up.
// ============================================

import { KpiCard, valueFontClass } from '../kpi-card'
import { SearchableTable, TableFilterSelect, type TableColumn } from '../data-table'
import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { getStatementTotals } from '../../../lib/customers/statement-totals'
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  FilePlus2,
  FileText,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Printer,
  Scale,
  Trash2,
} from 'lucide-react'
import type { PartyLedger, PartySummary, PaymentRecord } from '@hisabche/api'
import { asList } from '@hisabche/api'
import { CURRENCY_SIGN, formatMoney, formatNumber, type KnownCurrency } from '@hisabche/formatting'

import { cn } from '../../../lib/utils'
import { GHOST_ICON_BUTTON } from '../button-classes'
import { FOCUS_RING } from '../focus-ring'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu'
import { SegmentedControl } from '../segmented-control'
import { Tabs, TabsContent } from '../tabs'
import { PaymentModal } from './PaymentModal'
import { CustomerDepositsPanel } from './customer-deposits-panel'
import { CustomerAccountingPanel } from './customer-analysis-panels'

export interface CustomerInvoiceRow {
  id: string
  invoiceNumber: string
  type: 'sale' | 'purchase'
  status: string
  date: string
  dueDate: string
  total: number
  paidAmount: number
  currency: string
}

interface ModalInvoice {
  id: string
  invoiceNumber?: string
  total: number
  paidAmount: number
  date: string
  status: string
  customerId: string
}

export interface CustomerDetailViewProps {
  locale: string
  formatDate: (value: string | null) => string
  customer: { id: string; name: string; phone: string; email: string; address: string } | null
  customerLoading: boolean
  summary: PartySummary | null
  summaryError: boolean
  ledger: PartyLedger | null
  ledgerLoading: boolean
  invoices: CustomerInvoiceRow[]
  invoicesTotal: number
  invoicePage: number
  invoicePageSize: number
  onInvoicePage: (page: number) => void
  payments: PaymentRecord[]
  openInvoices: ModalInvoice[]
  payOpen: boolean
  onBack: () => void
  onRetry: () => void
  onOpenPayment: () => void
  onClosePayment: () => void
  onPaymentSuccess: () => void
  onNewInvoice: () => void
  /** Remove the customer. The server refuses one that has invoices or payments. */
  onDelete?: (() => void) | undefined
  deleting?: boolean | undefined
  deleteError?: string | null | undefined
  onOpenInvoice: (id: string) => void
  onExport: () => void
}

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-sm'
const outlineBtn =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[hsl(var(--border-default))] px-4 text-sm font-medium text-[hsl(var(--fg-secondary))] transition-colors motion-reduce:transition-none hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] disabled:opacity-50'
const primaryBtn =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[hsl(var(--color-primary))] px-5 text-sm font-bold text-[hsl(var(--color-primary-fg))] shadow-sm transition motion-reduce:transition-none hover:brightness-110'
const iconBtn = cn(outlineBtn, 'w-10 px-0')

/** A figure that is bad news (money overdue). */
const DANGER_VALUE = 'text-[hsl(var(--color-destructive))]'

/**
 * ⚠️ THE SIGN IS THE WHOLE MEANING of a net balance: positive is money THEY
 * owe us, negative is money WE owe them. The colour carries it — and `netLabel`
 * beside it says the same thing in words, so colour is never the only channel.
 */
function netTone(value: number): string {
  if (value > 0) return DANGER_VALUE
  if (value < 0) return 'text-[hsl(var(--color-success))]'
  return 'text-[hsl(var(--fg-primary))]'
}

/** The same reading of the sign, as the chip behind the words. */
function netChipTone(value: number): string {
  if (value > 0)
    return 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]'
  if (value < 0) return 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
  return 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]'
}

/**
 * The hero figure's size — one step larger than a KPI's, and still shrinking
 * as the number grows so a nine-figure sum stays whole (never abbreviated).
 */
function heroFontClass(text: string): string {
  const len = text.length
  if (len <= 11) return 'text-2xl md:text-3xl min-[1200px]:text-[28px]'
  if (len <= 15) return 'text-xl md:text-2xl'
  if (len <= 20) return 'text-base md:text-lg'
  return 'text-sm md:text-base'
}

/** The avatar's letters — the first letter of the first two words of the name. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0]?.[0] ?? ''
  const second = words[1]?.[0] ?? ''
  return first + second || first || '—'
}

// Statuses with a label under customer360.status (desktop's next-intl shim has no `t.has`).
const KNOWN_STATUS = new Set(['paid', 'pending', 'completed', 'cancelled', 'draft'])

/**
 * The four parts of the customer's account, in one switch.
 *
 * This page used to carry a second group — رابطه — with five more parts
 * (activity, insights, CRM, credit & documents, change history). The owner
 * removed that whole group from this URL on 21 Nov 2026: this is the money
 * page, and those views belong to their own screens.
 */
export const CUSTOMER_TABS = ['statement', 'invoices', 'payments', 'accounting'] as const
export type CustomerTab = (typeof CUSTOMER_TABS)[number]

/** The label key of each part. */
const TAB_LABEL: Record<CustomerTab, string> = {
  statement: 'tabStatement',
  invoices: 'tabSales',
  payments: 'tabPayments',
  accounting: 'tabAccounting',
}

function isKnown(currency: string): currency is KnownCurrency {
  return currency in CURRENCY_SIGN
}

export function CustomerDetailView(props: CustomerDetailViewProps) {
  const t = useTranslations('customer360')
  const tc = useTranslations()
  const { customer, summary, locale } = props
  const [tab, setTab] = useState<CustomerTab>('statement')

  // Print / «Save as PDF» prints the statement: switch to it, then print after the render.
  const printStatement = () => {
    setTab('statement')
    setTimeout(() => window.print(), 50)
  }

  // One currency → show it; several → numbers only, with the notice below.
  const summaryCurrency = summary?.currencies.length === 1 ? (summary.currencies[0] ?? '') : ''
  const money = (value: number, currency = summaryCurrency) =>
    isKnown(currency)
      ? formatMoney(value, currency, locale)
      : `${formatNumber(value, locale, 2)}${currency ? ` ${currency}` : ''}`

  // ⚠️ TWO CURRENCIES ARE NEVER ADDED UP. When this party's invoices and
  // payments are in more than one currency, `summary.netBalance` and the other
  // totals are a sum of unlike things; the per-currency rows the server sends
  // are the true picture. Every figure below is then shown once per currency
  // instead of as one total.
  const byCurrency = asList<PartySummary & { currency: string }>(summary?.byCurrency)
  const perCurrency = (summary?.currencies.length ?? 0) > 1 && byCurrency.length > 0

  /**
   * The balance hero and the aging breakdown, one block per currency for the
   * same reason: their totals are a sum of unlike things too.
   */
  const owedByCurrency: Array<{ currency: string; figures: PartySummary }> = summary
    ? perCurrency
      ? byCurrency.map((row) => ({ currency: row.currency, figures: row }))
      : [{ currency: summaryCurrency, figures: summary }]
    : []

  /**
   * One money figure. With a single currency it is a string, so the KPI card
   * sizes it to the number it holds; with several it is one line per currency —
   * never their sum.
   */
  const figure = (pick: (row: PartySummary) => number, danger = false): ReactNode => {
    if (!summary) return ''
    if (!perCurrency) {
      const text = money(pick(summary))
      return danger ? <span className={cn(DANGER_VALUE, valueFontClass(text))}>{text}</span> : text
    }
    return (
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {byCurrency.map((row) => (
          <span
            key={row.currency}
            className={cn('whitespace-nowrap tabular-nums', danger && DANGER_VALUE)}
          >
            <span className="text-[hsl(var(--fg-tertiary))]" dir="ltr">
              {row.currency}
            </span>{' '}
            {formatNumber(pick(row), locale, 2)}
          </span>
        ))}
      </span>
    )
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-[hsl(var(--surface-muted))]">
          <FileText className="size-7 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
        </div>
        <p className="font-semibold text-[hsl(var(--fg-primary))]">
          {props.customerLoading ? tc('common.loading') : tc('customers.notFound')}
        </p>
        <button type="button" onClick={props.onBack} className={outlineBtn}>
          {tc('common.back')}
        </button>
      </div>
    )
  }

  // The sign is the meaning — see `netTone`. `null` when the summary did not
  // load: an unknown balance is not a settled one.
  const net = summary?.netBalance ?? null
  const netLabel =
    net === null ? '' : net > 0 ? t('netOwesUs') : net < 0 ? t('netWeOwe') : t('netSettled')

  const canPrint = !!props.ledger && props.ledger.movements.length > 0
  const showReceipt = !!summary && summary.receivable > 0 && props.openInvoices.length > 0

  return (
    <div className="flex flex-col gap-4 md:gap-5 min-[1200px]:grid min-[1200px]:grid-cols-[344px_minmax(0,1fr)] min-[1200px]:grid-rows-[auto_minmax(0,1fr)] min-[1200px]:gap-[18px]">
      <PaymentModal
        open={props.payOpen}
        onClose={props.onClosePayment}
        onPaid={props.onPaymentSuccess}
        customer={{
          id: customer.id,
          fullName: customer.name,
          name: customer.name,
          phone: customer.phone,
        }}
        openInvoices={props.openInvoices}
      />

      {/* ── The rail: identity + the money picture. On a phone or tablet its
          cards flow in the single column (display:contents); from 1200px it
          is a sticky column beside the statement. ─────────────────────────── */}
      <div className="contents min-[1200px]:sticky min-[1200px]:top-6 min-[1200px]:col-start-1 min-[1200px]:row-span-2 min-[1200px]:row-start-1 min-[1200px]:grid min-[1200px]:gap-4 min-[1200px]:self-start print:hidden">
        {/* ── 1. Who this customer is ─────────────────────────────────────── */}
        <header className={cn(card, 'order-1 p-3.5 md:p-5 min-[1200px]:order-none')}>
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={props.onBack}
              aria-label={tc('customers.backToList')}
              className={cn(GHOST_ICON_BUTTON, FOCUS_RING, 'mt-0.5 shrink-0')}
            >
              <ChevronRight className="size-5 ltr:rotate-180" aria-hidden="true" />
            </button>

            <div
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.14)] text-base font-bold text-[hsl(var(--color-primary))]"
            >
              {initialsOf(customer.name)}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-[hsl(var(--fg-primary))] md:text-xl">
                {customer.name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-[hsl(var(--fg-secondary))] md:text-[13px]">
                {customer.phone && (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Phone
                      className="size-3.5 shrink-0 text-[hsl(var(--fg-tertiary))]"
                      aria-hidden="true"
                    />
                    <span dir="ltr" className="truncate">
                      {customer.phone}
                    </span>
                  </span>
                )}
                {customer.email && (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Mail
                      className="size-3.5 shrink-0 text-[hsl(var(--fg-tertiary))]"
                      aria-hidden="true"
                    />
                    <span dir="ltr" className="truncate">
                      {customer.email}
                    </span>
                  </span>
                )}
                {customer.address && (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <MapPin
                      className="size-3.5 shrink-0 text-[hsl(var(--fg-tertiary))]"
                      aria-hidden="true"
                    />
                    <span className="truncate">{customer.address}</span>
                  </span>
                )}
              </div>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-[hsl(var(--border-default)/0.6)] pt-2 text-[11px] text-[hsl(var(--fg-tertiary))]">
                <span>
                  {t('lastSale')}:{' '}
                  <span className="text-[hsl(var(--fg-secondary))]">
                    {props.formatDate(summary?.lastSaleAt ?? null)}
                  </span>
                </span>
                <span>
                  {t('lastPayment')}:{' '}
                  <span className="text-[hsl(var(--fg-secondary))]">
                    {props.formatDate(summary?.lastPaymentAt ?? null)}
                  </span>
                </span>
              </p>
            </div>

            {/* Print, export and delete live here at every size — the action
                row carries only the two money actions. */}
            <DropdownMenu>
              {/* A bare <button>: Radix's Slot clones exactly one element. */}
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={tc('common.more')}
                  title={tc('common.more')}
                  className={cn(iconBtn, 'shrink-0')}
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={!canPrint} onSelect={printStatement}>
                  <Printer className="size-4" aria-hidden="true" />
                  {t('printStatement')}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!canPrint} onSelect={props.onExport}>
                  <Download className="size-4" aria-hidden="true" />
                  {t('exportStatement')}
                </DropdownMenuItem>
                {props.onDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={props.deleting === true}
                      onSelect={props.onDelete}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      {t('deleteCustomer')}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {props.deleteError ? (
            <p role="alert" className="mt-2 text-xs text-[hsl(var(--color-destructive))]">
              {props.deleteError}
            </p>
          ) : null}
        </header>

        {props.summaryError && (
          <div
            role="alert"
            className="order-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[hsl(var(--color-destructive)/0.4)] bg-[hsl(var(--color-destructive)/0.06)] p-3 text-sm text-[hsl(var(--color-destructive))] min-[1200px]:order-none"
          >
            {t('loadError')}
            <button type="button" onClick={props.onRetry} className={outlineBtn}>
              {t('retry')}
            </button>
          </div>
        )}

        {/* ── 2. Several currencies — said once, compactly ────────────────── */}
        {summary && summary.currencies.length > 1 && (
          <div className="order-4 flex items-start gap-2.5 rounded-xl border border-[hsl(var(--color-warning)/0.35)] bg-[hsl(var(--color-warning)/0.07)] px-3 py-2.5 min-[1200px]:order-none">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-[hsl(var(--color-warning))]"
              aria-hidden="true"
            />
            <p className="min-w-0 text-xs leading-5 text-[hsl(var(--fg-secondary))] sm:text-sm">
              <span className="font-semibold text-[hsl(var(--fg-primary))]">
                {t('mixedCurrencyTitle')}
              </span>
              {' — '}
              {t('mixedCurrency', { currencies: summary.currencies.join('، ') })}
            </p>
          </div>
        )}

        {/* ── 3. The balance — the one number this page is about ──────────── */}
        {summary && (
          <section
            aria-labelledby="customer-net-balance"
            className={cn(card, 'order-5 overflow-hidden min-[1200px]:order-none')}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--border-default))] px-4 py-3">
              <h2
                id="customer-net-balance"
                className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-secondary))]"
              >
                <Scale className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
                {t('netBalance')}
              </h2>
              {net !== null ? (
                <span
                  className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', netChipTone(net))}
                >
                  {netLabel}
                </span>
              ) : null}
            </div>

            {/* One block per currency. Two currencies are never added together;
                with a single currency this is simply its net balance. The sign
                colour and the chip above say the same thing in two channels. */}
            <div className="divide-y divide-[hsl(var(--border-default))]">
              {owedByCurrency.map(({ currency, figures }) => {
                const text = money(figures.netBalance, currency)
                return (
                  <div key={currency || 'book'} className="px-4 py-4">
                    {perCurrency && (
                      <p
                        className="mb-1 text-xs font-semibold text-[hsl(var(--fg-tertiary))]"
                        dir="ltr"
                      >
                        {currency}
                      </p>
                    )}
                    <p
                      className={cn(
                        'font-bold tabular-nums',
                        heroFontClass(text),
                        netTone(figures.netBalance),
                      )}
                      title={text}
                    >
                      {text}
                    </p>

                    {/* What the balance is made of — the two sides of it. */}
                    <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                      <div className="min-w-0 rounded-xl bg-[hsl(var(--surface-muted)/0.55)] px-3 py-2">
                        <p className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--fg-tertiary))]">
                          <span
                            aria-hidden="true"
                            className="size-1.5 shrink-0 rounded-full bg-[hsl(var(--color-destructive))]"
                          />
                          <span className="truncate">{t('receivable')}</span>
                        </p>
                        <p
                          className="mt-0.5 truncate text-sm font-bold tabular-nums text-[hsl(var(--fg-primary))]"
                          title={money(figures.receivable, currency)}
                        >
                          {money(figures.receivable, currency)}
                        </p>
                      </div>
                      <div className="min-w-0 rounded-xl bg-[hsl(var(--surface-muted)/0.55)] px-3 py-2">
                        <p className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--fg-tertiary))]">
                          <span
                            aria-hidden="true"
                            className="size-1.5 shrink-0 rounded-full bg-[hsl(var(--color-success))]"
                          />
                          <span className="truncate">{t('payable')}</span>
                        </p>
                        <p
                          className="mt-0.5 truncate text-sm font-bold tabular-nums text-[hsl(var(--fg-primary))]"
                          title={money(figures.weOwe, currency)}
                        >
                          {money(figures.weOwe, currency)}
                        </p>
                        {figures.returnCredit > 0 && (
                          <p className="mt-0.5 truncate text-[10px] text-[hsl(var(--fg-tertiary))]">
                            {t('weOweIncludesReturns')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* What is owed, by due date — the three urgencies. */}
                    {figures.receivable > 0 && (
                      <div className="mt-3.5 grid grid-cols-3 border-t border-[hsl(var(--border-default))] pt-3">
                        <div className="min-w-0 pe-2">
                          <p className="flex items-center gap-1 text-[10px] text-[hsl(var(--fg-tertiary))]">
                            <span
                              aria-hidden="true"
                              className="size-1.5 shrink-0 rounded-full bg-[hsl(var(--color-destructive))]"
                            />
                            <span className="truncate">{t('overdue')}</span>
                          </p>
                          <p
                            className="mt-1 truncate text-xs font-bold tabular-nums text-[hsl(var(--color-destructive))]"
                            title={money(figures.overdue, currency)}
                          >
                            {money(figures.overdue, currency)}
                          </p>
                        </div>
                        <div className="min-w-0 border-s border-[hsl(var(--border-default))] px-2">
                          <p className="flex items-center gap-1 text-[10px] text-[hsl(var(--fg-tertiary))]">
                            <span
                              aria-hidden="true"
                              className="size-1.5 shrink-0 rounded-full bg-[hsl(var(--color-warning))]"
                            />
                            <span className="truncate">{t('dueToday')}</span>
                          </p>
                          <p
                            className="mt-1 truncate text-xs font-bold tabular-nums text-[hsl(var(--color-warning))]"
                            title={money(figures.dueToday, currency)}
                          >
                            {money(figures.dueToday, currency)}
                          </p>
                        </div>
                        <div className="min-w-0 border-s border-[hsl(var(--border-default))] ps-2">
                          <p className="flex items-center gap-1 text-[10px] text-[hsl(var(--fg-tertiary))]">
                            <span
                              aria-hidden="true"
                              className="size-1.5 shrink-0 rounded-full bg-[hsl(var(--color-success))]"
                            />
                            <span className="truncate">{t('dueLater')}</span>
                          </p>
                          <p
                            className="mt-1 truncate text-xs font-bold tabular-nums text-[hsl(var(--fg-primary))]"
                            title={money(figures.dueLater, currency)}
                          >
                            {money(figures.dueLater, currency)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── 4. The supporting figures ───────────────────────────────────── */}
        {summary && (
          <section className={cn(card, 'order-6 p-3.5 min-[1200px]:order-none')}>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 min-[1200px]:grid-cols-2">
              <KpiCard
                surface="none"
                className="rounded-xl border border-[hsl(var(--border-default)/0.6)] bg-[hsl(var(--surface-muted)/0.45)]"
                label={
                  summary.totalPurchases > 0 && summary.totalSales === 0
                    ? t('totalPurchases')
                    : t('totalSales')
                }
                value={
                  summary.totalPurchases > 0 && summary.totalSales === 0
                    ? figure((row) => row.totalPurchases)
                    : figure((row) => row.totalSales)
                }
              />
              <KpiCard
                surface="none"
                className="rounded-xl border border-[hsl(var(--border-default)/0.6)] bg-[hsl(var(--surface-muted)/0.45)]"
                label={
                  summary.totalPurchases > 0 && summary.totalSales === 0
                    ? t('totalPaid')
                    : t('totalReceived')
                }
                value={
                  summary.totalPurchases > 0 && summary.totalSales === 0
                    ? figure((row) => row.totalPaid)
                    : figure((row) => row.totalReceived)
                }
              />
              <KpiCard
                surface="none"
                className="rounded-xl border border-[hsl(var(--border-default)/0.6)] bg-[hsl(var(--surface-muted)/0.45)]"
                label={t('overdue')}
                value={figure((row) => row.overdue, summary.overdue > 0)}
                {...(summary.overdue > 0 ? { tone: 'destructive' as const } : {})}
                {...(summary.overdueInvoiceCount > 0
                  ? { hint: t('overdueInvoices', { count: summary.overdueInvoiceCount }) }
                  : {})}
              />
              <KpiCard
                surface="none"
                className="rounded-xl border border-[hsl(var(--border-default)/0.6)] bg-[hsl(var(--surface-muted)/0.45)]"
                label={t('openInvoices')}
                value={formatNumber(summary.openInvoiceCount, locale)}
                hint={t('invoiceCount', { count: summary.invoiceCount })}
              />
            </div>
          </section>
        )}

        {/* ── 5. What is owed, by age ─────────────────────────────────────── */}
        {summary && summary.receivable > 0 && (
          <section className={cn(card, 'order-7 space-y-5 p-4 min-[1200px]:order-none')}>
            {owedByCurrency.map(({ currency, figures }) => (
              <div key={currency || 'book'}>
                {perCurrency && (
                  <p
                    className="mb-2 text-xs font-semibold text-[hsl(var(--fg-tertiary))]"
                    dir="ltr"
                  >
                    {currency}
                  </p>
                )}
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
                  <Clock className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
                  {t('aging')}
                </h2>
                <AgingBar figures={figures} />
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-5 min-[1200px]:grid-cols-1">
                  <Row label={t('agingCurrent')} value={money(figures.aging.current, currency)} />
                  <Row
                    label={t('aging1to30')}
                    value={money(figures.aging.days1to30, currency)}
                    tone="warning"
                  />
                  <Row
                    label={t('aging31to60')}
                    value={money(figures.aging.days31to60, currency)}
                    tone="danger"
                  />
                  <Row
                    label={t('aging61to90')}
                    value={money(figures.aging.days61to90, currency)}
                    tone="danger"
                  />
                  <Row
                    label={t('agingOver90')}
                    value={money(figures.aging.over90, currency)}
                    tone="danger"
                  />
                </dl>
              </div>
            ))}
          </section>
        )}
      </div>

      {/* ── 6. The two money actions (tablet and up; the phone has the sticky
          bottom bar instead). Print and export are beside them as icons. ──── */}
      <div className="order-3 hidden flex-wrap items-center gap-2 md:flex min-[1200px]:order-none min-[1200px]:col-start-2 min-[1200px]:row-start-1 print:hidden">
        <button type="button" onClick={props.onNewInvoice} className={primaryBtn}>
          <FilePlus2 className="size-4" aria-hidden="true" />
          {t('newInvoice')}
        </button>
        {showReceipt && (
          <button type="button" onClick={props.onOpenPayment} className={outlineBtn}>
            <DollarSign className="size-4" aria-hidden="true" />
            {t('recordReceipt')}
          </button>
        )}
        <span className="flex-1" />
        <button
          type="button"
          disabled={!canPrint}
          onClick={printStatement}
          aria-label={t('printStatement')}
          title={t('printStatement')}
          className={iconBtn}
        >
          <Printer className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={!canPrint}
          onClick={props.onExport}
          aria-label={t('exportStatement')}
          title={t('exportStatement')}
          className={iconBtn}
        >
          <Download className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* ── 7. The account: statement, invoices, payments, accounting ─────── */}
      <div className="order-8 flex min-w-0 flex-col min-[1200px]:order-none min-[1200px]:col-start-2 min-[1200px]:row-start-2">
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as CustomerTab)}
          className={cn(card, 'flex-1 p-3 sm:p-4 print:border-0 print:p-0 print:shadow-none')}
        >
          <p className="mb-2 hidden text-base font-bold print:block">{t('statementTitle')}</p>
          <div className="mb-3 print:hidden">
            <SegmentedControl<CustomerTab>
              label={t('groupsLabel')}
              options={CUSTOMER_TABS.map((value) => ({
                value,
                label: t(TAB_LABEL[value]),
              }))}
              value={tab}
              onChange={setTab}
            />
          </div>

          <TabsContent value="statement">
            <Statement {...props} money={money} />
          </TabsContent>

          <TabsContent value="invoices">
            <InvoicesTable {...props} money={money} />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentsTable {...props} money={money} />
            {/* The money held BEFORE the invoice: advances this customer paid on an
                order, with what is left of each and the two actions that move it. */}
            <CustomerDepositsPanel customerId={customer.id} formatDate={props.formatDate} />
          </TabsContent>

          <TabsContent value="accounting">
            <CustomerAccountingPanel
              customerId={customer.id}
              formatMoney={(value) => money(value)}
              formatDate={props.formatDate}
              onOpenInvoice={props.onOpenInvoice}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── 8. The phone's action bar — the two money actions within thumb
          reach, stuck to the bottom of the scroll. ────────────────────────── */}
      <div className="order-9 sticky bottom-0 z-10 flex gap-2.5 bg-gradient-to-t from-[hsl(var(--surface-base))] via-[hsl(var(--surface-base)/0.92)] to-transparent px-0.5 pb-[calc(10px+env(safe-area-inset-bottom))] pt-3 md:hidden print:hidden">
        <button
          type="button"
          onClick={props.onNewInvoice}
          className={cn(primaryBtn, 'min-h-11 flex-1', showReceipt && 'flex-[1.35]')}
        >
          <FilePlus2 className="size-4" aria-hidden="true" />
          {t('newInvoice')}
        </button>
        {showReceipt && (
          <button
            type="button"
            onClick={props.onOpenPayment}
            className={cn(outlineBtn, 'min-h-11 flex-1 bg-[hsl(var(--surface-elevated))]')}
          >
            <DollarSign className="size-4" aria-hidden="true" />
            {t('recordReceipt')}
          </button>
        )}
      </div>
    </div>
  )
}

type Money = (value: number, currency?: string) => string

/**
 * The aging picture as one stacked bar — each bucket's share of what is owed.
 * Decorative: the labelled rows below carry every figure, so the bar is hidden
 * from assistive tech and adds no numbers of its own.
 */
function AgingBar({ figures }: { figures: PartySummary }) {
  const a = figures.aging
  const parts = [
    { value: a.current, cls: 'bg-[hsl(var(--color-success))]' },
    { value: a.days1to30, cls: 'bg-[hsl(var(--color-warning))]' },
    { value: a.days31to60, cls: 'bg-[hsl(var(--color-destructive)/0.85)]' },
    { value: a.days61to90, cls: 'bg-[hsl(var(--color-destructive)/0.6)]' },
    { value: a.over90, cls: 'bg-[hsl(var(--color-destructive))]' },
  ]
  const total =
    Math.max(0, a.current) +
    Math.max(0, a.days1to30) +
    Math.max(0, a.days31to60) +
    Math.max(0, a.days61to90) +
    Math.max(0, a.over90)
  if (total <= 0) return null
  return (
    <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
      {parts
        .filter((part) => part.value > 0)
        .map((part, index) => (
          <span
            key={index}
            className={cn('h-full', part.cls)}
            style={{ width: `${(part.value / total) * 100}%` }}
          />
        ))}
    </div>
  )
}

function Statement(props: CustomerDetailViewProps & { money: Money }) {
  const t = useTranslations('customer360')
  const tc = useTranslations()
  const { ledger } = props
  // ⚠️ Before the early returns: the statement loads, then shows rows, and a
  // tab that changes its number of hooks between renders is a crash.
  const [kind, setKind] = useState('all')
  if (props.ledgerLoading) return <Empty text={tc('common.loading')} />
  if (!ledger || ledger.movements.length === 0) return <Empty text={t('statementEmpty')} />

  // Newest first on screen; the running balance is the server's, after each row.
  const allRows = [...ledger.movements].reverse()
  type Movement = (typeof allRows)[number]
  // Only the kinds this statement actually holds — a filter that can select a
  // row that does not exist is a filter that shows «no match» for no reason.
  const kinds = [...new Set(allRows.map((row) => row.kind))]
  const rows = kind === 'all' ? allRows : allRows.filter((row) => row.kind === kind)
  // Debit raises what they owe us (a sale, or money we paid out).
  const isDebit = (row: Movement) => row.kind === 'sale' || row.kind === 'payment_out'
  const columns: TableColumn<Movement>[] = [
    {
      id: 'date',
      labelKey: 'customer360.colDate',
      labelFallback: t('colDate'),
      sortValue: (row) => row.date,
      render: (row) => props.formatDate(row.date),
    },
    {
      id: 'kind',
      labelKey: 'customer360.colType',
      labelFallback: t('colType'),
      sortValue: (row) => row.kind,
      render: (row) => t(`kind.${row.kind}`),
    },
    {
      id: 'reference',
      labelKey: 'customer360.colReference',
      labelFallback: t('colReference'),
      locked: true,
      sortValue: (row) => row.reference,
      render: (row) => (
        <span
          className={
            row.sourceType === 'invoice' && row.sourceId
              ? 'font-medium text-[hsl(var(--color-primary))]'
              : undefined
          }
        >
          {row.reference}
        </span>
      ),
    },
    {
      id: 'debit',
      labelKey: 'customer360.colDebit',
      labelFallback: t('colDebit'),
      align: 'end',
      sortValue: (row) => (isDebit(row) ? row.amount : null),
      render: (row) => (
        <span className="tabular-nums">
          {isDebit(row) ? props.money(row.amount, row.currency) : '—'}
        </span>
      ),
    },
    {
      id: 'credit',
      labelKey: 'customer360.colCredit',
      labelFallback: t('colCredit'),
      align: 'end',
      sortValue: (row) => (isDebit(row) ? null : row.amount),
      render: (row) => (
        <span className="tabular-nums">
          {isDebit(row) ? '—' : props.money(row.amount, row.currency)}
        </span>
      ),
    },
    {
      id: 'balance',
      labelKey: 'customer360.colBalance',
      labelFallback: t('colBalance'),
      align: 'end',
      render: (row) => (
        <span
          className={cn(
            'font-medium tabular-nums',
            row.balance > 0 && 'text-[hsl(var(--color-destructive))]',
          )}
        >
          {props.money(row.balance)}
        </span>
      ),
    },
  ]
  const currencyTotals = getStatementTotals(props.summary, ledger)

  // One table, not two: the per-currency totals are this table's footer. A
  // second table under it repeated the same figures and the rail's cards.
  const totals =
    currencyTotals.length === 0 ? undefined : (
      <div className="space-y-2" data-statement-totals>
        <p className="text-xs font-semibold text-[hsl(var(--fg-primary))]">{t('totalsTitle')}</p>
        {currencyTotals.map((row) => (
          <div
            key={row.currency}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs sm:text-[13px]"
          >
            <span dir="ltr" className="font-bold text-[hsl(var(--fg-secondary))]">
              {row.currency || '—'}
            </span>
            <StatementTotal
              label={t('totalSales')}
              value={row.totalSales}
              currency={row.currency}
              money={props.money}
            />
            <StatementTotal
              label={t('totalPurchases')}
              value={row.totalPurchases}
              currency={row.currency}
              money={props.money}
            />
            <StatementTotal
              label={t('totalReceived')}
              value={row.totalReceived}
              currency={row.currency}
              money={props.money}
            />
            <StatementTotal
              label={t('totalPaid')}
              value={row.totalPaid}
              currency={row.currency}
              money={props.money}
            />
            {row.openingBalance !== null ? (
              <StatementTotal
                label={tc('customers.openingBalance')}
                value={row.openingBalance}
                currency={row.currency}
                money={props.money}
              />
            ) : null}
            <StatementTotal
              label={t('colBalance')}
              value={row.netBalance}
              currency={row.currency}
              money={props.money}
              strong
            />
          </div>
        ))}
      </div>
    )

  return (
    <div className="space-y-2">
      <SearchableTable
        tableId="customer-statement"
        rows={rows}
        columns={columns}
        rowKey={(row, index) => `${row.sourceId ?? row.reference}-${index}`}
        // A row that came from an invoice opens that invoice.
        onRowClick={(row) => {
          if (row.sourceType === 'invoice' && row.sourceId) props.onOpenInvoice(row.sourceId)
        }}
        words={(row) => [row.reference, t(`kind.${row.kind}`), props.formatDate(row.date)]}
        actions={
          <>
            <TableFilterSelect
              label={t('colType')}
              value={kind}
              options={[
                { value: 'all', label: tc('common.all') },
                ...kinds.map((value) => ({ value, label: t(`kind.${value}`) })),
              ]}
              onChange={setKind}
            />
            <button
              type="button"
              onClick={props.onExport}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-2.5 text-sm text-[hsl(var(--fg-secondary))] transition-colors motion-reduce:transition-none hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
            >
              <Download className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('exportStatement')}</span>
            </button>
          </>
        }
        empty={kind === 'all' ? t('statementEmpty') : t('noMatch')}
        // The footer is the whole account's totals, not a sum of the filtered
        // rows — it is shown only when no kind filter can contradict it.
        footer={kind === 'all' ? totals : undefined}
      />
      {/* Only when the per-currency footer cannot carry it: the movement rows
          have no per-currency summary in that case. Never printed twice. */}
      {currencyTotals.length === 0 && ledger.openingBalance !== 0 ? (
        <p className="flex justify-between gap-3 px-3 text-sm text-[hsl(var(--fg-secondary))]">
          <span>{tc('customers.openingBalance')}</span>
          <span className="tabular-nums">{props.money(ledger.openingBalance)}</span>
        </p>
      ) : null}
    </div>
  )
}

/** One labelled figure in the statement footer. `null` is «—», never zero. */
function StatementTotal({
  label,
  value,
  currency,
  money,
  strong,
}: {
  label: string
  value: number | null
  currency: string
  money: Money
  strong?: boolean | undefined
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[hsl(var(--fg-tertiary))]">{label}</span>
      <span
        className={cn(
          'tabular-nums',
          strong
            ? 'font-semibold text-[hsl(var(--fg-primary))]'
            : 'text-[hsl(var(--fg-secondary))]',
        )}
      >
        {value !== null ? money(value, currency) : '—'}
      </span>
    </span>
  )
}

function PaymentsTable(props: CustomerDetailViewProps & { money: Money }) {
  const t = useTranslations('customer360')
  const kindOf = (payment: PaymentRecord) =>
    t(`kind.${payment.direction === 'in' ? 'payment_in' : 'payment_out'}`)
  const columns: TableColumn<PaymentRecord>[] = [
    {
      id: 'date',
      labelKey: 'customer360.colDate',
      labelFallback: t('colDate'),
      sortValue: (payment) => payment.entryDate,
      render: (payment) => props.formatDate(payment.entryDate),
    },
    {
      id: 'reference',
      labelKey: 'customer360.colReference',
      labelFallback: t('colReference'),
      locked: true,
      sortValue: (payment) => payment.paymentNumber ?? '',
      render: (payment) => payment.paymentNumber ?? '—',
    },
    {
      id: 'kind',
      labelKey: 'customer360.colType',
      labelFallback: t('colType'),
      sortValue: (payment) => payment.direction,
      render: (payment) => kindOf(payment),
    },
    {
      id: 'method',
      labelKey: 'customer360.colMethod',
      labelFallback: t('colMethod'),
      showFrom: 'md',
      sortValue: (payment) => payment.method,
      render: (payment) => payment.method,
    },
    {
      id: 'amount',
      labelKey: 'customer360.colTotal',
      labelFallback: t('colTotal'),
      align: 'end',
      sortValue: (payment) => payment.amount,
      render: (payment) => (
        <span className="tabular-nums">{props.money(payment.amount, payment.currency)}</span>
      ),
    },
  ]
  return (
    <SearchableTable
      tableId="customer-payments"
      rows={props.payments}
      columns={columns}
      rowKey={(payment) => payment.id}
      words={(payment) => [payment.paymentNumber, payment.method, kindOf(payment)]}
      empty={t('noPayments')}
    />
  )
}

function InvoicesTable(props: CustomerDetailViewProps & { money: Money }) {
  const t = useTranslations('customer360')
  const statusOf = (invoice: CustomerInvoiceRow) =>
    KNOWN_STATUS.has(invoice.status) ? t(`status.${invoice.status}`) : invoice.status
  const remainingOf = (invoice: CustomerInvoiceRow) =>
    Math.max(0, invoice.total - invoice.paidAmount)
  const columns: TableColumn<CustomerInvoiceRow>[] = [
    {
      id: 'reference',
      labelKey: 'customer360.colReference',
      labelFallback: t('colReference'),
      locked: true,
      sortValue: (invoice) => invoice.invoiceNumber,
      render: (invoice) => (
        <span className="font-medium text-[hsl(var(--color-primary))]">
          {t(`kind.${invoice.type}`)} #{invoice.invoiceNumber}
        </span>
      ),
    },
    {
      id: 'date',
      labelKey: 'customer360.colDate',
      labelFallback: t('colDate'),
      sortValue: (invoice) => invoice.date,
      render: (invoice) => props.formatDate(invoice.date),
    },
    {
      id: 'due',
      labelKey: 'customer360.colDue',
      labelFallback: t('colDue'),
      showFrom: 'md',
      sortValue: (invoice) => invoice.dueDate || null,
      render: (invoice) => (invoice.dueDate ? props.formatDate(invoice.dueDate) : '—'),
    },
    {
      id: 'status',
      labelKey: 'customer360.colStatus',
      labelFallback: t('colStatus'),
      sortValue: (invoice) => invoice.status,
      render: (invoice) => statusOf(invoice),
    },
    {
      id: 'total',
      labelKey: 'customer360.colTotal',
      labelFallback: t('colTotal'),
      align: 'end',
      sortValue: (invoice) => invoice.total,
      render: (invoice) => (
        <span className="tabular-nums">{props.money(invoice.total, invoice.currency)}</span>
      ),
    },
    {
      id: 'paid',
      labelKey: 'customer360.colPaid',
      labelFallback: t('colPaid'),
      align: 'end',
      showFrom: 'md',
      sortValue: (invoice) => invoice.paidAmount,
      render: (invoice) => (
        <span className="tabular-nums">{props.money(invoice.paidAmount, invoice.currency)}</span>
      ),
    },
    {
      id: 'remaining',
      labelKey: 'customer360.colRemaining',
      labelFallback: t('colRemaining'),
      align: 'end',
      sortValue: (invoice) => remainingOf(invoice),
      render: (invoice) => (
        <span
          className={cn(
            'font-medium tabular-nums',
            remainingOf(invoice) > 0 && 'text-[hsl(var(--color-destructive))]',
          )}
        >
          {props.money(remainingOf(invoice), invoice.currency)}
        </span>
      ),
    },
  ]
  const pages = Math.max(1, Math.ceil(props.invoicesTotal / props.invoicePageSize))
  return (
    <div className="space-y-3">
      {/* One page from the server; the search looks through this page. */}
      <SearchableTable
        tableId="customer-invoices"
        rows={props.invoices}
        columns={columns}
        rowKey={(invoice) => invoice.id}
        onRowClick={(invoice) => props.onOpenInvoice(invoice.id)}
        words={(invoice) => [invoice.invoiceNumber, statusOf(invoice)]}
        empty={t('noInvoices')}
      />
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <button
            type="button"
            disabled={props.invoicePage <= 1}
            onClick={() => props.onInvoicePage(props.invoicePage - 1)}
            className={outlineBtn}
          >
            {t('previous')}
          </button>
          <span className="text-[hsl(var(--fg-secondary))]">
            {t('pageOf', { page: props.invoicePage, pages })}
          </span>
          <button
            type="button"
            disabled={props.invoicePage >= pages}
            onClick={() => props.onInvoicePage(props.invoicePage + 1)}
            className={outlineBtn}
          >
            {t('next')}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * One supporting line of the money picture — a label and its figure, with the
 * dot that marks what kind of news it is.
 */
function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'danger' | 'warning'
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border-default)/0.5)] pb-2 last:border-0">
      <dt className="flex items-center gap-2 text-[hsl(var(--fg-secondary))]">
        <span
          aria-hidden="true"
          className={cn(
            'size-2 rounded-full',
            tone === 'danger'
              ? 'bg-[hsl(var(--color-destructive))]'
              : tone === 'warning'
                ? 'bg-[hsl(var(--color-warning))]'
                : 'bg-[hsl(var(--color-success))]',
          )}
        />
        {label}
      </dt>
      <dd className="font-medium tabular-nums text-[hsl(var(--fg-primary))]">{value}</dd>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-[hsl(var(--fg-secondary))]">{text}</p>
}
