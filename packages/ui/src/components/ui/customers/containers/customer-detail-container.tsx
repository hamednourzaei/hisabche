'use client'

// ============================================
// Customer 360 — container.
//
// ⚠️ EVERY MONEY FIGURE ON THIS PAGE COMES FROM THE SERVER.
// This container used to load the first 50 customers of the workspace and look
// the customer up in that list (a customer past the fiftieth showed «not
// found»), then load the first 200 invoices of the WHOLE workspace and add the
// customer's rows up in the browser (totals silently wrong past that point, and
// every amount labelled «AFN» whatever the invoice's currency).
//
// Now:
//   customer            GET /customers/:id
//   summary             GET /payments/summary/customer/:id   (payments.domain#summarizeParty)
//   statement           GET /payments/ledger/customer/:id    (every row, paged on the server)
//   open invoices       GET /payments/open-invoices/customer/:id (payment modal targets)
//   invoices tab        GET /invoices?customerId=…            (paginated)
//   payments tab        GET /payments?partyId=…
//   activity tab        GET /payments/activity/customer/:id
//   CRM tab             GET /crm/customers/:id   (CustomerCrmPanel, CRM Core port)
//   history tab         GET record history (useRecordHistory)
// ============================================

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  useCustomer,
  useInvoices,
  useOpenInvoices,
  usePartyActivity,
  usePartyLedger,
  usePartySummary,
  usePayments,
  useRecordHistory,
} from '@hisabche/api'
import { toIsoDay } from '@hisabche/formatting'

import { exportToCSV } from '../../../../lib/export'
import { useDateFormat } from '../../../../hooks/use-date-format'
import { useIntlLocale } from '../../../../hooks/use-intl-locale'
import { CustomerDetailView } from '../customer-detail-view'
import { RecordHistoryPanel } from '../../activity/record-history-panel'
import { useLocalePush } from '../../../../hooks/use-locale-push'

const INVOICE_PAGE_SIZE = 20

export function CustomerDetailContainer({ customerId }: { customerId: string }) {
  const t = useTranslations()
  const router = useRouter()
  const push = useLocalePush()
  const locale = useIntlLocale()
  const { date: formatDate } = useDateFormat()
  const [payOpen, setPayOpen] = useState(false)

  // Back restores the list the person came from — its filters and scroll —
  // through real history; a profile opened from a link has nothing to go back
  // to, so it falls back to the list. This lived in the web page while desktop
  // always jumped to the list, so the same button behaved differently per host.
  const onBack = useCallback(() => {
    if (window.history.length > 1) router.back()
    else push('/customers')
  }, [router, push])
  const [invoicePage, setInvoicePage] = useState(1)

  const customerQuery = useCustomer(customerId)
  const summaryQuery = usePartySummary('customer', customerId)
  const ledgerQuery = usePartyLedger('customer', customerId)
  const openInvoicesQuery = useOpenInvoices('customer', customerId)
  const invoicesQuery = useInvoices({
    page: invoicePage,
    limit: INVOICE_PAGE_SIZE,
    sortDirection: 'desc',
    customerId,
  })
  const paymentsQuery = usePayments({ partyId: customerId, limit: 100 })
  const activityQuery = usePartyActivity('customer', customerId)
  const { data: recordHistory, isLoading: historyLoading } = useRecordHistory(
    'customer',
    customerId,
  )
  const safeT = useCallback(
    (key: string, fallback?: string) => {
      try {
        return t(key)
      } catch {
        return fallback ?? key
      }
    },
    [t],
  )

  const customer = useMemo(() => {
    const raw = customerQuery.data as
      | {
          id: string
          fullName?: string
          name?: string
          phone?: string
          email?: string
          address?: string
        }
      | undefined
    if (!raw) return null
    return {
      id: raw.id,
      name: raw.fullName || raw.name || t('common.noName'),
      phone: raw.phone || '',
      email: raw.email || '',
      address: raw.address || '',
    }
  }, [customerQuery.data, t])

  // The payment modal's allocation targets — from the server, not a filtered list.
  const openInvoices = useMemo(
    () =>
      (openInvoicesQuery.data ?? []).map((invoice) => ({
        id: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        paidAmount: invoice.allocated,
        date: invoice.invoiceDate,
        status: 'pending',
        customerId,
      })),
    [openInvoicesQuery.data, customerId],
  )

  const invoiceList = useMemo(() => {
    const data = invoicesQuery.data as
      { invoices?: Array<Record<string, unknown>>; total?: number } | undefined
    return {
      rows: (data?.invoices ?? []).map((row) => ({
        id: String(row['id']),
        invoiceNumber: String(row['invoiceNumber'] ?? ''),
        type: row['type'] === 'purchase' ? ('purchase' as const) : ('sale' as const),
        status: String(row['status'] ?? ''),
        date: String(row['date'] ?? ''),
        dueDate: row['dueDate'] ? String(row['dueDate']) : '',
        total: Number(row['total']) || 0,
        paidAmount: Number(row['paidAmount']) || 0,
        currency: String(row['currency'] ?? ''),
      })),
      total: Number(data?.total) || 0,
    }
  }, [invoicesQuery.data])

  const handleExport = useCallback(() => {
    const ledger = ledgerQuery.data
    if (!customer || !ledger) return
    const kind = (k: string) => t(`customer360.kind.${k}`)
    const rows = [
      {
        date: '',
        type: t('customers.openingBalance'),
        reference: '',
        debit: ledger.openingBalance > 0 ? ledger.openingBalance : '',
        credit: ledger.openingBalance < 0 ? -ledger.openingBalance : '',
        balance: ledger.openingBalance,
        currency: '',
      },
      ...ledger.movements.map((row) => {
        const increases = row.kind === 'sale' || row.kind === 'payment_out'
        return {
          date: row.date,
          type: kind(row.kind),
          reference: row.reference,
          debit: increases ? row.amount : '',
          credit: increases ? '' : row.amount,
          balance: row.balance,
          currency: row.currency ?? '',
        }
      }),
    ]
    exportToCSV(
      rows,
      [
        { key: 'date', label: t('customer360.colDate') },
        { key: 'type', label: t('customer360.colType') },
        { key: 'reference', label: t('customer360.colReference') },
        { key: 'debit', label: t('customer360.colDebit') },
        { key: 'credit', label: t('customer360.colCredit') },
        { key: 'balance', label: t('customer360.colBalance') },
        { key: 'currency', label: 'currency' },
      ],
      `statement-${customer.name}-${toIsoDay(new Date())}`,
    )
  }, [customer, ledgerQuery.data, t])

  const refetchMoney = useCallback(() => {
    void summaryQuery.refetch()
    void ledgerQuery.refetch()
    void openInvoicesQuery.refetch()
    void invoicesQuery.refetch()
    void paymentsQuery.refetch()
    void activityQuery.refetch()
  }, [summaryQuery, ledgerQuery, openInvoicesQuery, invoicesQuery, paymentsQuery, activityQuery])

  return (
    <CustomerDetailView
      locale={locale}
      formatDate={(value) => (value ? formatDate(value) : t('customer360.never'))}
      customer={customer}
      customerLoading={customerQuery.isLoading}
      summary={summaryQuery.data ?? null}
      summaryError={summaryQuery.isError}
      ledger={ledgerQuery.data ?? null}
      ledgerLoading={ledgerQuery.isLoading}
      invoices={invoiceList.rows}
      invoicesTotal={invoiceList.total}
      invoicePage={invoicePage}
      invoicePageSize={INVOICE_PAGE_SIZE}
      onInvoicePage={setInvoicePage}
      payments={paymentsQuery.data ?? []}
      openInvoices={openInvoices}
      payOpen={payOpen}
      onBack={onBack}
      onRetry={refetchMoney}
      onOpenPayment={() => setPayOpen(true)}
      onClosePayment={() => setPayOpen(false)}
      onPaymentSuccess={refetchMoney}
      onNewInvoice={() => push('/invoices/new')}
      onOpenInvoice={(id) => push(`/invoices/${id}`)}
      onExport={handleExport}
      activity={activityQuery.data ?? null}
      activityLoading={activityQuery.isLoading}
      history={
        <RecordHistoryPanel
          t={safeT}
          isLoading={historyLoading}
          entries={(recordHistory ?? []).map((entry) => ({
            id: entry.id,
            action: entry.action,
            createdAt: entry.created_at,
            userId: entry.user_id ?? null,
          }))}
        />
      }
    />
  )
}
