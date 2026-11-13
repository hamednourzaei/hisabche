'use client'

// ============================================
// Profit by project and branch — V60 Slice 8 had the route and the hook
// (`GET /accounting/profit-report/cost-objects`, `useCostObjectProfitReport`) and no screen
// (12 Nov 2026 audit). It sits under the per-product profit, in the currency picked there,
// and only reads: every figure comes from `buildCostObjectProfitReport` on the server.
//
// Net profit is not shown as a number: no overhead rule exists, so it is unknown — the server
// returns null and this says why. Sales that name no project or branch are counted under the
// table, so the rows are never read as the whole business.
// ============================================

import { useCostObjectProfitReport } from '@hisabche/api'
import type { CostObjectProfitRow } from '@hisabche/validation'
import { DataTable, type TableColumn } from '../../data-table'
import { EmptyState } from '../../empty-state'
import { QueryState, useTableLabel } from '../../erp-core/erp-shared'

export interface CostObjectProfitSectionProps {
  from: string
  to: string
  currency: string
  money: (value: number) => string
  t: (key: string, fallback?: string) => string
}

export function CostObjectProfitSection({
  from,
  to,
  currency,
  money,
  t,
}: CostObjectProfitSectionProps) {
  const label = useTableLabel()
  const report = useCostObjectProfitReport(from, to, currency)
  const tr = (key: string) => t(`accounting.costObjects.${key}`)
  const unknown = tr('unknown')

  const columns: TableColumn<CostObjectProfitRow>[] = [
    {
      id: 'name',
      labelKey: 'accounting.costObjects.columns.name',
      labelFallback: 'پروژه / شعبه',
      locked: true,
      render: (row) => `${row.label} · ${tr(`types.${row.costObjectType}`)}`,
    },
    {
      id: 'invoices',
      labelKey: 'accounting.costObjects.columns.invoices',
      labelFallback: 'فاکتورها',
      render: (row) => row.invoiceCount,
      sortValue: (row) => row.invoiceCount,
    },
    {
      id: 'revenue',
      labelKey: 'accounting.costObjects.columns.revenue',
      labelFallback: 'فروش',
      render: (row) => money(row.revenue),
      sortValue: (row) => row.revenue,
    },
    {
      id: 'cost',
      labelKey: 'accounting.costObjects.columns.cost',
      labelFallback: 'بهای تمام‌شده',
      // A cost the books do not know is not a cost of 0.
      render: (row) => (row.grossProfit === null ? unknown : money(row.cost)),
    },
    {
      id: 'grossProfit',
      labelKey: 'accounting.costObjects.columns.grossProfit',
      labelFallback: 'سود ناخالص',
      render: (row) => (row.grossProfit === null ? unknown : money(row.grossProfit)),
      sortValue: (row) => row.grossProfit ?? Number.NEGATIVE_INFINITY,
    },
    {
      id: 'grossMargin',
      labelKey: 'accounting.costObjects.columns.grossMargin',
      labelFallback: 'حاشیه ناخالص',
      render: (row) => (row.grossMarginPercent === null ? unknown : `${row.grossMarginPercent}%`),
    },
  ]

  const view = report.data
  return (
    <section
      data-cost-object-profit=""
      className="space-y-3 rounded-xl border border-[hsl(var(--border-default))] p-4"
    >
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{tr('title')}</h4>
        <p className="text-xs text-[hsl(var(--fg-secondary))]">{tr('intro')}</p>
      </div>
      <QueryState
        isLoading={report.isLoading}
        isError={report.isError}
        onRetry={() => void report.refetch()}
        loadingText={tr('loading')}
        errorText={tr('loadFailed')}
        retryText={tr('retry')}
      >
        <DataTable
          tableId="accounting-cost-object-profit"
          t={label}
          rows={view?.rows ?? []}
          columns={columns}
          rowKey={(row) => `${row.costObjectType}:${row.costObjectId}`}
          emptyState={<EmptyState title={tr('emptyTitle')} description={tr('emptyDescription')} />}
        />
      </QueryState>
      {view && view.overheadPolicyStatus === 'not_allocated' ? (
        <p role="note" className="text-xs text-[hsl(var(--fg-secondary))]">
          {tr('overheadNotAllocated')}
        </p>
      ) : null}
      {view && view.untagged.invoiceCount > 0 ? (
        <p className="text-xs text-[hsl(var(--fg-secondary))]">
          {tr('untagged')}: {view.untagged.invoiceCount} {tr('invoicesUnit')} ·{' '}
          {money(view.untagged.revenue)}
        </p>
      ) : null}
    </section>
  )
}
