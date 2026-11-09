// ============================================
// The pre-sale / pre-purchase list — one of the type options of /invoices
// (همه · فروش · خرید · پیش‌فروش · پیش‌خرید), not a tab of its own
// (owner request, 8 Nov 2026: «the invoices page must not get crowded»).
//
// ONE table, from GET /advances. Each row says what is left of it — the
// server's count, the same one apply and refund are checked against. Applying
// an advance to its invoice, or giving it back, happens on the party's page in
// the deposits panel that already does it. Creating one goes through the same
// «new invoice» chooser as a sale or a purchase.
//
// `?advance=<id>` (from the accounting journal's «show document») narrows the
// list to that one advance, with a way back to all of them.
// ============================================

'use client'

import { useCallback, useMemo, useState } from 'react'
import { CheckCircle2, Clock, FileText, Wallet } from 'lucide-react'
import { FRACTION_DIGITS, fractionDigits, type KnownCurrency } from '@hisabche/formatting'
import { useTranslations } from 'next-intl'
import { useAdvances, useCustomers, type CustomerDepositRecord } from '@hisabche/api'

import { useLocalePush } from '../../../../hooks/use-locale-push'
import { useDateFormat } from '../../../../hooks/use-date-format'
import { Badge } from '../../badge'
import { Money } from '../../capability/capability-kit'
import { DataTable, TableFilterMenu } from '../../data-table'
import { BentoStats, type BentoStat } from '../../bento-stats'
import type { TableColumn } from '../../data-table/table-types'

export type AdvanceListKind = 'pre_sale' | 'pre_purchase'

export function AdvancesContainer({
  kind,
  focusId = null,
  onShowAll,
}: {
  kind: AdvanceListKind
  /** One advance to show on its own (the journal's «show document»). */
  focusId?: string | null | undefined
  onShowAll?: (() => void) | undefined
}) {
  const t = useTranslations()
  const tr = useCallback((key: string): string => t(key as never), [t])
  const push = useLocalePush()
  const dates = useDateFormat()
  const advances = useAdvances(kind)
  const parties = useCustomers({ page: 1, limit: 100, sortDirection: 'desc' })

  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const party of parties.data?.customers ?? [])
      if (party.id) map.set(party.id, party.fullName)
    return map
  }, [parties.data])

  // The same status filter the invoice table has, in the table's own toolbar.
  const [status, setStatus] = useState<'all' | CustomerDepositRecord['status']>('all')
  const rows = useMemo(() => {
    const list = advances.data ?? []
    if (focusId) return list.filter((row) => row.id === focusId)
    return status === 'all' ? list : list.filter((row) => row.status === status)
  }, [advances.data, focusId, status])

  // Four figures, like the invoice list above them (owner: «no more than 4»).
  // Display only: minor → major for the card; a mixed-currency list gets no
  // suffix rather than a wrong one.
  const stats = useMemo<BentoStat[]>(() => {
    const list = advances.data ?? []
    const currencies = [...new Set(list.map((row) => row.currency ?? '?'))]
    const only = currencies.length === 1 ? currencies[0] : undefined
    const digits = only && only in FRACTION_DIGITS ? fractionDigits(only as KnownCurrency) : null
    const major = (minor: number) => (digits === null ? undefined : minor / 10 ** digits)
    const sum = (pick: (row: CustomerDepositRecord) => number) =>
      list.reduce((acc, row) => acc + pick(row), 0)
    const withSuffix = digits !== null && only ? { suffix: only } : {}
    const money = (
      id: string,
      icon: BentoStat['icon'],
      label: string,
      minor: number,
    ): BentoStat => {
      const amount = major(minor)
      return amount === undefined
        ? { id, icon, label, text: '—' }
        : { id, icon, label, amount, ...withSuffix }
    }
    return [
      money(
        'amount',
        Wallet,
        tr('advances.kpi.amount'),
        sum((row) => row.amountMinor),
      ),
      { id: 'count', icon: FileText, label: tr('advances.kpi.count'), amount: list.length },
      money(
        'remaining',
        Clock,
        tr('advances.kpi.remaining'),
        sum((row) => row.remainingMinor),
      ),
      money(
        'used',
        CheckCircle2,
        tr('advances.kpi.used'),
        sum((row) => row.appliedMinor + row.refundedMinor),
      ),
    ]
  }, [advances.data, tr])

  const columns: TableColumn<CustomerDepositRecord>[] = [
    {
      id: 'date',
      labelKey: 'advances.columns.date',
      labelFallback: '',
      render: (row) => dates.date(row.createdAt),
      sortValue: (row) => row.createdAt,
    },
    {
      id: 'party',
      labelKey: kind === 'pre_sale' ? 'advances.customer' : 'advances.supplier',
      labelFallback: '',
      locked: true,
      render: (row) => nameById.get(row.customerId) ?? tr('advances.unknownParty'),
    },
    {
      id: 'total',
      labelKey: 'advances.columns.total',
      labelFallback: '',
      align: 'end',
      showFrom: 'sm',
      render: (row) =>
        row.document ? (
          <Money minor={row.document.totalMinor} currency={row.currency ?? undefined} />
        ) : (
          '—'
        ),
      sortValue: (row) => row.document?.totalMinor ?? 0,
    },
    {
      id: 'amount',
      labelKey: 'advances.amount',
      labelFallback: '',
      align: 'end',
      render: (row) => <Money minor={row.amountMinor} currency={row.currency ?? undefined} />,
      sortValue: (row) => row.amountMinor,
    },
    {
      id: 'remaining',
      labelKey: 'advances.columns.remaining',
      labelFallback: '',
      align: 'end',
      render: (row) => <Money minor={row.remainingMinor} currency={row.currency ?? undefined} />,
      sortValue: (row) => row.remainingMinor,
    },
    {
      id: 'status',
      labelKey: 'advances.columns.status',
      labelFallback: '',
      render: (row) => (
        <Badge variant="outline">{tr(`customerDeposits.status.${row.status}`)}</Badge>
      ),
    },
    {
      id: 'note',
      labelKey: 'advances.columns.note',
      labelFallback: '',
      showFrom: 'md',
      render: (row) => row.note ?? '—',
    },
    {
      id: 'open',
      labelKey: 'advances.columns.action',
      labelFallback: '',
      locked: true,
      render: (row) => (
        <button
          type="button"
          className="text-xs underline underline-offset-2"
          onClick={() => push(`/customers/${row.customerId}`)}
        >
          {tr('advances.applyOnParty')}
        </button>
      ),
    },
  ]

  return (
    <div data-advances={kind} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {kind === 'pre_sale' ? tr('advances.preSaleHelp') : tr('advances.prePurchaseHelp')}
        </p>
        {focusId && onShowAll ? (
          <button
            type="button"
            onClick={onShowAll}
            className="text-xs font-medium text-[hsl(var(--color-primary))] underline underline-offset-2"
          >
            {tr('advances.showAll')}
          </button>
        ) : null}
      </div>
      {!focusId && (advances.data?.length ?? 0) > 0 ? <BentoStats t={tr} stats={stats} /> : null}
      {advances.isError ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {tr('advances.unread')}
        </p>
      ) : (
        <DataTable
          tableId={`invoices-advances-${kind}`}
          t={tr}
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          minWidthClass="min-w-[640px]"
          actions={
            <TableFilterMenu
              label={tr('common.filter')}
              clearLabel={tr('common.clearFilters')}
              groups={[
                {
                  id: 'status',
                  label: tr('advances.columns.status'),
                  value: status,
                  onChange: (value) => setStatus(value as typeof status),
                  options: [
                    { value: 'all', label: tr('invoices.filterAll') },
                    ...(
                      ['available', 'partially_used', 'fully_used', 'pending_posting'] as const
                    ).map((value) => ({ value, label: tr(`customerDeposits.status.${value}`) })),
                  ],
                },
              ]}
            />
          }
          emptyState={
            <p className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
              {advances.isLoading
                ? tr('advances.loading')
                : kind === 'pre_sale'
                  ? tr('advances.emptyPreSale')
                  : tr('advances.emptyPrePurchase')}
            </p>
          }
        />
      )}
    </div>
  )
}
