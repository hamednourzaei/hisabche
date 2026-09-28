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

import { KpiCard } from '../kpi-card'
import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertTriangle,
  ChevronRight,
  DollarSign,
  Download,
  FilePlus2,
  FileText,
  Printer,
} from 'lucide-react'
import type { PartyActivity, PartyLedger, PartySummary, PaymentRecord } from '@hisabche/api'
import { CURRENCY_SIGN, formatMoney, formatNumber, type KnownCurrency } from '@hisabche/formatting'

import { cn } from '../../../lib/utils'
import { GHOST_ICON_BUTTON } from '../button-classes'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../tabs'
import { PaymentModal } from './PaymentModal'
import { CustomerCrmPanel } from '../crm/customer-crm-panel'
import { CustomerProfilePanel } from './customer-profile-panel'
import { CustomerPortalPanel } from './customer-portal-panel'
import { CustomerAccountingPanel, CustomerInsightsPanel } from './customer-analysis-panels'

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
const th = 'px-3 py-2 text-start text-xs font-medium text-[hsl(var(--fg-tertiary))]'
const td = 'px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))]'

// Statuses with a label under customer360.status (desktop's next-intl shim has no `t.has`).
const KNOWN_STATUS = new Set(['paid', 'pending', 'completed', 'cancelled', 'draft'])

function isKnown(currency: string): currency is KnownCurrency {
  return currency in CURRENCY_SIGN
}

export function CustomerDetailView(props: CustomerDetailViewProps) {
  const t = useTranslations('customer360')
  const tc = useTranslations()
  const { customer, summary, locale } = props
  const [tab, setTab] = useState('statement')

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

  const net = summary?.netBalance ?? 0
  const netLabel = net > 0 ? t('netOwesUs') : net < 0 ? t('netWeOwe') : t('netSettled')

  return (
    <div className="space-y-5">
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

      {/* ── Identity and actions ─────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={props.onBack}
            aria-label={tc('customers.backToList')}
            className={cn(GHOST_ICON_BUTTON, 'mt-0.5 shrink-0 rounded-full')}
          >
            <ChevronRight className="size-5 ltr:rotate-180" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-[hsl(var(--fg-primary))]">
              {customer.name}
            </h1>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[hsl(var(--fg-secondary))]">
              {customer.phone && <span dir="ltr">{customer.phone}</span>}
              {customer.email && <span dir="ltr">{customer.email}</span>}
              {customer.address && <span>{customer.address}</span>}
            </p>
            <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-[hsl(var(--fg-tertiary))]">
              <span>
                {t('lastSale')}: {props.formatDate(summary?.lastSaleAt ?? null)}
              </span>
              <span>
                {t('lastPayment')}: {props.formatDate(summary?.lastPaymentAt ?? null)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={printStatement}
            disabled={!props.ledger || props.ledger.movements.length === 0}
            className={outlineBtn}
          >
            <Printer className="size-4" aria-hidden="true" />
            {t('printStatement')}
          </button>
          <button type="button" onClick={props.onNewInvoice} className={outlineBtn}>
            <FilePlus2 className="size-4" aria-hidden="true" />
            {t('newInvoice')}
          </button>
          <button
            type="button"
            onClick={props.onExport}
            disabled={!props.ledger || props.ledger.movements.length === 0}
            className={outlineBtn}
          >
            <Download className="size-4" aria-hidden="true" />
            {t('exportStatement')}
          </button>
          {(summary?.receivable ?? 0) > 0 && props.openInvoices.length > 0 && (
            <button type="button" onClick={props.onOpenPayment} className={primaryBtn}>
              <DollarSign className="size-4" aria-hidden="true" />
              {t('recordReceipt')}
            </button>
          )}
        </div>
      </header>

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

      {summary && summary.currencies.length > 1 && (
        <p className="flex items-start gap-2 rounded-xl border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.06)] p-3 text-sm text-[hsl(var(--fg-secondary))]">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-[hsl(var(--color-warning))]"
            aria-hidden="true"
          />
          {t('mixedCurrency', { currencies: summary.currencies.join('، ') })}
        </p>
      )}

      {/* ── The money picture ─────────────────────────────────────────────── */}
      {summary && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {/* ⚠️ The sign is the whole meaning here: positive is money THEY
              owe us, negative is money WE owe them. The colour carries it,
              and `netLabel` says it in words so colour is not the only
              channel. */}
          <KpiCard
            label={t('netBalance')}
            value={
              <span
                className={
                  net > 0
                    ? 'text-[hsl(var(--color-destructive))]'
                    : net < 0
                      ? 'text-[hsl(var(--color-success))]'
                      : 'text-[hsl(var(--fg-primary))]'
                }
              >
                {money(Math.abs(net))}
              </span>
            }
            hint={netLabel}
            className={cn('col-span-2', net > 0 && 'border-[hsl(var(--color-destructive)/0.35)]')}
          />
          <Stat label={t('receivable')} value={money(summary.receivable)} />
          <Stat
            label={t('overdue')}
            value={money(summary.overdue)}
            tone={summary.overdue > 0 ? 'danger' : undefined}
            hint={
              summary.overdueInvoiceCount > 0
                ? t('overdueInvoices', { count: summary.overdueInvoiceCount })
                : undefined
            }
          />
          <Stat label={t('totalSales')} value={money(summary.totalSales)} />
          <Stat label={t('totalReceived')} value={money(summary.totalReceived)} />
          {(summary.totalPurchases > 0 || summary.payable > 0) && (
            <>
              <Stat label={t('totalPurchases')} value={money(summary.totalPurchases)} />
              <Stat label={t('payable')} value={money(summary.payable)} />
            </>
          )}
          <Stat
            label={t('openInvoices')}
            value={formatNumber(summary.openInvoiceCount, locale)}
            hint={t('invoiceCount', { count: summary.invoiceCount })}
          />
          {summary.openingBalance !== 0 && (
            <Stat label={tc('customers.openingBalance')} value={money(summary.openingBalance)} />
          )}
        </section>
      )}

      {/* ── What is owed: by due date and by age ─────────────────────────── */}
      {summary && summary.receivable > 0 && (
        <section className={cn(card, 'grid gap-5 p-4 md:grid-cols-2')}>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--fg-primary))]">
              {t('receivable')}
            </h2>
            <dl className="space-y-2 text-sm">
              <Row label={t('overdue')} value={money(summary.overdue)} tone="danger" />
              <Row label={t('dueToday')} value={money(summary.dueToday)} tone="warning" />
              <Row label={t('dueLater')} value={money(summary.dueLater)} />
            </dl>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--fg-primary))]">
              {t('aging')}
            </h2>
            <dl className="space-y-2 text-sm">
              <Row label={t('agingCurrent')} value={money(summary.aging.current)} />
              <Row label={t('aging1to30')} value={money(summary.aging.days1to30)} tone="warning" />
              <Row label={t('aging31to60')} value={money(summary.aging.days31to60)} tone="danger" />
              <Row label={t('aging61to90')} value={money(summary.aging.days61to90)} tone="danger" />
              <Row label={t('agingOver90')} value={money(summary.aging.over90)} tone="danger" />
            </dl>
          </div>
        </section>
      )}

      {/* ── Statement / invoices / payments ─────────────────────────────── */}
      <Tabs value={tab} onValueChange={setTab} className={cn(card, 'p-3 sm:p-4')}>
        <p className="mb-2 hidden text-base font-bold print:block">{t('statementTitle')}</p>
        <TabsList className="mb-3 flex-wrap print:hidden">
          <TabsTrigger value="statement">{t('tabStatement')}</TabsTrigger>
          <TabsTrigger value="invoices">{t('tabSales')}</TabsTrigger>
          <TabsTrigger value="payments">{t('tabPayments')}</TabsTrigger>
          <TabsTrigger value="activity">{t('tabActivity')}</TabsTrigger>
          <TabsTrigger value="insights">{t('tabInsights')}</TabsTrigger>
          <TabsTrigger value="accounting">{t('tabAccounting')}</TabsTrigger>
          <TabsTrigger value="account">{t('tabAccount')}</TabsTrigger>
          <TabsTrigger value="crm">{t('tabCrm')}</TabsTrigger>
          <TabsTrigger value="history">{t('tabHistory')}</TabsTrigger>
        </TabsList>

        <TabsContent value="statement">
          <Statement {...props} money={money} />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesTable {...props} money={money} />
        </TabsContent>

        <TabsContent value="payments">
          {props.payments.length === 0 ? (
            <Empty text={t('noPayments')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-[hsl(var(--border-default))]">
                    <th className={th}>{t('colDate')}</th>
                    <th className={th}>{t('colReference')}</th>
                    <th className={th}>{t('colType')}</th>
                    <th className={th}>{t('colMethod')}</th>
                    <th className={cn(th, 'text-end')}>{t('colTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {props.payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-[hsl(var(--border-default)/0.6)]"
                    >
                      <td className={td}>{props.formatDate(payment.entryDate)}</td>
                      <td className={td}>{payment.paymentNumber ?? '—'}</td>
                      <td className={td}>
                        {t(`kind.${payment.direction === 'in' ? 'payment_in' : 'payment_out'}`)}
                      </td>
                      <td className={td}>{payment.method}</td>
                      <td className={cn(td, 'text-end tabular-nums')}>
                        {money(payment.amount, payment.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
  if (props.ledgerLoading) return <Empty text={tc('common.loading')} />
  if (!ledger || ledger.movements.length === 0) return <Empty text={t('statementEmpty')} />

  // Newest first on screen; the running balance is the server's, after each row.
  const rows = [...ledger.movements].reverse()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b border-[hsl(var(--border-default))]">
            <th className={th}>{t('colDate')}</th>
            <th className={th}>{t('colType')}</th>
            <th className={th}>{t('colReference')}</th>
            <th className={cn(th, 'text-end')}>{t('colDebit')}</th>
            <th className={cn(th, 'text-end')}>{t('colCredit')}</th>
            <th className={cn(th, 'text-end')}>{t('colBalance')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            // Debit raises what they owe us (a sale, or money we paid out).
            const debit = row.kind === 'sale' || row.kind === 'payment_out'
            const clickable = row.sourceType === 'invoice' && row.sourceId
            return (
              <tr
                key={`${row.sourceId ?? row.reference}-${index}`}
                className="border-b border-[hsl(var(--border-default)/0.6)]"
              >
                <td className={td}>{props.formatDate(row.date)}</td>
                <td className={td}>{t(`kind.${row.kind}`)}</td>
                <td className={td}>
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => props.onOpenInvoice(row.sourceId!)}
                      className="font-medium text-[hsl(var(--color-primary))] hover:underline"
                    >
                      {row.reference}
                    </button>
                  ) : (
                    row.reference
                  )}
                </td>
                <td className={cn(td, 'text-end tabular-nums')}>
                  {debit ? props.money(row.amount, row.currency) : '—'}
                </td>
                <td className={cn(td, 'text-end tabular-nums')}>
                  {debit ? '—' : props.money(row.amount, row.currency)}
                </td>
                <td
                  className={cn(
                    td,
                    'text-end font-medium tabular-nums',
                    row.balance > 0 && 'text-[hsl(var(--color-destructive))]',
                  )}
                >
                  {props.money(row.balance)}
                </td>
              </tr>
            )
          })}
          {ledger.openingBalance !== 0 && (
            <tr>
              <td className={td} colSpan={5}>
                {tc('customers.openingBalance')}
              </td>
              <td className={cn(td, 'text-end tabular-nums')}>
                {props.money(ledger.openingBalance)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function InvoicesTable(props: CustomerDetailViewProps & { money: Money }) {
  const t = useTranslations('customer360')
  if (props.invoices.length === 0) return <Empty text={t('noInvoices')} />
  const pages = Math.max(1, Math.ceil(props.invoicesTotal / props.invoicePageSize))
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--border-default))]">
              <th className={th}>{t('colReference')}</th>
              <th className={th}>{t('colDate')}</th>
              <th className={th}>{t('colDue')}</th>
              <th className={th}>{t('colStatus')}</th>
              <th className={cn(th, 'text-end')}>{t('colTotal')}</th>
              <th className={cn(th, 'text-end')}>{t('colPaid')}</th>
              <th className={cn(th, 'text-end')}>{t('colRemaining')}</th>
            </tr>
          </thead>
          <tbody>
            {props.invoices.map((invoice) => {
              const remaining = Math.max(0, invoice.total - invoice.paidAmount)
              return (
                <tr
                  key={invoice.id}
                  onClick={() => props.onOpenInvoice(invoice.id)}
                  className="cursor-pointer border-b border-[hsl(var(--border-default)/0.6)] hover:bg-[hsl(var(--surface-muted)/0.5)]"
                >
                  <td className={cn(td, 'font-medium text-[hsl(var(--color-primary))]')}>
                    {t(`kind.${invoice.type}`)} #{invoice.invoiceNumber}
                  </td>
                  <td className={td}>{props.formatDate(invoice.date)}</td>
                  <td className={td}>
                    {invoice.dueDate ? props.formatDate(invoice.dueDate) : '—'}
                  </td>
                  <td className={td}>
                    {KNOWN_STATUS.has(invoice.status)
                      ? t(`status.${invoice.status}`)
                      : invoice.status}
                  </td>
                  <td className={cn(td, 'text-end tabular-nums')}>
                    {props.money(invoice.total, invoice.currency)}
                  </td>
                  <td className={cn(td, 'text-end tabular-nums')}>
                    {props.money(invoice.paidAmount, invoice.currency)}
                  </td>
                  <td
                    className={cn(
                      td,
                      'text-end font-medium tabular-nums',
                      remaining > 0 && 'text-[hsl(var(--color-destructive))]',
                    )}
                  >
                    {props.money(remaining, invoice.currency)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
 * The product's KPI card, with this screen's one addition: `tone: 'danger'`
 * colours the FIGURE because the figure itself is bad news (money overdue).
 * That is a different question from `invertDelta`, which is about the
 * direction of a change.
 */
function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string | undefined
  tone?: 'danger' | undefined
}) {
  return (
    <KpiCard
      label={label}
      value={
        tone === 'danger' ? (
          <span className="text-[hsl(var(--color-destructive))]">{value}</span>
        ) : (
          value
        )
      }
      {...(hint ? { hint } : {})}
    />
  )
}

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
        {products.length === 0 ? (
          <Empty text={t('noProducts')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border-default))]">
                  <th className={th}>{t('colProduct')}</th>
                  <th className={cn(th, 'text-end')}>{t('colQuantity')}</th>
                  <th className={cn(th, 'text-end')}>{t('colAmount')}</th>
                  <th className={cn(th, 'text-end')}>{t('colInvoices')}</th>
                  <th className={th}>{t('colLastSold')}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.productId ?? p.name}
                    className="border-b border-[hsl(var(--border-default)/0.5)]"
                  >
                    <td className={td}>{p.name}</td>
                    <td className={cn(td, 'text-end tabular-nums')}>
                      {formatNumber(p.quantity, props.locale)} {p.unit}
                    </td>
                    <td className={cn(td, 'text-end tabular-nums')}>{props.money(p.amount)}</td>
                    <td className={cn(td, 'text-end tabular-nums')}>
                      {formatNumber(p.invoiceCount, props.locale)}
                    </td>
                    <td className={td}>{props.formatDate(p.lastSoldAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-[hsl(var(--fg-secondary))]">{text}</p>
}
