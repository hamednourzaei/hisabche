'use client'

// ============================================
// Customer 360 phase 4 — accounting view and insights.
//
// CustomerAccountingPanel: every invoice and payment of the customer with the
// journal entries that account for it (GET /customers/:id/accounting). A
// document with no live posted entry is flagged, and an unposted invoice can
// be posted from here through the existing ledger action.
//
// CustomerInsightsPanel: rule-based observations (GET /customers/:id/insights).
// Every number in a sentence comes from the server's `values`; the panel says
// plainly that these are rules over the customer's figures, not a model.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, Info, TrendingUp } from 'lucide-react'
import {
  useCustomerAccounting,
  useCustomerInsights,
  usePostInvoiceToLedger,
  type CustomerInsight,
} from '@hisabche/api'
import { formatNumber } from '@hisabche/formatting'

import { cn } from '../../../lib/utils'
import { useIntlLocale } from '../../../hooks/use-intl-locale'

const th = 'px-3 py-2 text-start text-xs font-medium text-[hsl(var(--fg-tertiary))]'
const td = 'px-3 py-2 text-sm text-[hsl(var(--fg-primary))]'

// Keys in `values` that are money; the rest are counts, days or percentages.
const MONEY_VALUES = new Set([
  'limit',
  'used',
  'over',
  'overdue',
  'recent',
  'previous',
  'sales',
  'receipts',
])

interface PanelProps {
  customerId: string
  formatMoney: (value: number) => string
  formatDate: (value: string | null) => string
  onOpenInvoice?: ((id: string) => void) | undefined
}

function Status({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'error' }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'py-8 text-center text-sm',
        tone === 'error'
          ? 'text-[hsl(var(--color-destructive))]'
          : 'text-[hsl(var(--fg-secondary))]',
      )}
    >
      {text}
    </p>
  )
}

export function CustomerAccountingPanel({
  customerId,
  formatMoney,
  formatDate,
  onOpenInvoice,
}: PanelProps) {
  const t = useTranslations('customerAnalysis')
  const tKind = useTranslations('customer360.kind')
  const { data, isLoading, isError, refetch } = useCustomerAccounting(customerId)
  const post = usePostInvoiceToLedger()
  const [onlyUnposted, setOnlyUnposted] = useState(false)

  if (isLoading) return <Status text={t('loading')} />
  if (isError || !data) {
    return (
      <div className="py-6 text-center">
        <Status text={t('loadError')} tone="error" />
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-sm text-[hsl(var(--color-primary))] hover:underline"
        >
          {t('retry')}
        </button>
      </div>
    )
  }
  if (data.documents.length === 0) return <Status text={t('noDocuments')} />

  const rows = onlyUnposted ? data.documents.filter((doc) => doc.unposted) : data.documents

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-[hsl(var(--fg-secondary))]">
          {t('postedSummary', { posted: data.postedCount, unposted: data.unpostedCount })}
        </p>
        <label className="flex items-center gap-2 text-[hsl(var(--fg-secondary))]">
          <input
            id="customer-accounting-only-unposted"
            type="checkbox"
            checked={onlyUnposted}
            onChange={(e) => setOnlyUnposted(e.target.checked)}
          />
          {t('onlyUnposted')}
        </label>
      </div>

      {rows.length === 0 ? (
        <Status text={t('allPosted')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border-default))]">
                <th className={th}>{t('colDate')}</th>
                <th className={th}>{t('colDocument')}</th>
                <th className={th}>{t('colEntry')}</th>
                <th className={th}>{t('colAccount')}</th>
                <th className={cn(th, 'text-end')}>{t('colDebit')}</th>
                <th className={cn(th, 'text-end')}>{t('colCredit')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((doc) => {
                const lines = doc.entries.flatMap((entry) =>
                  entry.lines.map((line, index) => ({ entry, line, first: index === 0 })),
                )
                const head = (
                  <>
                    <td className={td}>{formatDate(doc.date)}</td>
                    <td className={td}>
                      {doc.sourceType === 'invoice' && onOpenInvoice ? (
                        <button
                          type="button"
                          onClick={() => onOpenInvoice(doc.sourceId)}
                          className="text-[hsl(var(--color-primary))] hover:underline"
                        >
                          {doc.reference}
                        </button>
                      ) : (
                        doc.reference
                      )}
                      <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                        {tKind(doc.kind)} · {formatMoney(doc.amount)}
                      </span>
                    </td>
                  </>
                )
                if (doc.unposted && lines.length === 0) {
                  return (
                    <tr
                      key={doc.sourceId}
                      className="border-b border-[hsl(var(--border-default)/0.5)]"
                    >
                      {head}
                      <td className={td} colSpan={4}>
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[hsl(var(--color-warning)/0.12)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--color-warning))]">
                            {t('unposted')}
                          </span>
                          {doc.sourceType === 'invoice' && (
                            <button
                              type="button"
                              disabled={post.isPending}
                              onClick={() =>
                                post.mutate(doc.sourceId, { onSettled: () => void refetch() })
                              }
                              className="text-xs font-medium text-[hsl(var(--color-primary))] hover:underline disabled:opacity-50"
                            >
                              {t('postNow')}
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                }
                return lines.map(({ entry, line, first }, index) => (
                  <tr
                    key={`${doc.sourceId}-${entry.id}-${index}`}
                    className={cn(
                      index === lines.length - 1 &&
                        'border-b border-[hsl(var(--border-default)/0.5)]',
                    )}
                  >
                    {index === 0 ? head : <td className={td} colSpan={2} />}
                    <td className={cn(td, 'text-xs')}>
                      {first && (
                        <>
                          <span dir="ltr">{entry.entryNumber ?? '—'}</span>
                          {entry.reversalOf && (
                            <span className="ms-1 text-[hsl(var(--fg-tertiary))]">
                              ({t('reversal')})
                            </span>
                          )}
                          {entry.status !== 'posted' && (
                            <span className="ms-1 text-[hsl(var(--color-warning))]">
                              ({t(`status.${entry.status === 'draft' ? 'draft' : 'other'}`)})
                            </span>
                          )}
                          {doc.unposted && index === 0 && (
                            <span className="ms-1 text-[hsl(var(--color-warning))]">
                              · {t('unposted')}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className={td}>
                      <span dir="ltr" className="me-1 tabular-nums text-[hsl(var(--fg-tertiary))]">
                        {line.accountCode}
                      </span>
                      {line.accountName}
                    </td>
                    <td className={cn(td, 'text-end tabular-nums')}>
                      {line.debit ? formatMoney(line.debit) : '—'}
                    </td>
                    <td className={cn(td, 'text-end tabular-nums')}>
                      {line.credit ? formatMoney(line.credit) : '—'}
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const SEVERITY = {
  critical: {
    icon: AlertTriangle,
    tone: 'text-[hsl(var(--color-destructive))]',
    bg: 'bg-[hsl(var(--color-destructive)/0.08)]',
  },
  warning: {
    icon: AlertTriangle,
    tone: 'text-[hsl(var(--color-warning))]',
    bg: 'bg-[hsl(var(--color-warning)/0.1)]',
  },
  info: {
    icon: Info,
    tone: 'text-[hsl(var(--fg-secondary))]',
    bg: 'bg-[hsl(var(--surface-muted))]',
  },
  positive: {
    icon: TrendingUp,
    tone: 'text-[hsl(var(--color-success))]',
    bg: 'bg-[hsl(var(--color-success)/0.1)]',
  },
} as const

export function CustomerInsightsPanel({
  customerId,
  formatMoney,
  formatDate,
}: Omit<PanelProps, 'onOpenInvoice'>) {
  const t = useTranslations('customerAnalysis')
  const locale = useIntlLocale()
  const { data, isLoading, isError, refetch } = useCustomerInsights(customerId)

  if (isLoading) return <Status text={t('loading')} />
  if (isError || !data) {
    return (
      <div className="py-6 text-center">
        <Status text={t('loadError')} tone="error" />
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-sm text-[hsl(var(--color-primary))] hover:underline"
        >
          {t('retry')}
        </button>
      </div>
    )
  }

  const params = (insight: CustomerInsight) =>
    Object.fromEntries(
      Object.entries(insight.values).map(([key, value]) => [
        key,
        MONEY_VALUES.has(key) ? formatMoney(value) : formatNumber(value, locale),
      ]),
    )

  return (
    <section className="space-y-3">
      <p className="text-xs text-[hsl(var(--fg-tertiary))]">
        {t('insightsDisclaimer', { date: formatDate(data.asOf || null) })}
      </p>
      {data.insights.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-[hsl(var(--color-success))]">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {t('noInsights')}
        </p>
      ) : (
        <ul className="space-y-2">
          {data.insights.map((insight) => {
            const style = SEVERITY[insight.severity] ?? SEVERITY.info
            const Icon = style.icon
            return (
              <li
                key={insight.code}
                className={cn('flex items-start gap-3 rounded-xl p-3 text-sm', style.bg)}
              >
                <Icon className={cn('mt-0.5 size-4 shrink-0', style.tone)} aria-hidden="true" />
                <div>
                  <p className="font-medium text-[hsl(var(--fg-primary))]">
                    {t(`insight.${insight.code}.title`)}
                  </p>
                  <p className="mt-0.5 text-[hsl(var(--fg-secondary))]">
                    {t(`insight.${insight.code}.body`, params(insight))}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
