'use client'

// ============================================
// Request #91 — profit and loss per product, on the «سود و زیان» tab.
//
// Everything is computed by the accounting core (GET /accounting/profit-report):
// net sales per product (invoice discount shared out, tax excluded), cost from
// the costing core, gross payroll, net profit. This table only shows it — the
// same shared DataTable the warehouse uses — with the totals under the columns.
//
//   product row  → /till (the cash transactions behind the sales)
//   salaries row → /team-and-payroll (the payroll behind the figure)
// ============================================

import { memo, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { ProductProfitRow, ProfitReport } from '@hisabche/api'

import { cn } from '../../../../lib/utils'
import { DataTable, matchesSearch, type TableColumn } from '../../data-table'
import { EmptyState } from '../../empty-state'
import { useLocalePush } from '../../../../hooks/use-locale-push'

type T = (key: string, fallback?: string) => string

export const ProductProfitTable = memo(function ProductProfitTable({
  t,
  report,
  money,
  num,
}: {
  t: T
  report: ProfitReport
  /** Formats an amount in the report currency. */
  money: (value: number) => string
  num: (value: number) => string
}) {
  const push = useLocalePush()
  const [search, setSearch] = useState('')

  const percent = (value: number | null) => (value === null ? '—' : `${num(value)}٪`)
  const tone = (value: number) =>
    value < 0 ? 'text-[hsl(var(--color-destructive))]' : 'text-[hsl(var(--color-success))]'

  const rows = useMemo(
    () => report.products.filter((row) => matchesSearch(search, [row.name])),
    [report.products, search],
  )

  const columns = useMemo<TableColumn<ProductProfitRow>[]>(
    () => [
      {
        id: 'name',
        labelKey: 'accounting.profit.colProduct',
        labelFallback: 'کالا',
        locked: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <span className="flex items-center gap-1.5 font-medium text-[hsl(var(--fg-primary))]">
            {row.name}
            {row.costMissing || row.costEstimated ? (
              <AlertTriangle
                className="size-3.5 text-[hsl(var(--color-warning))]"
                aria-label={
                  row.costMissing
                    ? t(
                        'accounting.profit.costMissing',
                        'بهای تمام‌شده ثبت نشده؛ سود بیشتر از واقع است',
                      )
                    : t('accounting.profit.costEstimated', 'بخشی از بها تخمینی است')
                }
              />
            ) : null}
          </span>
        ),
      },
      {
        id: 'quantity',
        labelKey: 'accounting.profit.colQuantity',
        labelFallback: 'تعداد فروش',
        align: 'end',
        showFrom: 'md',
        sortValue: (row) => row.quantity,
        render: (row) => <span className="tabular-nums">{num(row.quantity)}</span>,
      },
      {
        id: 'revenue',
        labelKey: 'accounting.profit.colRevenue',
        labelFallback: 'فروش خالص',
        align: 'end',
        sortValue: (row) => row.revenue,
        render: (row) => <span className="tabular-nums">{money(row.revenue)}</span>,
      },
      {
        id: 'cost',
        labelKey: 'accounting.profit.colCost',
        labelFallback: 'بهای تمام‌شده',
        align: 'end',
        showFrom: 'md',
        sortValue: (row) => row.cost,
        render: (row) => <span className="tabular-nums">{money(row.cost)}</span>,
      },
      {
        id: 'profit',
        labelKey: 'accounting.profit.colProfit',
        labelFallback: 'سود / زیان',
        align: 'end',
        sortValue: (row) => row.profit,
        render: (row) => (
          <span className={cn('font-medium tabular-nums', tone(row.profit))}>
            {money(row.profit)}
          </span>
        ),
      },
      {
        id: 'margin',
        labelKey: 'accounting.profit.colMargin',
        labelFallback: 'درصد سود',
        align: 'end',
        sortValue: (row) => row.marginPercent ?? -Infinity,
        render: (row) => (
          <span className={cn('tabular-nums', tone(row.profit))} dir="ltr">
            {percent(row.marginPercent)}
          </span>
        ),
      },
    ],
    [money, num, t],
  )

  const { totals } = report
  const footerRow = (
    label: string,
    value: string,
    extra?: string,
    onClick?: () => void,
    valueTone?: string,
  ) => (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-2.5 text-sm',
        onClick && 'cursor-pointer hover:bg-[hsl(var(--surface-muted)/0.5)]',
      )}
      {...(onClick
        ? {
            role: 'link',
            tabIndex: 0,
            onClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter') onClick()
            },
          }
        : {})}
    >
      <span
        className={cn(
          'text-[hsl(var(--fg-secondary))]',
          onClick && 'text-[hsl(var(--color-primary))] underline-offset-2 hover:underline',
        )}
      >
        {label}
      </span>
      <span className="flex items-center gap-3">
        {extra ? (
          <span className="text-xs tabular-nums text-[hsl(var(--fg-tertiary))]" dir="ltr">
            {extra}
          </span>
        ) : null}
        <span
          className={cn('font-semibold tabular-nums', valueTone ?? 'text-[hsl(var(--fg-primary))]')}
        >
          {value}
        </span>
      </span>
    </div>
  )

  return (
    <section className="space-y-3">
      <DataTable
        tableId="accounting-product-profit"
        t={t}
        rows={rows}
        columns={columns}
        rowKey={(row) => row.productId ?? `name:${row.name}`}
        onRowClick={() => push('/till')}
        searchValue={search}
        onSearchChange={setSearch}
        minWidthClass="min-w-[520px]"
        emptyState={
          <EmptyState
            icon="search"
            title={t('accounting.profit.empty', 'در این بازه فروشی ثبت نشده')}
          />
        }
      />

      {/* Totals under the columns: the arithmetic from sales to net profit. */}
      <div className="divide-y divide-[hsl(var(--border-default)/0.6)] overflow-hidden rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
        {footerRow(
          t('accounting.profit.totalRevenue', 'جمع فروش خالص'),
          money(totals.revenue),
          `${num(totals.invoiceCount)} ${t('accounting.profit.invoices', 'فاکتور')}`,
          () => push('/till'),
        )}
        {footerRow(t('accounting.profit.totalCost', 'جمع بهای تمام‌شده'), money(totals.cost))}
        {footerRow(
          t('accounting.profit.grossProfit', 'سود ناخالص'),
          money(totals.grossProfit),
          undefined,
          undefined,
          tone(totals.grossProfit),
        )}
        {footerRow(
          t('accounting.profit.salaries', 'حقوق کارمندان'),
          money(totals.salaries),
          `${num(totals.payrollCount)} ${t('accounting.profit.payrolls', 'فیش حقوق')}`,
          () => push('/team-and-payroll'),
        )}
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 px-4 py-3',
            totals.netProfit < 0
              ? 'bg-[hsl(var(--color-destructive)/0.06)]'
              : 'bg-[hsl(var(--color-success)/0.06)]',
          )}
        >
          <span className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t('accounting.profit.netProfit', 'سود خالص')}
          </span>
          <span className="flex items-center gap-4">
            <span
              className={cn('text-sm font-semibold tabular-nums', tone(totals.netProfit))}
              dir="ltr"
            >
              {percent(totals.netMarginPercent)}
            </span>
            <span className={cn('text-xl font-bold tabular-nums', tone(totals.netProfit))}>
              {money(totals.netProfit)}
            </span>
          </span>
        </div>
      </div>

      {report.otherCurrencies.length > 0 ? (
        <p className="text-xs text-[hsl(var(--color-warning))]">
          {t('accounting.profit.otherCurrencies', 'اسناد با ارز دیگر در این جمع نیستند')}:{' '}
          {report.otherCurrencies
            .map(
              (other) =>
                `${other.currency} (${num(other.invoices)} ${t('accounting.profit.invoices', 'فاکتور')}، ${num(other.payrolls)} ${t('accounting.profit.payrolls', 'فیش حقوق')})`,
            )
            .join(' · ')}
        </p>
      ) : null}
    </section>
  )
})

ProductProfitTable.displayName = 'ProductProfitTable'
