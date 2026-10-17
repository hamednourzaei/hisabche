'use client'

// ============================================
// packages/ui/src/components/ui/warehouse-detail/product-journey-panel.tsx
//
// A product's money journey over the last 12 months, in the selected
// currency: what was bought (cost layers, by source), what left with sales
// and adjustments (at cost), what is still on the shelf, and the profit the
// report attributes to it. Never converts currencies.
//
// ⚠️ IT LIVES INSIDE «افزایش و کاهش موجودی» (owner, 17 October 2026): the two
// read the same movements from two angles, so this is a block inside the
// movements card — no border of its own — and it opens SHOWING: the merge was
// asked for so the numbers are read, not hidden behind a second click.
// «بستن» still collapses it.
// ============================================

import { useMemo, useState } from 'react'
import { apiErrorMessage, useProductJourney } from '@hisabche/api'
import { toIsoDay } from '@hisabche/formatting'

import { useCurrency } from '../../../hooks/use-currency'
import { formatSelectedAmount } from '../../../lib/money-display'
import { evidenceSourceLabel } from '../../../lib/evidence-labels'
import { Button } from '../button'

type T = (key: string, fallback?: string) => string

export function ProductJourneyPanel({ t, productId }: { t: T; productId: string }) {
  const { currency } = useCurrency()
  const [open, setOpen] = useState(true)
  const range = useMemo(() => {
    const to = new Date()
    const from = new Date(to.getTime() - 365 * 86_400_000)
    return { from: toIsoDay(from), to: toIsoDay(to), currency }
  }, [currency])
  const journey = useProductJourney(productId, range, open)
  const status = (journey.error as { response?: { status?: number } } | null)?.response?.status
  const money = (value: number) => `${formatSelectedAmount(value)} ${currency}`

  return (
    <section className="space-y-3 rounded-xl bg-[hsl(var(--surface-muted))] p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('evidence.journeyTitle')}
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? t('evidence.hide') : t('evidence.show')}
        </Button>
      </div>
      {open && (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('evidence.journeyHelp')}</p>
      )}
      {open && journey.isLoading && (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('evidence.loading')}</p>
      )}
      {open && status === 403 && (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('evidence.forbidden')}</p>
      )}
      {open && journey.error && status !== 403 && (
        <p className="text-sm text-[hsl(var(--color-destructive))]">
          {apiErrorMessage(journey.error, t('evidence.loadError'))}
        </p>
      )}
      {open && journey.data && (
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-[hsl(var(--fg-secondary))]">{t('evidence.bought')}</dt>
            <dd className="tabular-nums" dir="ltr">
              {journey.data.bought.quantity} · {money(journey.data.bought.amount)}
            </dd>
          </div>
          {journey.data.bought.bySource.map((row) => (
            <div
              key={row.sourceType}
              className="flex justify-between gap-2 ps-4 text-xs text-[hsl(var(--fg-tertiary))]"
            >
              <dt>{evidenceSourceLabel(t, row.sourceType)}</dt>
              <dd dir="ltr">
                {row.quantity} · {money(row.amount)}
              </dd>
            </div>
          ))}
          <div className="flex justify-between gap-2">
            <dt className="text-[hsl(var(--fg-secondary))]">{t('evidence.soldAtCost')}</dt>
            <dd className="tabular-nums" dir="ltr">
              {journey.data.sold.quantity} · {money(journey.data.sold.cost)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[hsl(var(--fg-secondary))]">{t('evidence.onHand')}</dt>
            <dd className="tabular-nums" dir="ltr">
              {journey.data.onHand.quantity} · {money(journey.data.onHand.value)}
            </dd>
          </div>
          <div className="flex justify-between gap-2 font-medium">
            <dt>{t('evidence.revenue')}</dt>
            <dd className="tabular-nums" dir="ltr">
              {money(journey.data.revenue)}
            </dd>
          </div>
          <div className="flex justify-between gap-2 font-medium">
            <dt>{t('evidence.grossProfit')}</dt>
            <dd className="tabular-nums" dir="ltr">
              {/* null = part of what was sold has no recorded cost. */}
              {journey.data.profit === null
                ? t('evidence.profitUnknown')
                : money(journey.data.profit)}
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}
