'use client'

// ============================================
// /invoices?tab=advances — «پیش‌فروش و پیش‌خرید».
//
// ONE table under one switch (preSale | prePurchase), from GET /advances.
// Each row says what is left of it — the server's count, the same one apply
// and refund are checked against. Applying an advance to its invoice, or
// giving it back, happens on the party's page in the deposits panel that
// already does it; this tab lists and creates.
// ============================================

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useAdvances, useCustomers, type CustomerDepositRecord } from '@hisabche/api'

import { useLocalePush } from '../../../../hooks/use-locale-push'
import { useDateFormat } from '../../../../hooks/use-date-format'
import { Badge } from '../../badge'
import { Button } from '../../button'
import { Money } from '../../capability/capability-kit'
import { DataTable } from '../../data-table'
import type { TableColumn } from '../../data-table/table-types'
import { useHubSection } from '../../hub-tabs'
import { SegmentedControl } from '../../segmented-control'

export const ADVANCE_SECTIONS = ['preSale', 'prePurchase'] as const

export function AdvancesContainer() {
  const t = useTranslations()
  const tr = (key: string, fallback?: string): string => {
    try {
      const value = t(key as never)
      return value === key ? (fallback ?? key) : value
    } catch {
      return fallback ?? key
    }
  }
  const push = useLocalePush()
  const dates = useDateFormat()
  const [section, selectSection] = useHubSection(ADVANCE_SECTIONS)
  const kind = section === 'prePurchase' ? 'pre_purchase' : 'pre_sale'
  const advances = useAdvances(kind)
  const parties = useCustomers({ page: 1, limit: 100, sortDirection: 'desc' })

  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const party of parties.data?.customers ?? [])
      if (party.id) map.set(party.id, party.fullName)
    return map
  }, [parties.data])

  const columns: TableColumn<CustomerDepositRecord>[] = [
    {
      id: 'date',
      labelKey: 'advances.columns.date',
      labelFallback: 'تاریخ',
      render: (row) => dates.date(row.createdAt),
      sortValue: (row) => row.createdAt,
    },
    {
      id: 'party',
      labelKey: kind === 'pre_sale' ? 'advances.customer' : 'advances.supplier',
      labelFallback: kind === 'pre_sale' ? 'مشتری' : 'تأمین‌کننده',
      locked: true,
      render: (row) =>
        nameById.get(row.customerId) ?? tr('advances.unknownParty', 'نام خوانده نشد'),
    },
    {
      id: 'amount',
      labelKey: 'advances.amount',
      labelFallback: 'مبلغ',
      align: 'end',
      render: (row) => <Money minor={row.amountMinor} currency={row.currency ?? undefined} />,
      sortValue: (row) => row.amountMinor,
    },
    {
      id: 'remaining',
      labelKey: 'advances.columns.remaining',
      labelFallback: 'باز',
      align: 'end',
      render: (row) => <Money minor={row.remainingMinor} currency={row.currency ?? undefined} />,
      sortValue: (row) => row.remainingMinor,
    },
    {
      id: 'status',
      labelKey: 'advances.columns.status',
      labelFallback: 'وضعیت',
      render: (row) => (
        <Badge variant="outline">{tr(`customerDeposits.status.${row.status}`, row.status)}</Badge>
      ),
    },
    {
      id: 'note',
      labelKey: 'advances.columns.note',
      labelFallback: 'شرح',
      showFrom: 'md',
      render: (row) => row.note ?? '—',
    },
    {
      id: 'open',
      labelKey: 'advances.columns.action',
      labelFallback: 'اقدام',
      locked: true,
      render: (row) => (
        <button
          type="button"
          className="text-xs underline underline-offset-2"
          onClick={() => push(`/customers/${row.customerId}`)}
        >
          {tr('advances.applyOnParty', 'اعمال / برگشت')}
        </button>
      ),
    },
  ]

  return (
    <div data-advances className="space-y-4">
      <SegmentedControl
        branch
        label={tr('advances.label', 'پیش‌فروش و پیش‌خرید')}
        options={ADVANCE_SECTIONS.map((value) => ({
          value,
          label: tr(`advances.sections.${value}`, value),
        }))}
        value={section}
        onChange={selectSection}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {kind === 'pre_sale'
            ? tr('advances.preSaleHelp', '')
            : tr('advances.prePurchaseHelp', '')}
        </p>
        <Button onClick={() => push(`/invoices/new?type=${kind}`)}>
          {kind === 'pre_sale'
            ? tr('advances.newPreSale', 'پیش‌فروش جدید')
            : tr('advances.newPrePurchase', 'پیش‌خرید جدید')}
        </Button>
      </div>
      {advances.isError ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {tr('advances.unread', 'فهرست خوانده نشد؛ این «خالی» نیست.')}
        </p>
      ) : (
        <DataTable
          tableId={`invoices-advances-${kind}`}
          t={tr}
          rows={advances.data ?? []}
          columns={columns}
          rowKey={(row) => row.id}
          minWidthClass="min-w-[640px]"
          emptyState={
            <p className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
              {advances.isLoading
                ? tr('advances.loading', 'در حال بارگذاری…')
                : kind === 'pre_sale'
                  ? tr('advances.emptyPreSale', 'هنوز پیش‌فروشی ثبت نشده است.')
                  : tr('advances.emptyPrePurchase', 'هنوز پیش‌خریدی ثبت نشده است.')}
            </p>
          }
        />
      )}
    </div>
  )
}
