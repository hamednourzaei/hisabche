'use client'

// ============================================
// CustomerRiskNote — how this customer has been paying, in one line.
//
// Reads GET /analysis/customers/:id/risk. The band comes from the server; this
// component decides nothing. `unknown` is a real state and is shown WITH its
// reason («too few settled invoices») — it is never rendered as «healthy».
// ============================================

import { useTranslations } from 'next-intl'
import { useCustomerRisk } from '@hisabche/api'
import { formatNumber } from '@hisabche/formatting'

import { cn } from '../../../lib/utils'
import { useIntlLocale } from '../../../hooks/use-intl-locale'

export const CUSTOMER_RISK_BANDS = ['healthy', 'watch', 'at_risk', 'unknown'] as const
export const CUSTOMER_RISK_SIGNALS = [
  'RECENT_LATE',
  'TREND',
  'GROWING_DEBT',
  'BROKEN_PROMISE',
] as const
export const CUSTOMER_RISK_REASONS = [
  'NEVER_BOUGHT',
  'TOO_FEW_SETTLED',
  'NO_SETTLED_INVOICES',
] as const
export const CUSTOMER_HEALTH_BANDS = [
  'growing',
  'steady',
  'shrinking',
  'dormant',
  'unknown',
] as const
export const CUSTOMER_LOYALTY_TIERS = ['new', 'regular', 'loyal', 'champion', 'unknown'] as const

const bandClass: Record<(typeof CUSTOMER_RISK_BANDS)[number], string> = {
  healthy: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  watch: 'bg-[hsl(var(--color-warning)/0.15)] text-[hsl(var(--fg-primary))]',
  at_risk: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
  unknown: 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
}

export function CustomerRiskNote({
  customerId,
  className,
}: {
  customerId: string
  className?: string | undefined
}) {
  const t = useTranslations('analysis.risk')
  const locale = useIntlLocale()
  const risk = useCustomerRisk(customerId)

  if (risk.isLoading) return null
  if (risk.isError || !risk.data) {
    return (
      <p role="alert" className={cn('text-xs text-[hsl(var(--color-destructive))]', className)}>
        {t('failed')}
      </p>
    )
  }

  const { band, signals, reason, facts, health, loyalty } = risk.data
  const healthKnown = !!health && (CUSTOMER_HEALTH_BANDS as readonly string[]).includes(health.band)
  const loyaltyKnown =
    !!loyalty && (CUSTOMER_LOYALTY_TIERS as readonly string[]).includes(loyalty.tier)
  const known = (CUSTOMER_RISK_BANDS as readonly string[]).includes(band)
  const why =
    reason && (CUSTOMER_RISK_REASONS as readonly string[]).includes(reason)
      ? t(`reasons.${reason}`)
      : signals
          .filter((signal) => (CUSTOMER_RISK_SIGNALS as readonly string[]).includes(signal.key))
          .map((signal) => t(`signals.${signal.key}`))
          .join('، ')

  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 text-sm',
        className,
      )}
    >
      <span className="font-medium text-[hsl(var(--fg-primary))]">{t('title')}:</span>
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-medium',
          known ? bandClass[band] : bandClass.unknown,
        )}
      >
        {known ? t(`bands.${band}`) : band}
      </span>
      {why ? <span className="text-xs text-[hsl(var(--fg-secondary))]">{why}</span> : null}
      {/* Buying, as opposed to paying. «unknown» is not shown as a verdict. */}
      {healthKnown && health.band !== 'unknown' ? (
        <span className="text-xs text-[hsl(var(--fg-secondary))]">
          {t('healthTitle')}: {t(`health.${health.band}`)}
          {health.trendPercent !== null
            ? ` (${formatNumber(health.trendPercent, locale, 0)}٪${health.currency ? ` ${health.currency}` : ''})`
            : ''}
        </span>
      ) : null}
      {loyaltyKnown && loyalty.tier !== 'unknown' ? (
        <span className="text-xs text-[hsl(var(--fg-secondary))]">
          {t('loyaltyTitle')}: {t(`loyalty.${loyalty.tier}`)}
        </span>
      ) : null}
      {facts.averageDaysLate !== null ? (
        <span className="ms-auto text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
          {t('averageLate')}: {formatNumber(facts.averageDaysLate, locale, 0)}
        </span>
      ) : null}
    </p>
  )
}
