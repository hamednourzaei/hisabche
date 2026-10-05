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
import { DataTable, TableFilterSelect, matchesSearch, type TableColumn } from '../data-table'
import { useIntlLocale } from '../../../hooks/use-intl-locale'

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
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  // The document whose ledger lines are open under the table.
  const [openId, setOpenId] = useState<string | null>(null)
  const translate = useTranslations()
  const tableT = (key: string, fallback?: string): string => {
    const value = translate(key as never)
    return value && value !== key ? value : (fallback ?? key)
  }

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

  type Doc = (typeof data.documents)[number]
  type Line = Doc['entries'][number]['lines'][number] & { entryNumber: string | null }
  const rows = data.documents
    .filter((doc) => filter === 'all' || (filter === 'unposted' ? doc.unposted : !doc.unposted))
    .filter((doc) => matchesSearch(search, [doc.reference, tKind(doc.kind), formatDate(doc.date)]))
  const open = openId ? data.documents.find((doc) => doc.sourceId === openId) : undefined
  const openLines: Line[] = (open?.entries ?? []).flatMap((entry) =>
    entry.lines.map((line) => ({ ...line, entryNumber: entry.entryNumber })),
  )

  const columns: TableColumn<Doc>[] = [
    {
      id: 'date',
      labelKey: 'customerAnalysis.colDate',
      labelFallback: t('colDate'),
      sortValue: (doc) => doc.date,
      render: (doc) => formatDate(doc.date),
    },
    {
      id: 'document',
      labelKey: 'customerAnalysis.colDocument',
      labelFallback: t('colDocument'),
      locked: true,
      sortValue: (doc) => doc.reference,
      render: (doc) => (
        <>
          <span className="font-medium">{doc.reference}</span>
          <span className="block text-xs text-[hsl(var(--fg-tertiary))]">{tKind(doc.kind)}</span>
        </>
      ),
    },
    {
      id: 'entry',
      labelKey: 'customerAnalysis.colEntry',
      labelFallback: t('colEntry'),
      sortValue: (doc) => (doc.unposted ? 0 : 1),
      render: (doc) =>
        doc.unposted ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[hsl(var(--color-warning)/0.12)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--color-warning))]">
              {t('unposted')}
            </span>
            {doc.sourceType === 'invoice' ? (
              <button
                type="button"
                disabled={post.isPending}
                onClick={(event) => {
                  // The row itself opens the lines.
                  event.stopPropagation()
                  post.mutate(doc.sourceId, { onSettled: () => void refetch() })
                }}
                className="text-xs font-medium text-[hsl(var(--color-primary))] hover:underline disabled:opacity-50"
              >
                {t('postNow')}
              </button>
            ) : null}
          </span>
        ) : (
          <span className="text-xs" dir="ltr">
            {/* A reversal and an entry that is not in the books yet say so. */}
            {doc.entries
              .map(
                (entry) =>
                  (entry.entryNumber ?? '—') +
                  (entry.reversalOf ? ` (${t('reversal')})` : '') +
                  (entry.status !== 'posted'
                    ? ` (${t(`status.${entry.status === 'draft' ? 'draft' : 'other'}`)})`
                    : ''),
              )
              .join(' · ')}
          </span>
        ),
    },
    {
      id: 'amount',
      labelKey: 'customerAnalysis.colAmount',
      labelFallback: t('colAmount'),
      align: 'end',
      sortValue: (doc) => doc.amount,
      render: (doc) => <span className="tabular-nums">{formatMoney(doc.amount)}</span>,
    },
  ]

  const lineColumns: TableColumn<Line>[] = [
    {
      id: 'entry',
      labelKey: 'customerAnalysis.colEntry',
      labelFallback: t('colEntry'),
      sortValue: (line) => line.entryNumber ?? '',
      render: (line) => <span dir="ltr">{line.entryNumber ?? '—'}</span>,
    },
    {
      id: 'account',
      labelKey: 'customerAnalysis.colAccount',
      labelFallback: t('colAccount'),
      locked: true,
      sortValue: (line) => line.accountCode,
      render: (line) => (
        <>
          <span dir="ltr" className="me-1 tabular-nums text-[hsl(var(--fg-tertiary))]">
            {line.accountCode}
          </span>
          {line.accountName}
        </>
      ),
    },
    {
      id: 'debit',
      labelKey: 'customerAnalysis.colDebit',
      labelFallback: t('colDebit'),
      align: 'end',
      sortValue: (line) => line.debit,
      render: (line) => (
        <span className="tabular-nums">{line.debit ? formatMoney(line.debit) : '—'}</span>
      ),
    },
    {
      id: 'credit',
      labelKey: 'customerAnalysis.colCredit',
      labelFallback: t('colCredit'),
      align: 'end',
      sortValue: (line) => line.credit,
      render: (line) => (
        <span className="tabular-nums">{line.credit ? formatMoney(line.credit) : '—'}</span>
      ),
    },
  ]

  return (
    <section className="space-y-3">
      <p className="text-sm text-[hsl(var(--fg-secondary))]">
        {t('postedSummary', { posted: data.postedCount, unposted: data.unpostedCount })}
      </p>

      {/* One row per DOCUMENT; pressing it opens its ledger lines underneath. */}
      <DataTable
        tableId="customer-accounting"
        t={tableT}
        rows={rows}
        columns={columns}
        rowKey={(doc) => doc.sourceId}
        onRowClick={(doc) =>
          setOpenId((current) => (current === doc.sourceId ? null : doc.sourceId))
        }
        searchValue={search}
        onSearchChange={setSearch}
        actions={
          <TableFilterSelect
            label={t('colEntry')}
            value={filter}
            onChange={setFilter}
            allValue="all"
            options={[
              { value: 'all', label: t('filterAll') },
              { value: 'unposted', label: t('unposted') },
              { value: 'posted', label: t('posted') },
            ]}
          />
        }
        minWidthClass="min-w-[420px]"
        emptyState={<Status text={filter === 'unposted' ? t('allPosted') : t('noMatch')} />}
      />

      {open ? (
        <div className="space-y-2 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] p-3">
          <p className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-[hsl(var(--fg-primary))]">
            <span>{open.reference}</span>
            {open.sourceType === 'invoice' && onOpenInvoice ? (
              <button
                type="button"
                onClick={() => onOpenInvoice(open.sourceId)}
                className="text-xs text-[hsl(var(--color-primary))] hover:underline"
              >
                {t('openDocument')}
              </button>
            ) : null}
          </p>
          <DataTable
            tableId="customer-accounting-lines"
            t={tableT}
            rows={openLines}
            columns={lineColumns}
            rowKey={(line, index) => `${line.entryNumber ?? 'entry'}-${line.accountCode}-${index}`}
            minWidthClass="min-w-[420px]"
            emptyState={<Status text={t('unposted')} />}
          />
        </div>
      ) : null}
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
