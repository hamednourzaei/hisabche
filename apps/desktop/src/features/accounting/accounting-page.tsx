// ============================================
// Accounting — transactions, trial balance, profit/loss, balance sheet.
// Each report is a tab over the shared accounting hooks.
// ============================================

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import {
  useBalanceSheet,
  useIncomeStatement,
  useTransactions,
  useTrialBalance,
  type TrialBalance,
} from '@hisabche/api'
import type { Transaction } from '@hisabche/validation'

import { Button, Card } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FilterTabs, type FilterOption } from '@/components/ui/filter-tabs'
import { PageHeader } from '@/components/layout/page-header'
import { exportRows } from '@/shared/lib/spreadsheet'
import { formatDate, formatMoney } from '@/shared/lib/currency'
import { useCurrency } from '@/shared/stores/ui.store'

type Report = 'transactions' | 'trialBalance' | 'profitLoss' | 'balance'

export default function AccountingPage() {
  const { t } = useTranslation('desktop')
  const currency = useCurrency()
  const [report, setReport] = useState<Report>('transactions')

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const transactions = useTransactions(
    useMemo(() => ({ page: 1, limit: 300, sortDirection: 'desc' as const }), [])
  )
  const trialBalance = useTrialBalance(today)
  const income = useIncomeStatement(today, today)
  const balanceSheet = useBalanceSheet(today)

  const options: readonly FilterOption<Report>[] = [
    { value: 'transactions', label: t('accounting.title') },
    { value: 'trialBalance', label: t('accounting.trialBalance') },
    { value: 'profitLoss', label: t('accounting.profitLoss') },
    { value: 'balance', label: t('customers.balance') },
  ]

  const txColumns = useMemo<readonly Column<Transaction>[]>(
    () => [
      {
        key: 'description',
        header: t('accounting.title'),
        width: '1fr',
        render: (row) => row.description ?? row.type,
      },
      { key: 'date', header: t('sales.date'), width: '150px', render: (row) => formatDate(row.date) },
      {
        key: 'amount',
        header: t('sales.amount'),
        width: '170px',
        align: 'end',
        render: (row) => formatMoney(row.amount, currency),
      },
    ],
    [currency, t]
  )

  const tbColumns = useMemo<readonly Column<TrialBalance>[]>(
    () => [
      { key: 'account', header: t('accounting.title'), width: '1fr', render: (row) => row.accountName },
      { key: 'code', header: t('inventory.barcode'), width: '120px', render: (row) => row.accountCode },
      {
        key: 'debit',
        header: t('accounting.expense'),
        width: '150px',
        align: 'end',
        render: (row) => formatMoney(row.debit, currency),
      },
      {
        key: 'credit',
        header: t('accounting.income'),
        width: '150px',
        align: 'end',
        render: (row) => formatMoney(row.credit, currency),
      },
    ],
    [currency, t]
  )

  const onExport = async (): Promise<void> => {
    const rows =
      report === 'trialBalance'
        ? (trialBalance.data ?? []).map((row) => ({
            account: row.accountName,
            debit: row.debit,
            credit: row.credit,
          }))
        : (transactions.data?.transactions ?? []).map((row: Transaction) => ({
            description: row.description ?? row.type,
            date: row.date,
            amount: row.amount,
          }))

    await exportRows(`${report}.xlsx`, rows)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t('accounting.title')}>
        <Button size="sm" variant="secondary" onClick={() => void onExport()}>
          <Download size={14} />
          {t('common.export')}
        </Button>
      </PageHeader>

      <FilterTabs options={options} value={report} onChange={setReport} />

      {report === 'transactions' && (
        <DataTable
          rows={transactions.data?.transactions ?? []}
          columns={txColumns}
          rowKey={(row, index) => row.id ?? `tx-${index}`}
          loading={transactions.isLoading}
          emptyLabel={t('common.empty')}
        />
      )}

      {report === 'trialBalance' && (
        <DataTable
          rows={trialBalance.data ?? []}
          columns={tbColumns}
          rowKey={(row) => row.accountId}
          loading={trialBalance.isLoading}
          emptyLabel={t('common.empty')}
        />
      )}

      {report === 'profitLoss' && (
        <div className="grid grid-cols-3 gap-4 p-4">
          <Card>
            <span className="text-xs text-[hsl(var(--fg-secondary))]">{t('accounting.income')}</span>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {formatMoney(income.data?.revenue ?? 0, currency)}
            </p>
          </Card>
          <Card>
            <span className="text-xs text-[hsl(var(--fg-secondary))]">{t('accounting.expense')}</span>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {formatMoney(income.data?.expenses ?? 0, currency)}
            </p>
          </Card>
          <Card>
            <span className="text-xs text-[hsl(var(--fg-secondary))]">{t('accounting.profitLoss')}</span>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {formatMoney(income.data?.netIncome ?? 0, currency)}
            </p>
          </Card>
        </div>
      )}

      {report === 'balance' && (
        <div className="grid grid-cols-3 gap-4 p-4">
          <Card>
            <span className="text-xs text-[hsl(var(--fg-secondary))]">assets</span>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {formatMoney(balanceSheet.data?.assets?.total ?? 0, currency)}
            </p>
          </Card>
          <Card>
            <span className="text-xs text-[hsl(var(--fg-secondary))]">liabilities</span>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {formatMoney(balanceSheet.data?.liabilities?.total ?? 0, currency)}
            </p>
          </Card>
          <Card>
            <span className="text-xs text-[hsl(var(--fg-secondary))]">equity</span>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {formatMoney(balanceSheet.data?.equity?.total ?? 0, currency)}
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
