'use client'

// ============================================
// Manufacturing on the dashboard: what was made in the dashboard's own period,
// what it cost, the material used most and the one whose cost moved most.
//
// It reads the SAME report the manufacturing page shows
// (`useManufacturingReport`) — no second aggregation.
//
// ⚠️ IT IS ABSENT, ON PURPOSE, FOR A BUSINESS THAT MAKES NOTHING. Most shops
// never open the manufacturing page, and an always-present «0 produced» card
// would be noise on their dashboard. So: nothing in the period → no card. That
// is safe to do silently HERE only because the manufacturing page itself always
// says «nothing was produced in this period» in words — the absence is never
// the only place the answer lives. A failed read is likewise left to that page.
// ============================================

import { Factory } from 'lucide-react'
import { formatNumber } from '@hisabche/formatting'
import { useManufacturingReport } from '@hisabche/api'

import { Button } from '../button'

type T = (key: string, fallback?: string) => string

export function ManufacturingDashboardCard({
  t,
  locale,
  from,
  to,
  onOpen,
}: {
  t: T
  locale: string
  /** ISO days — the dashboard's own range. */
  from: string
  to: string
  onOpen: () => void
}) {
  const report = useManufacturingReport({ from, to })
  const data = report.data
  if (!data || data.totals.runs === 0) return null

  const money = (value: number) => formatNumber(value, locale, 4)
  const mostUsed = data.materials[0] ?? null
  const biggestMove =
    [...data.materials]
      .filter((row) => row.changePercent !== null && row.change !== 0)
      .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))[0] ?? null

  return (
    <section className="mx-auto mt-4 w-full max-w-7xl px-4">
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
            <Factory className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            {t('manufacturing.dashboard.title', 'تولید در این بازه')}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={onOpen}>
            {t('manufacturing.dashboard.open', 'گزارش کامل')}
          </Button>
        </header>
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>
            <dt className="text-xs text-[hsl(var(--fg-secondary))]">
              {t('manufacturing.report.quantity', 'تعداد ساخته‌شده')}
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
              {formatNumber(data.totals.quantity, locale, 4)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[hsl(var(--fg-secondary))]">
              {t('manufacturing.report.totalCost', 'بهای کل تولید')}
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
              {money(data.totals.totalCost)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[hsl(var(--fg-secondary))]">
              {t('manufacturing.dashboard.mostUsed', 'پرمصرف‌ترین ماده')}
            </dt>
            <dd className="mt-0.5 truncate font-semibold text-[hsl(var(--fg-primary))]">
              {mostUsed ? mostUsed.name || t('manufacturing.history.unnamed', 'بدون نام') : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[hsl(var(--fg-secondary))]">
              {t('manufacturing.dashboard.biggestMove', 'بیشترین تغییر بها')}
            </dt>
            <dd className="mt-0.5 truncate font-semibold text-[hsl(var(--fg-primary))]">
              {biggestMove ? (
                <>
                  {biggestMove.name || t('manufacturing.history.unnamed', 'بدون نام')}{' '}
                  <span
                    className={
                      biggestMove.change > 0
                        ? 'text-[hsl(var(--color-destructive))]'
                        : 'text-[hsl(var(--color-success))]'
                    }
                  >
                    {biggestMove.change > 0
                      ? t('manufacturing.report.dearer', 'گران‌تر')
                      : t('manufacturing.report.cheaper', 'ارزان‌تر')}{' '}
                    {formatNumber(Math.abs(biggestMove.changePercent ?? 0), locale, 2)}٪
                  </span>
                </>
              ) : (
                t('manufacturing.report.unchanged', 'بدون تغییر')
              )}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
