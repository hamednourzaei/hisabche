// ============================================
// Customer detail — profile, ledger balance, transaction history.
// ============================================

import React, { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCustomer, useLedger, useTransactions } from '@hisabche/api'
import type { Transaction } from '@hisabche/validation'

import { Button, Card, Skeleton } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/layout/page-header'
import { formatDate, formatMoney } from '@/shared/lib/currency'
import { useCurrency } from '@/shared/stores/ui.store'

export default function CustomerDetailPage() {
  const { t } = useTranslation('desktop')
  const { id } = useParams<{ id: string }>()
  const currency = useCurrency()

  const customer = useCustomer(id)
  const ledger = useLedger(id)
  const transactions = useTransactions(
    useMemo(() => ({ page: 1, limit: 300, sortDirection: 'desc' as const, customerId: id }), [id])
  )

  const columns = useMemo<readonly Column<Transaction>[]>(
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

  if (customer.isLoading) {
    return (
      <div className="flex flex-col gap-3 p-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (customer.isError || !customer.data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('common.error')}</p>
          <Button size="sm" onClick={() => void customer.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      </div>
    )
  }

  const balance = ledger.data?.closingBalance ?? customer.data.openingBalance ?? 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={customer.data.fullName} subtitle={customer.data.phone ?? undefined} />

      <div className="grid shrink-0 grid-cols-3 gap-4 p-4">
        <Card>
          <span className="text-xs text-[hsl(var(--fg-secondary))]">
            {balance > 0 ? t('customers.debt') : t('customers.credit')}
          </span>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {formatMoney(Math.abs(balance), currency)}
          </p>
        </Card>
        <Card>
          <span className="text-xs text-[hsl(var(--fg-secondary))]">{t('accounting.income')}</span>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {formatMoney(ledger.data?.totalCredit ?? 0, currency)}
          </p>
        </Card>
        <Card>
          <span className="text-xs text-[hsl(var(--fg-secondary))]">{t('accounting.expense')}</span>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {formatMoney(ledger.data?.totalDebit ?? 0, currency)}
          </p>
        </Card>
      </div>

      <DataTable
        rows={transactions.data?.transactions ?? []}
        columns={columns}
        rowKey={(row, index) => row.id ?? `tx-${index}`}
        loading={transactions.isLoading}
        emptyLabel={t('common.empty')}
      />
    </div>
  )
}
