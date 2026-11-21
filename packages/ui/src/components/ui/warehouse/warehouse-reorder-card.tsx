'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/warehouse-reorder-card.tsx
//
// «پیشنهاد سفارش» — the second aside card on /warehouse.
//
// The rows are the server's own reorder suggestions (`GET
// /inventory/reorder-suggestions`): what sold in the last 30 days, against a
// product's reorder point. They are NOT the same thing as the list's
// «کمبود موجودی» count — that one is every product at or below its minimum,
// this one also asks whether anything sold. Both are labelled with what they
// mean, so the two numbers on one screen cannot be read as one.
//
// The card is a SUGGESTION: nothing here orders anything. «همه پیشنهادها»
// opens the reorder section of the hub, where the list and the draft purchase
// order live.
// ============================================

import { memo } from 'react'
import { CheckCircle2, ChevronLeft, RefreshCw } from 'lucide-react'
import { useReorderSuggestions } from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { fullAmount } from '../kpi-card'
import { FOCUS_RING } from '../focus-ring'
import { STAT_CARD_SURFACE } from '../stat-surface'

/** How many rows fit before «همه پیشنهادها». */
const VISIBLE = 5

type Translate = (key: string, fallback?: string) => string

export const WarehouseReorderCard = memo(function WarehouseReorderCard({
  t,
  onOpenAll,
}: {
  t: Translate
  /** Opens the hub's reorder section; omitted = no link. */
  onOpenAll?: (() => void) | undefined
}) {
  const locale = useIntlLocale()
  const reorder = useReorderSuggestions()
  const rows = reorder.data ?? []
  const visible = rows.slice(0, VISIBLE)
  const rest = rows.length - visible.length

  return (
    <section
      className={cn(STAT_CARD_SURFACE, 'p-4')}
      aria-labelledby="warehouse-reorder-card-title"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            id="warehouse-reorder-card-title"
            className="text-sm font-bold text-[hsl(var(--fg-primary))]"
          >
            {t('ops.reorder', 'پیشنهاد سفارش')}
          </h2>
          <p className="mt-0.5 text-[11px] text-[hsl(var(--fg-tertiary))]">
            {t('warehouse.reorderSubtitle', 'بر اساس فروش ۳۰ روز گذشته')}
          </p>
        </div>
        {reorder.isSuccess && rows.length > 0 ? (
          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-warning)/0.12)] px-1.5 text-[11px] font-bold tabular-nums text-[hsl(var(--color-warning))]">
            {fullAmount(rows.length, locale)}
          </span>
        ) : null}
      </header>

      {reorder.isLoading ? (
        <div className="mt-4 space-y-2" aria-hidden="true">
          {[0, 1, 2].map((line) => (
            <div
              key={line}
              className="h-10 animate-pulse rounded-lg bg-[hsl(var(--surface-muted))]"
            />
          ))}
        </div>
      ) : reorder.isError ? (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between gap-2 text-xs text-[hsl(var(--color-destructive))]"
        >
          <span>{t('ops.loadFailed', 'این بخش خوانده نشد.')}</span>
          <button
            type="button"
            onClick={() => void reorder.refetch()}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border border-[hsl(var(--border-default))] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
              FOCUS_RING,
            )}
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            {t('common.retry', 'تلاش دوباره')}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-[hsl(var(--color-success)/0.07)] p-3 text-xs text-[hsl(var(--fg-secondary))]">
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-[hsl(var(--color-success))]"
            aria-hidden="true"
          />
          <span>{t('ops.reorderEmpty', 'هیچ کالایی به نقطه‌ی سفارش نرسیده')}</span>
        </p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-[hsl(var(--border-default))]">
            {visible.map((row) => (
              <li key={row.productId} className="flex items-center gap-2.5 py-2 first:pt-0">
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    row.onHand <= 0
                      ? 'bg-[hsl(var(--color-destructive))]'
                      : 'bg-[hsl(var(--color-warning))]',
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[hsl(var(--fg-primary))]">
                    {row.productName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[hsl(var(--fg-tertiary))]">
                    {t('ops.onHand', 'موجودی')}{' '}
                    <b className="font-semibold text-[hsl(var(--fg-secondary))]">
                      {fullAmount(row.onHand, locale)}
                    </b>
                    {' · '}
                    {t('ops.reorderLevel', 'نقطه‌ی سفارش')}{' '}
                    <b className="font-semibold text-[hsl(var(--fg-secondary))]">
                      {fullAmount(row.reorderLevel, locale)}
                    </b>
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-[hsl(var(--color-primary)/0.1)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[hsl(var(--color-primary))]">
                  +{fullAmount(row.suggestedQuantity, locale)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-[hsl(var(--border-default))] pt-2.5">
            <span className="truncate text-[10px] text-[hsl(var(--fg-tertiary))]">
              {rest > 0
                ? `${fullAmount(rest, locale)} ${t('warehouse.moreSuggestions', 'پیشنهاد دیگر')}`
                : null}
            </span>
            {onOpenAll ? (
              <button
                type="button"
                onClick={onOpenAll}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[hsl(var(--color-primary))] hover:underline',
                  FOCUS_RING,
                )}
              >
                {t('warehouse.allSuggestions', 'همه پیشنهادها')}
                <ChevronLeft className="size-3.5 ltr:rotate-180" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
})

WarehouseReorderCard.displayName = 'WarehouseReorderCard'
