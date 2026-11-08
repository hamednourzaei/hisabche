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

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useAdvances, useCustomers, type CustomerDepositRecord } from '@hisabche/api'

import { useLocalePush } from '../../../../hooks/use-locale-push'
import { useDateFormat } from '../../../../hooks/use-date-format'
import { Badge } from '../../badge'
import { Money } from '../../capability/capability-kit'
import { DataTable } from '../../data-table'
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
  const tr = (key: string): string => t(key as never)
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

  const rows = useMemo(() => {
    const list = advances.data ?? []
    return focusId ? list.filter((row) => row.id === focusId) : list
  }, [advances.data, focusId])

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
