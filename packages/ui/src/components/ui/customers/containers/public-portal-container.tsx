'use client'

// ============================================
// packages/ui/src/components/ui/customers/containers/public-portal-container.tsx
//
// A customer's own account, opened from the link the business sent them.
// No login, no sidebar. Fetches GET /api/public/portal/:token — the same
// pattern as PublicInvoiceContainer.
//
// Three different answers, three different sentences: loading, a link that
// no longer works (404), and a request that failed (anything else).
// ============================================

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatNumber } from '@hisabche/formatting'
import { localizePath } from '@hisabche/ui-contract'

import { useDateFormat } from '../../../../hooks/use-date-format'
import { KpiCard } from '../../kpi-card'

const BASE_URL =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : undefined) ||
  'https://api.hisabche.com/api'

interface PortalResponse {
  businessName: string | null
  customerName: string
  balance: number
  isDebtor: boolean
  invoices: Array<{
    invoiceNumber: string | null
    date: string
    dueDate: string | null
    total: number
    paidAmount: number
    currency: string
    status: string
    publicToken: string | null
  }>
  invoiceCount: number
  payments: Array<{
    number: string | null
    date: string
    amount: number
    currency: string
    method: string
  }>
  paymentCount: number
  orders: Array<{ orderNumber: string; status: string; total: number; createdAt: string }>
}

type State =
  | { kind: 'loading' }
  | { kind: 'gone' }
  | { kind: 'error' }
  | { kind: 'ready'; data: PortalResponse }

export function PublicPortalContainer({ token }: { token: string }) {
  const t = useTranslations()
  const locale = useLocale()
  const { date } = useDateFormat()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    fetch(`${BASE_URL}/public/portal/${token}`)
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404) return setState({ kind: 'gone' })
        if (!res.ok) return setState({ kind: 'error' })
        setState({ kind: 'ready', data: (await res.json()) as PortalResponse })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const n = (value: number) => formatNumber(value, locale, 2)

  if (state.kind === 'loading') {
    return <p className="p-8 text-center text-[hsl(var(--fg-secondary))]">{t('portal.loading')}</p>
  }
  if (state.kind === 'gone') {
    return <p className="p-8 text-center text-[hsl(var(--fg-secondary))]">{t('portal.gone')}</p>
  }
  if (state.kind === 'error') {
    return (
      <p className="p-8 text-center text-[hsl(var(--color-destructive))]">
        {t('portal.loadError')}
      </p>
    )
  }

  const d = state.data
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        {d.businessName && (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{d.businessName}</p>
        )}
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{d.customerName}</h1>
      </header>

      <KpiCard
        label={
          d.isDebtor
            ? t('portal.youOwe')
            : d.balance === 0
              ? t('portal.settled')
              : t('portal.inCredit')
        }
        value={<span dir="ltr">{n(Math.abs(d.balance))}</span>}
      />

      <section className="space-y-2">
        <h2 className="font-semibold">
          {t('portal.invoices')} ({d.invoiceCount})
        </h2>
        {d.invoices.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('portal.noInvoices')}</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border-default))] rounded-2xl border border-[hsl(var(--border-default))]">
            {d.invoices.map((inv, i) => (
              <li
                key={`${inv.invoiceNumber}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
              >
                <span>
                  <span dir="ltr">{inv.invoiceNumber ?? '—'}</span>
                  <span className="ms-2 text-[hsl(var(--fg-tertiary))]">{date(inv.date)}</span>
                </span>
                <span className="tabular-nums" dir="ltr">
                  {n(inv.paidAmount)} / {n(inv.total)} {inv.currency}
                </span>
                {inv.publicToken && (
                  <a
                    className="text-[hsl(var(--color-primary))] underline-offset-4 hover:underline"
                    href={localizePath(`/public-invoice/${inv.publicToken}`, locale)}
                    rel="nofollow"
                  >
                    {t('portal.viewInvoice')}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        {d.invoiceCount > d.invoices.length && (
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('portal.showingLatest')}</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">
          {t('portal.payments')} ({d.paymentCount})
        </h2>
        {d.payments.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('portal.noPayments')}</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border-default))] rounded-2xl border border-[hsl(var(--border-default))]">
            {d.payments.map((p, i) => (
              <li key={`${p.number}-${i}`} className="flex justify-between gap-2 p-3 text-sm">
                <span>{date(p.date)}</span>
                <span className="tabular-nums" dir="ltr">
                  {n(p.amount)} {p.currency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {d.orders.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">{t('portal.orders')}</h2>
          <ul className="divide-y divide-[hsl(var(--border-default))] rounded-2xl border border-[hsl(var(--border-default))]">
            {d.orders.map((o) => (
              <li key={o.orderNumber} className="flex justify-between gap-2 p-3 text-sm">
                <span dir="ltr">{o.orderNumber}</span>
                <span>{t(`orders.status.${o.status}`)}</span>
                <span className="tabular-nums" dir="ltr">
                  {n(o.total)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
