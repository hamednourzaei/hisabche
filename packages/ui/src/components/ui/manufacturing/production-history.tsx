'use client'

// ============================================
// Production history — what was made, when, and what it cost THAT DAY.
//
// Reads the runs and their snapshot lines; never the current definition. A
// material that is dearer today does not change a row here.
//
// One component for the manufacturing page (every product) and a product's own
// page (`productId`). A page at a time: the history is not loaded whole.
// ============================================

import { useState } from 'react'
import { formatNumber } from '@hisabche/formatting'
import { apiErrorMessage, useProductionRun, useProductionRuns } from '@hisabche/api'

import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'
import { SearchableTable } from '../data-table'
import { unitText } from './unit-text'
import { manufacturingErrorText } from './manufacturing-errors'

type T = (key: string, fallback?: string) => string

const PAGE = 20

export function ProductionHistory({
  t,
  locale,
  productId,
}: {
  t: T
  locale: string
  /** Set on a product's page: only that product's runs, and no product column. */
  productId?: string | undefined
}) {
  const [offset, setOffset] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const { date } = useDateFormat()
  const runs = useProductionRuns({ productId: productId ?? null, limit: PAGE, offset })
  const money = (value: number) => formatNumber(value, locale, 4)

  if (runs.isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
        ))}
      </div>
    )
  }

  // A failed read is said as a failure — not shown as «nothing made yet».
  if (runs.error) {
    const message = apiErrorMessage(runs.error, '')
    return (
      <p role="alert" className="p-4 text-sm text-[hsl(var(--color-destructive))]">
        {manufacturingErrorText(
          t,
          message,
          t('manufacturing.history.failed', 'تاریخچه‌ی تولید خوانده نشد.'),
        )}
      </p>
    )
  }

  const rows = runs.data?.runs ?? []
  const total = runs.data?.total ?? 0

  if (rows.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
        {t('manufacturing.history.empty', 'هنوز تولیدی ثبت نشده است.')}
      </p>
    )
  }

  type Run = (typeof rows)[number]
  const productGone = t('manufacturing.history.productGone', 'کالا حذف شده')
  const open = openId ? rows.find((run) => run.id === openId) : undefined

  return (
    <div className="p-3 md:p-4">
      {/* One page from the server in the shared table; a row opens that run's
          snapshot under it. */}
      <SearchableTable<Run>
        tableId="manufacturing-history"
        rows={rows}
        rowKey={(run) => run.id}
        onRowClick={(run) => setOpenId((current) => (current === run.id ? null : run.id))}
        words={(run) => [run.productName ?? productGone, run.warehouseName ?? '']}
        empty={t('manufacturing.noMatch', 'چیزی با این فیلتر نیست')}
        columns={[
          {
            id: 'date',
            labelKey: 'manufacturing.history.date',
            labelFallback: 'تاریخ',
            sortValue: (run) => run.producedOn,
            render: (run) => (
              <span className="whitespace-nowrap">
                {run.producedOn ? date(run.producedOn) : '—'}
              </span>
            ),
          },
          // On a product's own page every row is that product.
          ...(productId
            ? []
            : [
                {
                  id: 'product',
                  labelKey: 'manufacturing.history.product',
                  labelFallback: 'محصول',
                  locked: true,
                  sortValue: (run: Run) => run.productName ?? '',
                  render: (run: Run) => (
                    <span className="font-medium">{run.productName ?? productGone}</span>
                  ),
                },
              ]),
          {
            id: 'quantity',
            labelKey: 'manufacturing.history.quantity',
            labelFallback: 'تعداد',
            align: 'end',
            sortValue: (run) => run.quantity,
            render: (run) => (
              <span className="tabular-nums">{formatNumber(run.quantity, locale, 4)}</span>
            ),
          },
          {
            id: 'unitCost',
            labelKey: 'manufacturing.history.unitCost',
            labelFallback: 'بهای هر واحد',
            align: 'end',
            showFrom: 'md',
            sortValue: (run) => (run.quantity > 0 ? run.totalCost / run.quantity : 0),
            render: (run) => (
              <span className="tabular-nums">
                {money(run.quantity > 0 ? run.totalCost / run.quantity : 0)}
              </span>
            ),
          },
          {
            id: 'total',
            labelKey: 'manufacturing.history.total',
            labelFallback: 'جمع',
            align: 'end',
            sortValue: (run) => run.totalCost,
            render: (run) => (
              <span className="tabular-nums">
                {money(run.totalCost)}{' '}
                <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {run.currency ? t(`currency.${run.currency.toLowerCase()}`, run.currency) : ''}
                </span>
                {run.overrideTotal !== null ? (
                  <span className="ms-1 rounded-full bg-[hsl(var(--color-warning)/0.15)] px-1.5 py-0.5 text-[10px] text-[hsl(var(--fg-primary))]">
                    {t('manufacturing.history.overridden', 'دستی')}
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            id: 'warehouse',
            labelKey: 'manufacturing.history.warehouse',
            labelFallback: 'انبار',
            showFrom: 'md',
            render: (run) =>
              run.addToInventory
                ? (run.warehouseName ?? t('manufacturing.history.noWarehouse', 'بدون انبار'))
                : t('manufacturing.history.notStocked', 'به انبار نرفته'),
          },
        ]}
      />

      {open ? (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.4)] p-3">
          <RunDetail t={t} locale={locale} id={open.id} />
        </div>
      ) : null}

      {total > PAGE ? (
        <div className="flex items-center justify-between gap-2 p-3 text-xs text-[hsl(var(--fg-secondary))]">
          <span>
            {formatNumber(offset + 1, locale, 0)}–
            {formatNumber(Math.min(offset + PAGE, total), locale, 0)} /{' '}
            {formatNumber(total, locale, 0)}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE))}
            >
              {t('manufacturing.history.previous', 'قبلی')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset + PAGE >= total}
              onClick={() => setOffset(offset + PAGE)}
            >
              {t('manufacturing.history.next', 'بعدی')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** One run's snapshot: what it was made of and what each part cost, that day. */
function RunDetail({ t, locale, id }: { t: T; locale: string; id: string }) {
  const run = useProductionRun(id)
  const money = (value: number) => formatNumber(value, locale, 4)

  if (run.isLoading) {
    return <div className="h-10 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
  }
  if (run.error || !run.data) {
    return (
      <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
        {t('manufacturing.history.detailFailed', 'جزئیات این تولید خوانده نشد.')}
      </p>
    )
  }

  const data = run.data
  const kindLabel = (kind: string, label: string) =>
    kind === 'labor'
      ? t('manufacturing.editor.laborCostRow', 'دستمزد')
      : label || t('manufacturing.history.unnamed', 'بدون نام')

  return (
    <div className="space-y-2 text-xs">
      <ul className="space-y-1">
        {data.lines.map((line) => (
          <li key={line.id} className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[hsl(var(--fg-primary))]">
              {kindLabel(line.kind, line.label)}
              {line.kind === 'component' ? (
                <span className="ms-2 text-[hsl(var(--fg-tertiary))]">
                  {formatNumber(line.quantity, locale, 4)} {unitText(t, line.unit)} ×{' '}
                  {money(line.unitCost)}
                </span>
              ) : null}
            </span>
            <span className="tabular-nums text-[hsl(var(--fg-primary))]">
              {money(line.total)}
              {line.actualCost !== null && Math.abs(line.actualCost - line.total) > 0.00005 ? (
                <span className="ms-2 text-[hsl(var(--fg-tertiary))]">
                  ({t('manufacturing.history.actual', 'بهای واقعی انبار')}: {money(line.actualCost)}
                  {line.isEstimated ? ` — ${t('manufacturing.history.estimated', 'تخمینی')}` : ''})
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-[hsl(var(--border-default))] pt-2 text-[hsl(var(--fg-secondary))] md:grid-cols-4">
        {data.bomVersion !== null ? (
          <div>
            <dt className="inline">{t('manufacturing.history.version', 'نسخه‌ی فرمول')}: </dt>
            <dd className="inline">{formatNumber(data.bomVersion, locale, 0)}</dd>
          </div>
        ) : null}
        {data.laborWorkers !== null ? (
          <div>
            <dt className="inline">{t('manufacturing.editor.workers', 'تعداد نفر')}: </dt>
            <dd className="inline">{formatNumber(data.laborWorkers, locale, 2)}</dd>
          </div>
        ) : null}
        {data.laborMinutes !== null ? (
          <div>
            <dt className="inline">{t('manufacturing.editor.hours', 'مدت ساخت (ساعت)')}: </dt>
            <dd className="inline">{formatNumber(data.laborMinutes / 60, locale, 2)}</dd>
          </div>
        ) : null}
        {data.overrideTotal !== null ? (
          <div className="col-span-2 md:col-span-4">
            <dt className="inline">{t('manufacturing.history.overrideNote', 'جمع دستی')}: </dt>
            <dd className="inline">
              {money(data.calculatedTotal)} {t('manufacturing.arrow', '←')}{' '}
              {money(data.overrideTotal)}
              {data.overrideReason ? ` — ${data.overrideReason}` : ''}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}
