'use client'

// ============================================
// The manufacturing report: over a period, what was made, what it cost, which
// materials were used most, and which got dearer or cheaper.
//
// Every figure is aggregated by the database from the production SNAPSHOTS
// (`manufacturing_report`). «Previous» and «current» cost are what was
// recorded on those days — never today's product price read backwards.
// ============================================

import { useMemo, useState } from 'react'
import { SearchableTable } from '../data-table'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { formatNumber, toIsoDay } from '@hisabche/formatting'
import { presetRange } from '@hisabche/ui-contract'
import { apiErrorMessage, useManufacturingReport, type ManufacturingReport } from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { DateRangePicker, type DateRange } from '../dashboard/date-range-picker'
import { unitText } from './unit-text'
import { manufacturingErrorText } from './manufacturing-errors'

type T = (key: string, fallback?: string) => string
type Material = ManufacturingReport['materials'][number]

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'

/** The direction of a cost change, said with a word as well as a colour. */
function Change({ t, locale, row }: { t: T; locale: string; row: Material }) {
  if (row.changePercent === null) {
    return (
      <span className="text-xs text-[hsl(var(--fg-tertiary))]">
        {t('manufacturing.report.noEarlier', 'بدون سابقه')}
      </span>
    )
  }
  if (row.change === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--fg-secondary))]">
        <Minus className="size-3.5" aria-hidden="true" />
        {t('manufacturing.report.unchanged', 'بدون تغییر')}
      </span>
    )
  }
  const up = row.change > 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        up ? 'text-[hsl(var(--color-destructive))]' : 'text-[hsl(var(--color-success))]',
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {up
        ? t('manufacturing.report.dearer', 'گران‌تر')
        : t('manufacturing.report.cheaper', 'ارزان‌تر')}{' '}
      {formatNumber(Math.abs(row.changePercent), locale, 2)}٪
    </span>
  )
}

export function ManufacturingReportView({
  t,
  locale,
  productId,
}: {
  t: T
  locale: string
  productId?: string | undefined
}) {
  const [range, setRange] = useState<DateRange>(() => presetRange('30days'))
  const from = toIsoDay(range.from)
  const to = toIsoDay(range.to)
  const report = useManufacturingReport({ from, to, productId: productId ?? null })
  const money = (value: number) => formatNumber(value, locale, 4)

  const data = report.data
  const movers = useMemo(() => {
    const changed = (data?.materials ?? []).filter(
      (row) => row.changePercent !== null && row.change !== 0,
    )
    return {
      dearer: [...changed]
        .filter((row) => row.change > 0)
        .sort((a, b) => b.change * b.quantity - a.change * a.quantity),
      cheaper: [...changed]
        .filter((row) => row.change < 0)
        .sort((a, b) => a.change * a.quantity - b.change * b.quantity),
    }
  }, [data])

  const message = report.error ? apiErrorMessage(report.error, '') : ''

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('manufacturing.report.title', 'گزارش تولید')}
        </h2>
        <DateRangePicker value={range} onChange={(next) => setRange(next)} t={t} />
      </div>

      {report.isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl bg-[hsl(var(--surface-muted))]"
            />
          ))}
        </div>
      ) : report.error || !data ? (
        // A failed report is a failure. It is not «nothing was produced».
        <p role="alert" className={cn(card, 'p-4 text-sm text-[hsl(var(--color-destructive))]')}>
          {manufacturingErrorText(
            t,
            message,
            t('manufacturing.report.failed', 'گزارش تولید ساخته نشد.'),
          )}
        </p>
      ) : data.totals.runs === 0 ? (
        <p className={cn(card, 'p-6 text-center text-sm text-[hsl(var(--fg-secondary))]')}>
          {t('manufacturing.report.empty', 'در این بازه تولیدی ثبت نشده است.')}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label={t('manufacturing.report.runs', 'دفعات تولید')}
              value={formatNumber(data.totals.runs, locale, 0)}
            />
            <Stat
              label={t('manufacturing.report.quantity', 'تعداد ساخته‌شده')}
              value={formatNumber(data.totals.quantity, locale, 4)}
            />
            <Stat
              label={t('manufacturing.report.totalCost', 'بهای کل تولید')}
              value={money(data.totals.totalCost)}
            />
            <Stat
              label={t('manufacturing.report.averageUnit', 'میانگین بهای هر واحد')}
              value={money(
                data.totals.quantity > 0 ? data.totals.totalCost / data.totals.quantity : 0,
              )}
            />
            <Stat
              label={t('manufacturing.report.materials', 'قطعات و مواد')}
              value={money(data.totals.componentsCost)}
            />
            <Stat
              label={t('manufacturing.report.labor', 'دستمزد')}
              value={money(data.totals.laborCost)}
            />
            <Stat
              label={t('manufacturing.report.other', 'هزینه‌های دیگر')}
              value={money(data.totals.otherCost)}
            />
            <Stat
              label={t('manufacturing.report.hours', 'ساعت کار')}
              value={formatNumber(data.totals.laborMinutes / 60, locale, 2)}
            />
          </dl>

          {movers.dearer.length > 0 || movers.cheaper.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <MoverList
                t={t}
                locale={locale}
                title={t('manufacturing.report.dearerTitle', 'گران‌تر شده‌اند')}
                rows={movers.dearer.slice(0, 5)}
              />
              <MoverList
                t={t}
                locale={locale}
                title={t('manufacturing.report.cheaperTitle', 'ارزان‌تر شده‌اند')}
                rows={movers.cheaper.slice(0, 5)}
              />
            </div>
          ) : null}

          <section className={cn(card, 'overflow-hidden')}>
            <h3 className="px-4 pt-4 text-sm font-semibold text-[hsl(var(--fg-primary))]">
              {t('manufacturing.report.consumption', 'مصرف مواد')}
            </h3>
            <p className="px-4 pb-2 text-xs text-[hsl(var(--fg-tertiary))]">
              {t(
                'manufacturing.report.consumptionHint',
                'به ترتیب ارزش مصرف. بهای قبلی و فعلی همان است که روز تولید ثبت شده.',
              )}
            </p>
            <div className="px-3 pb-3">
              <SearchableTable
                tableId="manufacturing-report-materials"
                rows={data.materials}
                rowKey={(row) => row.key}
                words={(row) => [row.name]}
                empty={t('manufacturing.noMatch', 'چیزی با این فیلتر نیست')}
                columns={[
                  {
                    id: 'material',
                    labelKey: 'manufacturing.report.material',
                    labelFallback: 'ماده / قطعه',
                    locked: true,
                    sortValue: (row) => row.name,
                    render: (row) => (
                      <span className="font-medium">
                        {row.name || t('manufacturing.history.unnamed', 'بدون نام')}
                      </span>
                    ),
                  },
                  {
                    id: 'used',
                    labelKey: 'manufacturing.report.used',
                    labelFallback: 'مقدار مصرف',
                    align: 'end',
                    sortValue: (row) => row.quantity,
                    render: (row) => (
                      <span className="tabular-nums">
                        {formatNumber(row.quantity, locale, 4)} {unitText(t, row.unit)}
                      </span>
                    ),
                  },
                  {
                    id: 'value',
                    labelKey: 'manufacturing.report.value',
                    labelFallback: 'ارزش مصرف',
                    align: 'end',
                    sortValue: (row) => row.value,
                    render: (row) => <span className="tabular-nums">{money(row.value)}</span>,
                  },
                  {
                    id: 'previous',
                    labelKey: 'manufacturing.report.previous',
                    labelFallback: 'بهای قبلی',
                    align: 'end',
                    showFrom: 'md',
                    sortValue: (row) => row.previousCost,
                    render: (row) => (
                      <span className="tabular-nums">
                        {row.changePercent === null && row.previousCost === row.currentCost
                          ? '—'
                          : money(row.previousCost)}
                      </span>
                    ),
                  },
                  {
                    id: 'current',
                    labelKey: 'manufacturing.report.current',
                    labelFallback: 'بهای فعلی',
                    align: 'end',
                    sortValue: (row) => row.currentCost,
                    render: (row) => <span className="tabular-nums">{money(row.currentCost)}</span>,
                  },
                  {
                    id: 'change',
                    labelKey: 'manufacturing.report.change',
                    labelFallback: 'تغییر',
                    sortValue: (row) => row.changePercent,
                    render: (row) => <Change t={t} locale={locale} row={row} />,
                  },
                  {
                    id: 'usedIn',
                    labelKey: 'manufacturing.report.usedIn',
                    labelFallback: 'در چند محصول',
                    align: 'end',
                    showFrom: 'md',
                    sortValue: (row) => row.products,
                    render: (row) => (
                      <span className="tabular-nums">{formatNumber(row.products, locale, 0)}</span>
                    ),
                  },
                ]}
              />
            </div>
          </section>

          {productId ? null : (
            <section className={cn(card, 'overflow-hidden')}>
              <h3 className="px-4 py-4 text-sm font-semibold text-[hsl(var(--fg-primary))]">
                {t('manufacturing.report.byProduct', 'به تفکیک محصول')}
              </h3>
              <div className="px-3 pb-3">
                <SearchableTable
                  tableId="manufacturing-report-products"
                  rows={data.products}
                  rowKey={(row) => row.productId}
                  words={(row) => [row.name]}
                  empty={t('manufacturing.noMatch', 'چیزی با این فیلتر نیست')}
                  columns={[
                    {
                      id: 'product',
                      labelKey: 'manufacturing.history.product',
                      labelFallback: 'محصول',
                      locked: true,
                      sortValue: (row) => row.name,
                      render: (row) => (
                        <span className="font-medium">
                          {row.name || t('manufacturing.history.productGone', 'کالا حذف شده')}
                        </span>
                      ),
                    },
                    {
                      id: 'quantity',
                      labelKey: 'manufacturing.report.quantity',
                      labelFallback: 'تعداد ساخته‌شده',
                      align: 'end',
                      sortValue: (row) => row.quantity,
                      render: (row) => (
                        <span className="tabular-nums">
                          {formatNumber(row.quantity, locale, 4)}
                        </span>
                      ),
                    },
                    {
                      id: 'totalCost',
                      labelKey: 'manufacturing.report.totalCost',
                      labelFallback: 'بهای کل تولید',
                      align: 'end',
                      sortValue: (row) => row.totalCost,
                      render: (row) => <span className="tabular-nums">{money(row.totalCost)}</span>,
                    },
                    {
                      id: 'firstUnit',
                      labelKey: 'manufacturing.report.firstUnit',
                      labelFallback: 'بهای واحد، اولین تولید',
                      align: 'end',
                      showFrom: 'md',
                      sortValue: (row) => row.firstUnitCost,
                      render: (row) => (
                        <span className="tabular-nums">{money(row.firstUnitCost)}</span>
                      ),
                    },
                    {
                      id: 'lastUnit',
                      labelKey: 'manufacturing.report.lastUnit',
                      labelFallback: 'بهای واحد، آخرین تولید',
                      align: 'end',
                      sortValue: (row) => row.lastUnitCost,
                      render: (row) => (
                        <span className="tabular-nums">{money(row.lastUnitCost)}</span>
                      ),
                    },
                  ]}
                />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(card, 'p-3')}>
      <dt className="text-xs text-[hsl(var(--fg-secondary))]">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
        {value}
      </dd>
    </div>
  )
}

function MoverList({
  t,
  locale,
  title,
  rows,
}: {
  t: T
  locale: string
  title: string
  rows: Material[]
}) {
  return (
    <section className={cn(card, 'p-4')}>
      <h3 className="mb-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t('manufacturing.report.noMovers', 'موردی نیست.')}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.key} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-[hsl(var(--fg-primary))]">
                {row.name || t('manufacturing.history.unnamed', 'بدون نام')}
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
                  {formatNumber(row.previousCost, locale, 4)} {t('manufacturing.arrow', '←')}{' '}
                  {formatNumber(row.currentCost, locale, 4)}
                </span>
                <Change t={t} locale={locale} row={row} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
