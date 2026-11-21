'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/warehouse-value-chart.tsx
//
// «ارزش موجودی به تفکیک انبار» — the first aside card on /warehouse.
//
// Every figure is the server's `summary.totalValue`, which is the stock at the
// purchase price (see stock-summary.ts). The bar is the row's share of the sum
// of the rows THIS LIST shows — the same rule, and the same helper, as the
// table's «سهم» column. It is not a share of the workspace total: that total
// also counts stock this list cannot name.
//
// A row without a summary is UNKNOWN: «—» and no bar. A zero bar would claim
// the warehouse is empty when nobody could read it.
// ============================================

import { memo, useMemo } from 'react'
import { Check, Warehouse } from 'lucide-react'
import type { StockSummary, WarehouseOverviewItem } from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { valueShares } from '../../../lib/warehouse/warehouse-share'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { fullAmount } from '../kpi-card'
import { STAT_CARD_SURFACE } from '../stat-surface'

type Translate = (key: string, fallback?: string) => string

interface ChartRow {
  id: string
  name: string
  value: number | null
  unassigned: boolean
}

/** Largest first; an unknown value sinks to the end. */
function byValue(a: ChartRow, b: ChartRow): number {
  if (a.value === null && b.value === null) return a.name.localeCompare(b.name)
  if (a.value === null) return 1
  if (b.value === null) return -1
  return b.value - a.value
}

export const WarehouseValueChart = memo(function WarehouseValueChart({
  t,
  fmt,
  warehouses,
  unassigned,
}: {
  t: Translate
  fmt: (v: number) => string
  warehouses: WarehouseOverviewItem[]
  /** Stock in no warehouse; null = there is none. */
  unassigned: StockSummary | null
}) {
  const locale = useIntlLocale()

  const rows = useMemo<ChartRow[]>(() => {
    // The declared type says `summary` is always there; the wire does not
    // promise it (see warehouse-list-table.tsx — same rule, same reason).
    const list: ChartRow[] = warehouses.map((warehouse) => ({
      id: warehouse.id,
      name: warehouse.name,
      value: (warehouse as { summary?: StockSummary | null }).summary?.totalValue ?? null,
      unassigned: false,
    }))
    if (unassigned) {
      list.push({
        id: 'unassigned',
        name: t('warehouse.unassigned', 'بدون انبار'),
        value: unassigned.totalValue,
        unassigned: true,
      })
    }
    return list.sort(byValue)
  }, [warehouses, unassigned, t])

  const shares = valueShares(rows.map((row) => row.value))

  return (
    <section className={cn(STAT_CARD_SURFACE, 'p-4')} aria-labelledby="warehouse-value-chart-title">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            id="warehouse-value-chart-title"
            className="text-sm font-bold text-[hsl(var(--fg-primary))]"
          >
            {t('warehouse.valueByWarehouse', 'ارزش موجودی به تفکیک انبار')}
          </h2>
          <p className="mt-0.5 text-[11px] text-[hsl(var(--fg-tertiary))]">
            {t('warehouse.valueByWarehouseHint', 'به بهای خرید، در واحد کتاب')}
          </p>
        </div>
        {rows.length > 0 ? (
          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.1)] px-1.5 text-[11px] font-bold tabular-nums text-[hsl(var(--color-primary))]">
            {fullAmount(rows.length, locale)}
          </span>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-[hsl(var(--fg-tertiary))]">
          <Warehouse className="size-4 shrink-0" aria-hidden="true" />
          {t('warehouse.noWarehouseBars', 'انباری برای نمایش نیست')}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => {
            const percent = shares.percent(row.value)
            return (
              <li key={row.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      'min-w-0 truncate text-xs font-medium',
                      row.unassigned
                        ? 'text-[hsl(var(--color-warning))]'
                        : 'text-[hsl(var(--fg-secondary))]',
                    )}
                  >
                    {row.name}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[hsl(var(--fg-tertiary))]">
                    {row.value === null ? '—' : fmt(row.value)}
                  </span>
                </div>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[hsl(var(--surface-muted))]">
                  {percent === null ? null : (
                    <span
                      className={cn(
                        'block h-full rounded-full',
                        row.unassigned
                          ? 'bg-[hsl(var(--color-warning))]'
                          : 'bg-[hsl(var(--color-primary))]',
                      )}
                      style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                    />
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-3 flex items-center gap-1.5 border-t border-[hsl(var(--border-default))] pt-2.5 text-[10px] text-[hsl(var(--fg-tertiary))]">
        <Check className="size-3 shrink-0 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        {t('warehouse.shareNote', 'سهم‌ها نسبت به مجموع ردیف‌های همین فهرست است')}
      </p>
    </section>
  )
})

WarehouseValueChart.displayName = 'WarehouseValueChart'
