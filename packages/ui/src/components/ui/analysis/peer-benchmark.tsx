'use client'

// ============================================
// «مقایسه» — one figure of this business beside the others that use this
// product (#135): sale invoices per day over the last 30 days.
//
// ⚠️ THERE IS NO OUTSIDE DATA. The others are businesses on this same service —
// never «the market» or «the industry», and the page says exactly that.
// ⚠️ BELOW TEN OTHERS NOTHING IS COMPARED. The business's own figure is shown,
// and a sentence says how many there were and how many are needed — the own
// figure is never put in the «others» column.
// ⚠️ A DIFFERENCE, NOT A RANK: «۲٫۵ فاکتور در روز بالاتر از میانه», never
// «نفر ۴۳ از ۷۱».
// ⚠️ «Not set up», «failed» and «not enough to compare» are three sentences.
// ============================================

import { useTranslations } from 'next-intl'
import { formatNumber } from '@hisabche/formatting'
import { apiErrorMessage, usePeerBenchmark } from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { KpiCard, KpiGrid } from '../kpi-card'

/** Why there is no comparison; each has a sentence. */
export const BENCHMARK_UNAVAILABLE = ['NO_SELF_FIGURE', 'NOT_ENOUGH_PEERS', 'NO_PEERS'] as const
export const BENCHMARK_DIRECTIONS = ['above', 'below', 'level'] as const

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'

export function PeerBenchmark() {
  const t = useTranslations('benchmark')
  const locale = useIntlLocale()
  const result = usePeerBenchmark()
  const rate = (value: number) => formatNumber(value, locale, 2)
  const whole = (value: number) => formatNumber(value, locale, 0)

  if (result.isLoading) {
    return (
      <div className="h-24 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))] motion-reduce:animate-none" />
    )
  }
  if (result.error || !result.data) {
    const status = (result.error as { response?: { status?: number } } | null)?.response?.status
    const pending = apiErrorMessage(result.error, '').includes('BENCHMARK_MIGRATION_PENDING')
    return (
      <p role="alert" className={cn(card, 'p-4 text-sm text-[hsl(var(--color-destructive))]')}>
        {status === 403 ? t('forbidden') : pending ? t('notSetUp') : t('failed')}
      </p>
    )
  }

  const data = result.data
  const reason = BENCHMARK_UNAVAILABLE.find((known) => known === data.unavailable)
  const direction = BENCHMARK_DIRECTIONS.find((known) => known === data.direction)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-[hsl(var(--fg-primary))]">{t('title')}</h2>
        <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">
          {t('what', { days: whole(data.periodDays) })}
        </p>
      </div>

      <KpiGrid>
        <KpiCard
          label={t('own')}
          value={data.own === null ? t('noFigure') : rate(data.own)}
          hint={t('perDay')}
        />
        {data.peerMedian !== null ? (
          <KpiCard label={t('peerMedian')} value={rate(data.peerMedian)} hint={t('perDay')} />
        ) : null}
        <KpiCard label={t('peerCount')} value={whole(data.peerCount)} hint={t('peerCountHint')} />
      </KpiGrid>

      {reason ? (
        <p className={cn(card, 'p-4 text-sm text-[hsl(var(--fg-primary))]')}>
          {t(`unavailable.${reason}`, {
            count: whole(data.peerCount),
            min: whole(data.minPeers),
            days: whole(data.periodDays),
          })}
        </p>
      ) : direction && data.delta !== null && data.percentile !== null ? (
        <p className={cn(card, 'p-4 text-sm text-[hsl(var(--fg-primary))]')}>
          {t(`direction.${direction}`, { delta: rate(Math.abs(data.delta)) })}{' '}
          {t('percentile', { percent: whole(data.percentile) })}
        </p>
      ) : null}

      <p className="text-xs text-[hsl(var(--fg-tertiary))]">
        {t('note', { min: whole(data.minPeers) })}
      </p>
    </div>
  )
}
