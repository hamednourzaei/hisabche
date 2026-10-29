'use client'

// ============================================
// Customer 360 — view. Presentational only; every figure arrives from the
// container, which gets it from the server (see customer-detail-container.tsx).
//
// Layout: identity + actions → the money picture (net balance, receivable,
// overdue, sales, receipts, open invoices) → what is owed by due date and by
// age → tabs: statement with running balance, invoices, payments, activity
// (12-month chart + top products), CRM (shared CustomerCrmPanel), history.
// ============================================

import { KpiCard, headlineFontClass, valueFontClass } from '../kpi-card'
import { DataTable, SearchableTable, TableFilterSelect, type TableColumn } from '../data-table'
import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import {
  getStatementTotals,
  type StatementTotalsRow,
} from '../../../lib/customers/statement-totals'
import {
  AlertTriangle,
  ChevronRight,
  DollarSign,
  Download,
  FilePlus2,
  FileText,
  MoreHorizontal,
  Printer,
  Scale,
  Trash2,
} from 'lucide-react'
import type { PartyActivity, PartyLedger, PartySummary, PaymentRecord } from '@hisabche/api'
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
import { HubTabs } from '../hub-tabs'
import { SegmentedControl } from '../segmented-control'
import { Tabs, TabsContent } from '../tabs'
import { PaymentModal } from './PaymentModal'
import { CustomerCrmPanel } from '../crm/customer-crm-panel'
import { CustomerProfilePanel } from './customer-profile-panel'
import { CustomerPortalPanel } from './customer-portal-panel'
import { CustomerAccountingPanel, CustomerInsightsPanel } from './customer-analysis-panels'
import { translateOr } from '../../../lib/translate-or'

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
  activity: PartyActivity | null
  activityLoading: boolean
  /** The record's audit trail, rendered by the container (RecordHistoryPanel). */
  history: ReactNode
}

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-sm'
const outlineBtn =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[hsl(var(--border-default))] px-4 text-sm font-medium text-[hsl(var(--fg-secondary))] transition-colors hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] disabled:opacity-50'
const primaryBtn =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[hsl(var(--color-primary))] px-5 text-sm font-bold text-[hsl(var(--color-primary-fg))] shadow-sm transition hover:brightness-110'

/** The caption over a supporting figure — the KPI card's caption, one step smaller. */
const FIGURE_LABEL = 'truncate text-[11px] text-[hsl(var(--fg-tertiary))]'

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

// Statuses with a label under customer360.status (desktop's next-intl shim has no `t.has`).
const KNOWN_STATUS = new Set(['paid', 'pending', 'completed', 'cancelled', 'draft'])

/**
 * The nine tabs of this page, in two groups — what was in a row of
 * nine is one of two tabs and a switch. The parts themselves are unchanged.
 *
 *   money          the account — صورت‌حساب · فاکتورها · پرداخت‌ها · حسابداری
 *   relationship   the customer — فعالیت · تحلیل · CRM · اعتبار و مدارک · تاریخچه
 */
export const CUSTOMER_TAB_GROUPS = {
  money: ['statement', 'invoices', 'payments', 'accounting'],
  relationship: ['activity', 'insights', 'crm', 'account', 'history'],
} as const
export type CustomerTabGroup = keyof typeof CUSTOMER_TAB_GROUPS
const CUSTOMER_GROUPS: readonly CustomerTabGroup[] = ['money', 'relationship']

/** The label key of each part — the same words the nine tabs carried. */
const TAB_LABEL = {
  statement: 'tabStatement',
  invoices: 'tabSales',
  payments: 'tabPayments',
  accounting: 'tabAccounting',
  activity: 'tabActivity',
  insights: 'tabInsights',
  crm: 'tabCrm',
  account: 'tabAccount',
  history: 'tabHistory',
} as const

/** The group a part belongs to; an unknown value is the first group. */
export function customerGroupOf(tab: string): CustomerTabGroup {
  return (CUSTOMER_TAB_GROUPS.relationship as readonly string[]).includes(tab)
    ? 'relationship'
    : 'money'
}

function isKnown(currency: string): currency is KnownCurrency {
  return currency in CURRENCY_SIGN
}

export function CustomerDetailView(props: CustomerDetailViewProps) {
  const t = useTranslations('customer360')
  const tc = useTranslations()
  const { customer, summary, locale } = props
  const [tab, setTab] = useState('statement')
  const group = customerGroupOf(tab)

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

  const balanceRows = !summary
    ? []
    : perCurrency
      ? byCurrency.map((row) => ({ currency: row.currency, value: row.netBalance }))
      : [{ currency: summaryCurrency, value: summary.netBalance }]

  /**
   * The due-date and aging breakdown, one block per currency for the same
   * reason: their totals are a sum of unlike things too.
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

  return (
    <div className="space-y-4 sm:space-y-5">
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

      {/* ── 1. Who this customer is · the one action that matters ─────────── */}
      <header className={cn(card, 'p-3 sm:p-5')}>
        <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
          <button
            type="button"
            onClick={props.onBack}
            aria-label={tc('customers.backToList')}
            className={cn(GHOST_ICON_BUTTON, FOCUS_RING, 'mt-0.5 shrink-0')}
          >
            <ChevronRight className="size-5 ltr:rotate-180" aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-[hsl(var(--fg-primary))] sm:text-2xl">
              {customer.name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[hsl(var(--fg-secondary))]">
              {customer.phone && <span dir="ltr">{customer.phone}</span>}
              {customer.email && <span dir="ltr">{customer.email}</span>}
              {customer.address && <span>{customer.address}</span>}
            </p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[hsl(var(--fg-tertiary))]">
              <span>
                {t('lastSale')}: {props.formatDate(summary?.lastSaleAt ?? null)}
              </span>
              <span>
                {t('lastPayment')}: {props.formatDate(summary?.lastPaymentAt ?? null)}
              </span>
            </p>
          </div>

          {/* One primary action and one money action. Print, export and delete
              used to sit beside them at the same weight, so nothing led. On a
              phone the primary action takes the row and the rest lives behind
              «بیشتر» — four buttons in a phone header is no header at all. */}
          <div className="flex w-full flex-wrap items-center gap-2 print:hidden md:w-auto">
            <button
              type="button"
              onClick={props.onNewInvoice}
              className={cn(primaryBtn, 'flex-1 md:flex-none')}
            >
              <FilePlus2 className="size-4" aria-hidden="true" />
              {t('newInvoice')}
            </button>
            {summary && summary.receivable > 0 && props.openInvoices.length > 0 && (
              <button
                type="button"
                onClick={props.onOpenPayment}
                className={cn(outlineBtn, 'flex-1 md:flex-none')}
              >
                <DollarSign className="size-4" aria-hidden="true" />
                {t('recordReceipt')}
              </button>
            )}
            <DropdownMenu>
              {/* A bare <button>: Radix's Slot clones exactly one element. */}
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={tc('common.more')}
                  title={tc('common.more')}
                  className={cn(outlineBtn, 'px-3')}
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{tc('common.more')}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!props.ledger || props.ledger.movements.length === 0}
                  onSelect={printStatement}
                >
                  <Printer className="size-4" aria-hidden="true" />
                  {t('printStatement')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!props.ledger || props.ledger.movements.length === 0}
                  onSelect={props.onExport}
                >
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
        </div>
      </header>
      {props.deleteError ? (
        <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {props.deleteError}
        </p>
      ) : null}

      {props.summaryError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[hsl(var(--color-destructive)/0.4)] bg-[hsl(var(--color-destructive)/0.06)] p-3 text-sm text-[hsl(var(--color-destructive))]"
        >
          {t('loadError')}
          <button type="button" onClick={props.onRetry} className={outlineBtn}>
            {t('retry')}
          </button>
        </div>
      )}

      {/* ── 2. Several currencies — said once, compactly ──────────────────── */}
      {summary && summary.currencies.length > 1 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[hsl(var(--color-warning)/0.35)] bg-[hsl(var(--color-warning)/0.07)] px-3 py-2.5">
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

      {/* ── 3. The balance — the one number this page is about ─────────────── */}
      {summary && (
        <section aria-labelledby="customer-net-balance" className={cn(card, 'overflow-hidden')}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--border-default))] px-4 py-3 sm:px-5">
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

          {/* One line per currency. Two currencies are never added together;
              with a single currency this is simply its net balance. */}
          <dl className="divide-y divide-[hsl(var(--border-default))] px-4 sm:px-5">
            {balanceRows.map((row) => {
              const text = money(row.value, row.currency)
              return (
                <div
                  key={row.currency || 'book'}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                >
                  <dt className="text-sm font-semibold text-[hsl(var(--fg-secondary))]" dir="ltr">
                    {row.currency}
                  </dt>
                  <dd
                    className={cn(
                      'font-bold tabular-nums',
                      headlineFontClass(text),
                      netTone(row.value),
                    )}
                    title={text}
                  >
                    {text}
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      )}

      {/* ── 4. What the balance is made of ─────────────────────────────────── */}
      {summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <KpiCard label={t('receivable')} value={figure((row) => row.receivable)} />
            {(summary.totalPurchases > 0 || summary.weOwe > 0) && (
              /* `weOwe` is the server's figure: purchase payable plus the credit a return on
                 an already-paid invoice created. A return used to show only in the net card. */
              <KpiCard
                label={t('payable')}
                value={figure((row) => row.weOwe)}
                {...(summary.returnCredit > 0 ? { hint: t('weOweIncludesReturns') } : {})}
              />
            )}
            <KpiCard label={t('totalSales')} value={figure((row) => row.totalSales)} />
            <KpiCard
              label={t('overdue')}
              value={figure((row) => row.overdue, summary.overdue > 0)}
              {...(summary.overdueInvoiceCount > 0
                ? { hint: t('overdueInvoices', { count: summary.overdueInvoiceCount }) }
                : {})}
            />
            <KpiCard
              label={t('openInvoices')}
              value={formatNumber(summary.openInvoiceCount, locale)}
              hint={t('invoiceCount', { count: summary.invoiceCount })}
              className="col-span-2 md:col-span-1"
            />
          </div>

          {/* The rest of the picture, one step down: it supports the five above
              and does not need the same weight. */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[hsl(var(--border-default))] pt-3 sm:grid-cols-3">
            <div className="min-w-0">
              <dt className={FIGURE_LABEL}>{t('totalReceived')}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                {figure((row) => row.totalReceived)}
              </dd>
            </div>
            {summary.totalPurchases > 0 && (
              <div className="min-w-0">
                <dt className={FIGURE_LABEL}>{t('totalPurchases')}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                  {figure((row) => row.totalPurchases)}
                </dd>
              </div>
            )}
            {summary.openingBalance !== 0 && (
              <div className="min-w-0">
                <dt className={FIGURE_LABEL}>{tc('customers.openingBalance')}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                  {figure((row) => row.openingBalance)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* ── What is owed: by due date and by age ─────────────────────────── */}
      {summary && summary.receivable > 0 && (
        <section className={cn(card, 'space-y-5 p-4')}>
          {owedByCurrency.map(({ currency, figures }) => (
            <div key={currency || 'book'}>
              {perCurrency && (
                <p className="mb-2 text-xs font-semibold text-[hsl(var(--fg-tertiary))]" dir="ltr">
                  {currency}
                </p>
              )}
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--fg-primary))]">
                    {t('receivable')}
                  </h2>
                  <dl className="space-y-2 text-sm">
                    <Row
                      label={t('overdue')}
                      value={money(figures.overdue, currency)}
                      tone="danger"
                    />
                    <Row
                      label={t('dueToday')}
                      value={money(figures.dueToday, currency)}
                      tone="warning"
                    />
                    <Row label={t('dueLater')} value={money(figures.dueLater, currency)} />
                  </dl>
                </div>
                <div>
                  <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--fg-primary))]">
                    {t('aging')}
                  </h2>
                  <dl className="space-y-2 text-sm">
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
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Statement / invoices / payments ─────────────────────────────── */}
      <Tabs value={tab} onValueChange={setTab} className={cn(card, 'p-3 sm:p-4')}>
        <p className="mb-2 hidden text-base font-bold print:block">{t('statementTitle')}</p>
        <div className="mb-3 space-y-3 print:hidden">
          <HubTabs
            label={t('groupsLabel')}
            items={CUSTOMER_GROUPS.map((id) => ({ id, label: t(`groups.${id}`) }))}
            active={group}
            // Opening a group opens its first part.
            onSelect={(next) => setTab(CUSTOMER_TAB_GROUPS[next][0])}
          />
          <SegmentedControl
            branch
            label={t('groupsLabel')}
            options={CUSTOMER_TAB_GROUPS[group].map((value) => ({
              value,
              label: t(TAB_LABEL[value]),
            }))}
            value={tab as (typeof CUSTOMER_TAB_GROUPS)[CustomerTabGroup][number]}
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
        </TabsContent>

        <TabsContent value="activity">
          <Activity {...props} money={money} />
        </TabsContent>

        <TabsContent value="insights">
          <CustomerInsightsPanel
            customerId={customer.id}
            formatMoney={(value) => money(value)}
            formatDate={props.formatDate}
          />
        </TabsContent>

        <TabsContent value="accounting">
          <CustomerAccountingPanel
            customerId={customer.id}
            formatMoney={(value) => money(value)}
            formatDate={props.formatDate}
            onOpenInvoice={props.onOpenInvoice}
          />
        </TabsContent>

        <TabsContent value="account">
          <CustomerProfilePanel customerId={customer.id} formatMoney={(value) => money(value)} />
          <CustomerPortalPanel customerId={customer.id} />
        </TabsContent>

        <TabsContent value="crm">
          <CustomerCrmPanel customerId={customer.id} formatMoney={(value) => money(value)} />
        </TabsContent>

        <TabsContent value="history">{props.history}</TabsContent>
      </Tabs>
    </div>
  )
}

type Money = (value: number, currency?: string) => string

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

  const totalColumns: TableColumn<StatementTotalsRow>[] = [
    {
      id: 'currency',
      labelKey: 'customer360.colCurrency',
      labelFallback: t('colCurrency'),
      sortValue: (row) => row.currency,
      render: (row) => (
        <span className="font-medium text-[hsl(var(--fg-primary))]">{row.currency || '—'}</span>
      ),
    },
    {
      id: 'totalSales',
      labelKey: 'customer360.totalSales',
      labelFallback: t('totalSales'),
      align: 'end',
      sortValue: (row) => row.totalSales,
      render: (row) => (
        <span className="tabular-nums text-[hsl(var(--fg-secondary))]">
          {row.totalSales != null ? props.money(row.totalSales, row.currency) : '—'}
        </span>
      ),
    },
    {
      id: 'totalPurchases',
      labelKey: 'customer360.totalPurchases',
      labelFallback: t('totalPurchases'),
      align: 'end',
      sortValue: (row) => row.totalPurchases,
      render: (row) => (
        <span className="tabular-nums text-[hsl(var(--fg-secondary))]">
          {row.totalPurchases != null ? props.money(row.totalPurchases, row.currency) : '—'}
        </span>
      ),
    },
    {
      id: 'totalReceived',
      labelKey: 'customer360.totalReceived',
      labelFallback: t('totalReceived'),
      align: 'end',
      sortValue: (row) => row.totalReceived,
      render: (row) => (
        <span className="tabular-nums text-[hsl(var(--fg-secondary))]">
          {row.totalReceived != null ? props.money(row.totalReceived, row.currency) : '—'}
        </span>
      ),
    },
    {
      id: 'totalPaid',
      labelKey: 'customer360.totalPaid',
      labelFallback: t('totalPaid'),
      align: 'end',
      sortValue: (row) => row.totalPaid,
      render: (row) => (
        <span className="tabular-nums text-[hsl(var(--fg-secondary))]">
          {row.totalPaid != null ? props.money(row.totalPaid, row.currency) : '—'}
        </span>
      ),
    },
    {
      id: 'netBalance',
      labelKey: 'customer360.colBalance',
      labelFallback: t('colBalance'),
      align: 'end',
      sortValue: (row) => row.netBalance,
      render: (row) => (
        <span
          className={cn(
            'font-medium tabular-nums',
            row.netBalance != null && row.netBalance > 0 && 'text-[hsl(var(--color-destructive))]',
          )}
        >
          {row.netBalance != null ? props.money(row.netBalance, row.currency) : '—'}
        </span>
      ),
    },
  ]

  const tableT = (key: string, fallback?: string): string => {
    const value = tc(key as never)
    return value && value !== key ? value : (fallback ?? key)
  }

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
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-2.5 text-sm text-[hsl(var(--fg-secondary))] transition-colors hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
            >
              <Download className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('exportStatement')}</span>
            </button>
          </>
        }
        empty={kind === 'all' ? t('statementEmpty') : t('noMatch')}
      />
      {ledger.openingBalance !== 0 ? (
        <p className="flex justify-between gap-3 px-3 text-sm text-[hsl(var(--fg-secondary))]">
          <span>{tc('customers.openingBalance')}</span>
          <span className="tabular-nums">{props.money(ledger.openingBalance)}</span>
        </p>
      ) : null}
      {currencyTotals.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('totalsTitle')}
          </h3>
          <DataTable
            tableId="customer-statement-totals"
            t={tableT}
            rows={currencyTotals}
            columns={totalColumns}
            rowKey={(row) => row.currency}
          />
        </div>
      )}
    </div>
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

// Sales vs receipts per month (server figures) as paired bars, then top products.
function Activity(props: CustomerDetailViewProps & { money: Money }) {
  const t = useTranslations('customer360')
  const tc = useTranslations()
  if (props.activityLoading) return <Empty text={tc('common.loading')} />
  const monthly = props.activity?.monthly ?? []
  const products = props.activity?.products ?? []
  const peak = Math.max(0, ...monthly.map((m) => Math.max(m.sales, m.receipts)))

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('chartTitle')}
        </h3>
        {peak === 0 ? (
          <Empty text={t('chartEmpty')} />
        ) : (
          <>
            <div className="flex h-40 items-end gap-1.5 overflow-x-auto" role="list">
              {monthly.map((m) => (
                <div
                  key={m.month}
                  role="listitem"
                  aria-label={`${m.month}: ${t('chartSales')} ${props.money(m.sales)}, ${t('chartReceipts')} ${props.money(m.receipts)}`}
                  className="flex min-w-8 flex-1 flex-col items-center gap-1"
                >
                  <div className="flex h-32 w-full items-end justify-center gap-0.5">
                    <span
                      className="w-2.5 rounded-t bg-[hsl(var(--color-primary))]"
                      style={{ height: `${(m.sales / peak) * 100}%` }}
                    />
                    <span
                      className="w-2.5 rounded-t bg-[hsl(var(--color-success))]"
                      style={{ height: `${(m.receipts / peak) * 100}%` }}
                    />
                  </div>
                  <span
                    className="text-[0.625rem] tabular-nums text-[hsl(var(--fg-tertiary))]"
                    dir="ltr"
                  >
                    {m.month.slice(2)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 flex gap-4 text-xs text-[hsl(var(--fg-secondary))]">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-sm bg-[hsl(var(--color-primary))]"
                />
                {t('chartSales')}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-sm bg-[hsl(var(--color-success))]"
                />
                {t('chartReceipts')}
              </span>
            </p>
          </>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('topProducts')}
        </h3>
        <SearchableTable
          tableId="customer-products"
          rows={products}
          columns={[
            {
              id: 'name',
              labelKey: 'customer360.colProduct',
              labelFallback: t('colProduct'),
              locked: true,
              sortValue: (p) => p.name,
              render: (p) => <span className="font-medium">{p.name}</span>,
            },
            {
              id: 'quantity',
              labelKey: 'customer360.colQuantity',
              labelFallback: t('colQuantity'),
              align: 'end',
              sortValue: (p) => p.quantity,
              render: (p) => (
                <span className="tabular-nums">
                  {formatNumber(p.quantity, props.locale)}{' '}
                  {translateOr(tc, `unit.${p.unit}`, p.unit)}
                </span>
              ),
            },
            {
              id: 'amount',
              labelKey: 'customer360.colAmount',
              labelFallback: t('colAmount'),
              align: 'end',
              sortValue: (p) => p.amount,
              render: (p) => <span className="tabular-nums">{props.money(p.amount)}</span>,
            },
            {
              id: 'invoices',
              labelKey: 'customer360.colInvoices',
              labelFallback: t('colInvoices'),
              align: 'end',
              showFrom: 'md',
              sortValue: (p) => p.invoiceCount,
              render: (p) => (
                <span className="tabular-nums">{formatNumber(p.invoiceCount, props.locale)}</span>
              ),
            },
            {
              id: 'lastSold',
              labelKey: 'customer360.colLastSold',
              labelFallback: t('colLastSold'),
              showFrom: 'md',
              sortValue: (p) => p.lastSoldAt,
              render: (p) => props.formatDate(p.lastSoldAt),
            },
          ]}
          rowKey={(p) => p.productId ?? p.name}
          words={(p) => [p.name]}
          empty={t('noProducts')}
        />
      </section>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-[hsl(var(--fg-secondary))]">{text}</p>
}
