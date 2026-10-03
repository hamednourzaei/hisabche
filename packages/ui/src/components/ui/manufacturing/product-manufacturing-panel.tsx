'use client'

// ============================================
// «Manufacturing» on a product's own page: what the product is made of, what
// one unit costs, and every time it was made.
//
// The same panel for every product. It reads through the same hooks the
// manufacturing page uses and edits through the same `ProductionEditor`, so
// the two places cannot disagree about a cost — there is nothing here that
// computes one.
// ============================================

import { useState } from 'react'
import { Factory } from 'lucide-react'
import { formatNumber } from '@hisabche/formatting'
import { apiErrorMessage, useProductionDefinition } from '@hisabche/api'
import { COLUMN, parseCellNumber } from '@hisabche/validation'

import { cn } from '../../../lib/utils'
import { Button } from '../button'
import { ProductionEditor } from './production-editor'
import { ProductionHistory } from './production-history'
import { unitText } from './unit-text'
import { manufacturingErrorText } from './manufacturing-errors'

type T = (key: string, fallback?: string) => string

export function ProductManufacturingPanel({
  t,
  locale,
  productId,
  productName,
}: {
  t: T
  locale: string
  productId: string
  productName: string
}) {
  const [editing, setEditing] = useState<'produce' | 'definition' | null>(null)
  const definition = useProductionDefinition(productId)
  const money = (value: number) => formatNumber(value, locale, 4)

  if (editing) {
    return (
      <section className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] py-4">
        <ProductionEditor
          t={t}
          locale={locale}
          mode={editing}
          product={{ productId, productName }}
          onDone={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      </section>
    )
  }

  const data = definition.data
  const currencyName = data?.currency
    ? t(`currency.${data.currency.toLowerCase()}`, data.currency)
    : ''
  const failure = definition.error ? apiErrorMessage(definition.error, '') : ''

  return (
    <section className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <header className="flex flex-wrap items-center justify-between gap-2 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          <Factory className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('manufacturing.panel.title', 'ساخت و تولید')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing('definition')}
          >
            {data
              ? t('manufacturing.panel.edit', 'ویرایش فرمول')
              : t('manufacturing.panel.define', 'تعریف فرمول ساخت')}
          </Button>
          <Button type="button" size="sm" onClick={() => setEditing('produce')}>
            {t('manufacturing.panel.produce', 'ثبت تولید')}
          </Button>
        </div>
      </header>

      {definition.isLoading ? (
        <div className="mx-4 mb-4 h-16 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
      ) : definition.error ? (
        <p role="alert" className="px-4 pb-4 text-sm text-[hsl(var(--color-destructive))]">
          {manufacturingErrorText(
            t,
            failure,
            t('manufacturing.panel.failed', 'فرمول ساخت خوانده نشد.'),
          )}
        </p>
      ) : !data ? (
        // «Not a manufactured product (yet)» — said plainly, with the way in.
        <p className="px-4 pb-4 text-sm text-[hsl(var(--fg-secondary))]">
          {t(
            'manufacturing.panel.none',
            'برای این کالا فرمول ساختی تعریف نشده است. اگر این کالا را خودتان می‌سازید، قطعات و هزینه‌هایش را تعریف کنید.',
          )}
        </p>
      ) : (
        <div className="px-4 pb-4">
          <ul className="divide-y divide-[hsl(var(--border-default))] text-sm">
            {data.rows.map((row) => {
              const current = row.productId ? data.currentCosts[row.productId] : undefined
              const saved = parseCellNumber(row.values[COLUMN.unitPrice])
              const drifted =
                current !== undefined && current > 0 && Math.abs(current - saved) > 0.00005
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                >
                  <span className="text-[hsl(var(--fg-primary))]">
                    {row.values[COLUMN.description] ||
                      t('manufacturing.history.unnamed', 'بدون نام')}
                    <span className="ms-2 text-xs text-[hsl(var(--fg-tertiary))]">
                      {row.values[COLUMN.quantity] || '1'} {unitText(t, row.values[COLUMN.unit])}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-[hsl(var(--fg-secondary))]">
                    {t('manufacturing.editor.columns.unitCost', 'بهای واحد')}: {money(saved)}
                    {drifted ? (
                      <span className="ms-2 rounded-full bg-[hsl(var(--color-warning)/0.15)] px-1.5 py-0.5 text-[hsl(var(--fg-primary))]">
                        {t('manufacturing.panel.nowCosts', 'بهای خرید فعلی')}: {money(current)}
                      </span>
                    ) : null}
                  </span>
                </li>
              )
            })}
            {data.otherCosts.map((entry, index) => (
              <li key={`cost-${index}`} className="flex items-baseline justify-between gap-2 py-2">
                <span className="text-[hsl(var(--fg-primary))]">
                  {entry.label || t('manufacturing.editor.otherCostRow', 'هزینه‌های دیگر')}
                </span>
                <span className="text-xs tabular-nums text-[hsl(var(--fg-secondary))]">
                  {money(entry.amount)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <Figure
              label={t('manufacturing.editor.componentsCost', 'قطعات و مواد')}
              value={money(data.cost.componentsCost)}
            />
            <Figure
              label={t('manufacturing.editor.laborCostRow', 'دستمزد')}
              value={money(data.cost.laborCost)}
            />
            <Figure
              label={t('manufacturing.editor.otherCostRow', 'هزینه‌های دیگر')}
              value={money(data.cost.otherCost)}
            />
            <Figure
              strong
              label={`${t('manufacturing.editor.unitCost', 'بهای یک واحد')}${currencyName ? ` (${currencyName})` : ''}`}
              value={money(data.cost.unitCost)}
            />
          </dl>
          <p className="mt-2 text-xs text-[hsl(var(--fg-tertiary))]">
            {t('manufacturing.editor.loadedVersion', 'فرمول ذخیره‌شده، نسخه')}{' '}
            {formatNumber(data.version, locale, 0)}
            {data.labor.workers !== null || data.labor.minutes !== null
              ? ` — ${t('manufacturing.editor.workers', 'تعداد نفر')}: ${formatNumber(data.labor.workers ?? 0, locale, 2)}، ${t('manufacturing.editor.hours', 'مدت ساخت (ساعت)')}: ${formatNumber((data.labor.minutes ?? 0) / 60, locale, 2)}`
              : ''}
          </p>
        </div>
      )}

      <div className="border-t border-[hsl(var(--border-default))]">
        <h3 className="px-4 pt-3 text-xs font-medium text-[hsl(var(--fg-secondary))]">
          {t('manufacturing.panel.history', 'تاریخچه‌ی تولید این کالا')}
        </h3>
        <ProductionHistory t={t} locale={locale} productId={productId} />
      </div>
    </section>
  )
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl bg-[hsl(var(--surface-muted))] p-2.5',
        strong && 'bg-[hsl(var(--color-primary)/0.08)]',
      )}
    >
      <dt className="text-xs text-[hsl(var(--fg-secondary))]">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-[hsl(var(--fg-primary))]">{value}</dd>
    </div>
  )
}
