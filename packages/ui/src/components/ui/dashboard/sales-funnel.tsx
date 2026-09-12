'use client'

// ============================================
// packages/ui/src/components/ui/dashboard/sales-funnel.tsx
//
// The pipeline, as a funnel — from real opportunities.
//
// ---------------------------------------------------------------------------
// ⚠️ THE NUMBERS COME FROM `opportunities`, AND NOTHING IS DERIVED
//
// The mock this was built from showed 1,500 potential customers narrowing to
// 38 sales, next to a KPI saying the shop has 24 customers. Those figures were
// illustrative — there is no ratio that turns 24 customers into 1,500 leads,
// and inventing one would be a dashboard that lies confidently.
//
// `opportunitySchema` already defines exactly these stages — `lead`,
// `qualified`, `proposal`, `negotiation`, `won`, `lost` — and the table,
// service and route for them already exist. So the funnel is a real pipeline
// count, and a shop that has never recorded an opportunity sees an empty state
// that says so rather than a decorative cone.
//
// ⚠️ `lost` IS NOT A BAND IN THE CONE. A lost deal did not pass through the
// stages beneath it; stacking it in would make every lower stage look wider
// than it is. It is reported beside the funnel, where it is information rather
// than a distortion.
//
// ⚠️ THE WIDTHS ARE PROPORTIONAL TO THE TOP STAGE, NOT TO THE STAGE ABOVE.
// Scaling each band against its predecessor makes a pipeline of 10 → 9 → 8
// look identical to 1000 → 90 → 8. The shape has to mean something.
// ============================================

import * as React from 'react'

import { AlertCircle, Filter } from 'lucide-react'

import { cn } from '../../../lib/utils'

export interface SalesFunnelStage {
  stage: string
  count: number
}

/** Band colours, widest to narrowest. Tokens only — no literal colours. */
const STAGE_TONE: Record<string, string> = {
  lead: 'bg-[hsl(var(--color-info)/0.65)]',
  qualified: 'bg-[hsl(var(--color-info)/0.85)]',
  proposal: 'bg-[hsl(var(--color-primary)/0.75)]',
  negotiation: 'bg-[hsl(var(--color-primary)/0.9)]',
  won: 'bg-[hsl(var(--color-success))]',
}

const MIN_WIDTH_PERCENT = 18

export function SalesFunnel({
  stages,
  lost,
  conversionRate,
  isLoading,
  isError,
  height = 180,
  t,
}: {
  stages: SalesFunnelStage[]
  lost: number
  conversionRate: number | null
  isLoading?: boolean | undefined
  isError?: boolean | undefined
  height?: number | undefined
  t: (key: string, fallback?: string) => string
}) {
  const top = stages[0]?.count ?? 0
  const total = stages.reduce((sum, s) => sum + s.count, 0)

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl bg-[hsl(var(--surface-muted)/0.4)]"
        style={{ height }}
      >
        <span className="text-sm text-[hsl(var(--fg-tertiary))]">
          {t('common.loading', 'در حال بارگذاری…')}
        </span>
      </div>
    )
  }

  // ⚠️ An error is not an empty pipeline. Drawing a flat funnel here would
  // tell the shop it has no opportunities, which is a claim about their
  // business made out of a failed request.
  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[hsl(var(--color-destructive)/0.06)] p-6 text-center"
        style={{ height }}
      >
        <AlertCircle className="size-5 text-[hsl(var(--color-destructive))]" aria-hidden="true" />
        <p className="text-sm text-[hsl(var(--color-destructive))]">
          {t('dashboard.funnel.error', 'اطلاعات قیف فروش گرفته نشد.')}
        </p>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[hsl(var(--surface-muted)/0.4)] p-6 text-center"
        style={{ height }}
      >
        <Filter className="size-5 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
        <p className="text-sm font-medium text-[hsl(var(--fg-secondary))]">
          {t('dashboard.funnel.empty', 'هنوز فرصت فروشی ثبت نشده است')}
        </p>
        <p className="max-w-xs text-xs text-[hsl(var(--fg-tertiary))]">
          {t(
            'dashboard.funnel.emptyHint',
            'فرصت‌های فروش را در بخش ارتباط با مشتریان ثبت کنید تا مسیر تبدیل آن‌ها این‌جا دیده شود.',
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3" style={{ minHeight: height }}>
      <ul className="flex flex-col gap-1.5" aria-label={t('dashboard.funnel.aria', 'قیف فروش')}>
        {stages.map((item) => {
          // Proportional to the widest band, with a floor so a stage holding
          // one deal is still readable and still clickable-sized.
          const ratio = top > 0 ? item.count / top : 0
          const width = Math.max(MIN_WIDTH_PERCENT, Math.round(ratio * 100))

          return (
            <li key={item.stage} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs text-[hsl(var(--fg-secondary))]">
                {t(`dashboard.funnel.stage.${item.stage}`, item.stage)}
              </span>

              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'flex h-8 items-center justify-center rounded-lg px-2',
                    'transition-[width] duration-300 motion-reduce:transition-none',
                    STAGE_TONE[item.stage] ?? 'bg-[hsl(var(--surface-muted))]',
                  )}
                  style={{ width: `${width}%` }}
                >
                  <span className="text-xs font-semibold tabular-nums text-white">
                    {item.count}
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[hsl(var(--border-default))] pt-2 text-xs">
        {/* A real number or nothing at all — «۰٪» on an empty pipeline is a
            statement that nothing converts, which is not what no data means. */}
        {conversionRate !== null ? (
          <span className="text-[hsl(var(--fg-secondary))]">
            {t('dashboard.funnel.conversion', 'نرخ تبدیل')}:{' '}
            <span className="font-semibold tabular-nums text-[hsl(var(--color-success))]">
              {conversionRate}%
            </span>
          </span>
        ) : (
          <span />
        )}

        {lost > 0 ? (
          <span className="text-[hsl(var(--fg-tertiary))]">
            {t('dashboard.funnel.lost', 'از دست رفته')}:{' '}
            <span className="tabular-nums">{lost}</span>
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default SalesFunnel
