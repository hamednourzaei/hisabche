// packages/ui/src/components/ui/accounting/tabs/IncomeStatementTab.tsx
'use client'

import { memo, useCallback, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { toIsoDay } from '@hisabche/formatting'
import { cn } from '../../../../lib/utils'
import { useIncomeStatement, type TrialBalance } from '@hisabche/api'
import { DateRangePicker } from '../components/DateRangePicker'
import { ExportButton, type ExportColumn } from '../components/ExportButton'
import { AccountingSkeleton } from '../AccountingSkeleton'
import { AccountingEmptyState } from '../AccountingEmptyState'
import { useLedgerNumber } from '../components/ledger-table'
import { useAccountDrilldown } from '../components/use-account-drilldown'
import { BranchSwitcher, useBranchScope } from '../../branch/branch-scope'

interface SummaryRow {
  label: string
  value: number
}

const exportColumns: ExportColumn<SummaryRow>[] = [
  { key: 'label', header: 'شرح', accessor: (r) => r.label },
  { key: 'value', header: 'مبلغ', accessor: (r) => r.value },
]

// Local calendar day — never toISOString(): in UTC+ zones (Kabul +4:30) local
// midnight on the 1st is still the previous month's last day in UTC.
function getFirstDayOfMonth(): string {
  const d = new Date()
  return toIsoDay(new Date(d.getFullYear(), d.getMonth(), 1))
}

function getToday(): string {
  return toIsoDay(new Date())
}

/**
 * One block of the statement: a heading, its accounts, and its total.
 *
 * ⚠️ WHY THIS REPLACED THREE KPI CARDS
 *
 * Revenue, expenses and net income were rendered as three cards side by side.
 * They are not three independent figures — they are ONE SUBTRACTION:
 *
 *     revenue − expenses = net income
 *
 * Laid out horizontally with equal weight, nothing on the screen says that. A
 * reader had to know the arithmetic already to see it, and the accounts making
 * up each total were not shown at all — they were computed for the CSV export
 * and then thrown away.
 *
 * A statement reads top to bottom and shows its own working.
 */
function StatementSection({
  title,
  total,
  accounts,
  emptyLabel,
  onOpenAccount,
}: {
  title: string
  total: number
  accounts: TrialBalance[]
  emptyLabel: string
  /** H3 — drill into the lines behind one line of the statement. */
  onOpenAccount: (account: { id: string; code: string; name: string }) => void
}) {
  const n = useLedgerNumber()

  return (
    <section className="overflow-hidden rounded-xl border border-[hsl(var(--border-default))]">
      <header className="flex items-center justify-between border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.5)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{title}</h3>
        <span className="text-sm font-bold tabular-nums text-[hsl(var(--fg-primary))]">
          {n(total, 'zero')}
        </span>
      </header>

      <div className="divide-y divide-[hsl(var(--border-default)/0.5)]">
        {accounts.length === 0 ? (
          <p className="px-4 py-3 text-sm text-[hsl(var(--fg-tertiary))]">{emptyLabel}</p>
        ) : (
          accounts.map((account) => (
            <div
              key={account.accountId}
              className="flex items-center justify-between gap-4 px-4 py-2.5"
            >
              {/* H3 — opens this account's lines for the SAME from/to window
                  the statement is showing. An income statement is a PERIOD
                  report, so an unbounded drill-down would list lines from
                  outside it and not add up to the figure clicked. */}
              <button
                type="button"
                onClick={() =>
                  onOpenAccount({
                    id: account.accountId,
                    code: account.accountCode,
                    name: account.accountName,
                  })
                }
                className="rounded text-start text-sm text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
              >
                {account.accountName}
              </button>
              <span className="text-sm font-medium tabular-nums text-[hsl(var(--fg-primary))]">
                {n(account.balance)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export const IncomeStatementTab = memo(function IncomeStatementTab() {
  const t = useTranslations()
  const n = useLedgerNumber()
  const [from, setFrom] = useState(getFirstDayOfMonth)
  const [to, setTo] = useState(getToday)
  const { branchId } = useBranchScope()
  const { data, isLoading } = useIncomeStatement(from, to, branchId)

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key as never)
      return v && v !== key ? v : (fallback ?? key)
    },
    [t],
  )

  // H3 — BOTH ends of the window, unlike the two «as at» reports. An income
  // statement covers a period, and a drill-down that ignored `from` would list
  // lines from before it and disagree with the figure that opened it.
  const drilldown = useAccountDrilldown(from, to, safeT)

  const exportData = useMemo<SummaryRow[]>(() => {
    if (!data) return []
    return [
      ...data.revenue.map((r) => ({ label: r.accountName, value: r.balance })),
      ...data.expenses.map((r) => ({ label: r.accountName, value: r.balance })),
      { label: 'جمع درآمد', value: data.totalRevenue },
      { label: 'جمع هزینه‌ها', value: data.totalExpenses },
      { label: 'سود (زیان) خالص', value: data.netIncome },
    ]
  }, [data])

  const isProfit = (data?.netIncome ?? 0) >= 0

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-[hsl(var(--border-default))] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t('accounting.incomeStatement.title')}
        </h2>
        <div className="flex items-end gap-3">
          <BranchSwitcher t={safeT} />
          <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          <ExportButton data={exportData} columns={exportColumns} filename="income-statement" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <AccountingSkeleton rows={3} />
        ) : !data ? (
          <AccountingEmptyState title={t('accounting.incomeStatement.empty.title')} />
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            <StatementSection
              title={t('accounting.incomeStatement.revenue')}
              total={data.totalRevenue}
              accounts={data.revenue}
              emptyLabel={t('accounting.incomeStatement.empty.title')}
              onOpenAccount={drilldown.open}
            />

            <StatementSection
              title={t('accounting.incomeStatement.expenses')}
              total={data.totalExpenses}
              accounts={data.expenses}
              emptyLabel={t('accounting.incomeStatement.empty.title')}
              onOpenAccount={drilldown.open}
            />

            {/*
              The result, given the weight of a result. Loss and profit are
              distinguished by colour AND by the parenthesised figure — the
              accounting convention for a negative — so the sign does not
              depend on being able to tell green from red.
            */}
            <section
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 px-4 py-4',
                isProfit
                  ? 'border-[hsl(var(--color-success)/0.35)] bg-[hsl(var(--color-success)/0.06)]'
                  : 'border-[hsl(var(--color-destructive)/0.35)] bg-[hsl(var(--color-destructive)/0.06)]',
              )}
            >
              <h3 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
                {t('accounting.incomeStatement.netIncome')}
              </h3>
              <p
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  isProfit
                    ? 'text-[hsl(var(--color-success))]'
                    : 'text-[hsl(var(--color-destructive))]',
                )}
              >
                {isProfit ? n(data.netIncome, 'zero') : `(${n(Math.abs(data.netIncome), 'zero')})`}
              </p>
            </section>
          </div>
        )}
      </div>

      {drilldown.drawer}
    </div>
  )
})
