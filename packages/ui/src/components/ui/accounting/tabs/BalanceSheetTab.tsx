// packages/ui/src/components/ui/accounting/tabs/BalanceSheetTab.tsx
'use client'

import { memo, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '../../../../lib/utils'
import { useBalanceSheet, type TrialBalance } from '@hisabche/api'
import { SingleDatePicker } from '../components/DateRangePicker'
import { ExportButton, type ExportColumn } from '../components/ExportButton'
import { AccountingSkeleton } from '../AccountingSkeleton'
import { AccountingEmptyState } from '../AccountingEmptyState'
import { useLedgerNumber } from '../components/ledger-table'

interface DetailRow {
  section: string
  label: string
  amount: number
}

const exportColumns: ExportColumn<DetailRow>[] = [
  { key: 'section', header: 'بخش', accessor: (r) => r.section },
  { key: 'label', header: 'شرح', accessor: (r) => r.label },
  { key: 'amount', header: 'مبلغ', accessor: (r) => r.amount },
]

/**
 * ⚠️ TOKENS, NOT RAW TAILWIND COLOURS.
 *
 * These sections were `bg-blue-500/10 text-blue-500`, `bg-rose-500/10` and
 * `bg-purple-500/10` — three palette colours that exist in no theme file. They
 * do not respond to the light/dark switch the rest of the app uses, and they
 * are not in the design tokens, so nothing about the product's colour can be
 * changed in one place while they are here.
 *
 * Assets / liabilities / equity is not a rainbow anyway. It is one accounting
 * identity with two sides, so: primary for what the business HAS, destructive
 * for what it OWES, and a neutral accent for the residual.
 */
const SECTION_TONE = {
  assets: 'bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))]',
  liabilities: 'bg-[hsl(var(--color-destructive)/0.10)] text-[hsl(var(--color-destructive))]',
  equity: 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-primary))]',
} as const

function SectionBlock({
  title,
  total,
  details,
  tone,
  emptyLabel,
}: {
  title: string
  total: number
  details: TrialBalance[]
  tone: keyof typeof SECTION_TONE
  emptyLabel: string
}) {
  const n = useLedgerNumber()

  return (
    <section className="overflow-hidden rounded-xl border border-[hsl(var(--border-default))]">
      <header className={cn('flex items-center justify-between px-4 py-3', SECTION_TONE[tone])}>
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-sm font-bold tabular-nums">{n(total, 'zero')}</span>
      </header>

      <div className="divide-y divide-[hsl(var(--border-default)/0.5)]">
        {details.length === 0 ? (
          <p className="px-4 py-3 text-sm text-[hsl(var(--fg-tertiary))]">{emptyLabel}</p>
        ) : (
          details.map((d) => (
            <div key={d.accountId} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-sm text-[hsl(var(--fg-secondary))]">{d.accountName}</span>
              {/* tabular-nums: without it a column of figures does not align. */}
              <span className="text-sm font-medium tabular-nums text-[hsl(var(--fg-primary))]">
                {n(d.balance)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export const BalanceSheetTab = memo(function BalanceSheetTab() {
  const t = useTranslations()
  const n = useLedgerNumber()
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const { data, isLoading } = useBalanceSheet(date)

  const exportData = useMemo<DetailRow[]>(() => {
    if (!data) return []
    const rows: DetailRow[] = []
    for (const d of data.assets)
      rows.push({ section: 'دارایی', label: d.accountName, amount: d.balance })
    for (const d of data.liabilities)
      rows.push({ section: 'بدهی', label: d.accountName, amount: d.balance })
    for (const d of data.equity)
      rows.push({ section: 'حقوق صاحبان سهام', label: d.accountName, amount: d.balance })
    rows.push({
      section: 'حقوق صاحبان سهام',
      label: 'سود (زیان) دوره',
      amount: data.currentYearEarnings,
    })
    return rows
  }, [data])

  // The server reports the gap; the screen does not recompute it. A sheet that
  // adds up its own visible rows always balances, even when rows are missing.
  const isBalanced = data ? data.outOfBalanceBy === 0 : false

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-[hsl(var(--border-default))] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t('accounting.balanceSheet.title')}
        </h2>
        <div className="flex items-center gap-3">
          <SingleDatePicker
            value={date}
            onChange={setDate}
            label={t('accounting.balanceSheet.asOf')}
          />
          <ExportButton
            data={exportData}
            columns={exportColumns}
            filename="balance-sheet"
            className="mb-0"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <AccountingSkeleton />
        ) : !data ? (
          <AccountingEmptyState title={t('accounting.balanceSheet.empty.title')} />
        ) : (
          <div className="space-y-4">
            <SectionBlock
              title={t('accounting.balanceSheet.assets')}
              total={data.totalAssets}
              details={data.assets}
              tone="assets"
              emptyLabel={t('accounting.balanceSheet.empty.title')}
            />
            <SectionBlock
              title={t('accounting.balanceSheet.liabilities')}
              total={data.totalLiabilities}
              details={data.liabilities}
              tone="liabilities"
              emptyLabel={t('accounting.balanceSheet.empty.title')}
            />
            <SectionBlock
              title={t('accounting.balanceSheet.equity')}
              total={data.totalEquity}
              details={data.equity}
              tone="equity"
              emptyLabel={t('accounting.balanceSheet.empty.title')}
            />

            {/*
              The accounting identity, stated. `role="alert"` when it does NOT
              hold: a balance sheet that does not balance is the most important
              thing this screen can say, and it used to be a line in the same
              weight as the rest.
            */}
            <div
              {...(isBalanced ? {} : { role: 'alert' })}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-semibold',
                isBalanced
                  ? 'bg-[hsl(var(--color-success)/0.10)] text-[hsl(var(--color-success))]'
                  : 'bg-[hsl(var(--color-destructive)/0.10)] text-[hsl(var(--color-destructive))]',
              )}
            >
              <span>
                {isBalanced
                  ? t('accounting.balanceSheet.balanced')
                  : t('accounting.balanceSheet.unbalanced')}
              </span>
              <span className="tabular-nums">
                {n(data.totalAssets, 'zero')} ={' '}
                {n(data.totalLiabilities + data.totalEquity, 'zero')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
