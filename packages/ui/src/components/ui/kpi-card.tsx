'use client'

// ============================================
// packages/ui/src/components/ui/kpi-card.tsx
//
// THE KPI card. One component, every screen.
//
// The «kpi-card» block from dashboardcn (MIT), adopted on the owner's
// instruction and rebuilt on this product's own tokens and classes: the shell,
// the label, the figure and the padding all come from `stat-surface.ts`, so a
// change there still moves every KPI in the product at once.
//
// ---------------------------------------------------------------------------
// WHAT IT REPLACES
//
// Two components drew the same thing in two ways: `BentoStats` (the dashboard
// row — four cells, deltas, trend arrows) and `Stat` from `capability-kit`
// (sixteen capability screens — plain figures, no comparison). They already
// shared their LOOK through `stat-surface`, but not their markup, so a delta
// badge existed on one and not the other and the two drifted at every edit.
//
// Both now render THIS. `Stat` is an alias, and `BentoStats` lays out cells of
// it — which is why `surface` exists: the bento merges its four cells into one
// bordered box on mobile, so its cells must not each draw their own border
// there.
//
// ---------------------------------------------------------------------------
// ⚠️ THE NUMBER IS NEVER ABBREVIATED
//
// «۱۲ میلیون» hides the exact figure a bookkeeper is checking. The card shrinks
// its font instead (`valueFontClass`), so a nine-figure sum stays whole and
// still fits.
//
// ⚠️ `delta: null` IS NOT `delta: 0`
//
// Zero reads as «measured, no change». Null means there was nothing to compare
// against — a new shop, or a window with no period before it — and the badge
// is then absent rather than showing a green 0%.
// ============================================

import * as React from 'react'
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'

import {
  STAT_CARD_SURFACE,
  STAT_CARD_SURFACE_DESKTOP,
  STAT_HINT,
  STAT_LABEL,
  STAT_PADDING,
  STAT_VALUE,
} from './stat-surface'
import { cn } from '../../lib/utils'
import { useIntlLocale } from '../../hooks/use-intl-locale'

function localeNumber(value: number, locale: string, decimals = 0): string {
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  } catch {
    return value.toFixed(decimals)
  }
}

/** Full grouped digits — never abbreviated. */
export function fullAmount(value: number, locale: string): string {
  return localeNumber(value, locale)
}

/**
 * The longer the text, the smaller the font — so the whole number fits without
 * being shortened.
 */
export function valueFontClass(text: string): string {
  const len = text.length
  if (len <= 7) return 'text-lg sm:text-2xl'
  if (len <= 11) return 'text-base sm:text-xl'
  if (len <= 16) return 'text-sm sm:text-lg'
  if (len <= 20) return 'text-xs sm:text-base'
  if (len <= 26) return 'text-[11px] sm:text-sm'
  return 'text-[10px] sm:text-xs'
}

function formatPercent(delta: number, locale: string): string {
  const abs = Math.abs(delta)
  return `${localeNumber(abs, locale, abs < 10 ? 1 : 0)}٪`
}

/**
 * Sign colour for a numeric amount. A card showing text (a customer's name)
 * has no amount and stays neutral.
 */
function amountTone(amount: number | undefined): string {
  if (amount === undefined || amount === 0) return 'text-[hsl(var(--fg-primary))]'
  return amount < 0 ? 'text-[hsl(var(--color-destructive))]' : 'text-[hsl(var(--color-success))]'
}

/** Where the card draws its own shell. */
export type KpiSurface =
  /** Always a card. The default, and what every standalone KPI uses. */
  | 'card'
  /** A card only from `sm` up — the bento's cells, merged into one box on mobile. */
  | 'desktop'
  /** No shell at all; the caller owns it. */
  | 'none'

export interface KpiCardProps {
  label: string
  /**
   * The figure.
   *
   * A NUMBER is formatted, sign-coloured and auto-sized here. A ReactNode is
   * rendered as given — for screens that pass an already-formatted string
   * (money with its own currency rules) or a small element.
   */
  value: React.ReactNode | number
  /** The line under the figure. */
  hint?: React.ReactNode
  icon?: LucideIcon
  /**
   * Period-over-period change, as a percentage (12.4 = +12.4%).
   * `null`/omitted renders no badge — see the note at the top of this file.
   */
  delta?: number | null
  /** «نسبت به ماه قبل» — the period the delta compares against. */
  deltaLabel?: string
  /**
   * ⚠️ RISING IS BAD FOR THIS METRIC (debt, expenses, churn).
   *
   * Stated per metric rather than inferred from the sign, so a card added for
   * one of those cannot silently inherit «up is green».
   */
  invertDelta?: boolean
  surface?: KpiSurface
  className?: string
}

const SURFACE_CLASS: Record<KpiSurface, string> = {
  card: STAT_CARD_SURFACE,
  desktop: STAT_CARD_SURFACE_DESKTOP,
  none: '',
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  delta,
  deltaLabel,
  invertDelta = false,
  surface = 'card',
  className,
}: KpiCardProps) {
  const locale = useIntlLocale()

  const isNumeric = typeof value === 'number'
  const text = isNumeric ? fullAmount(value, locale) : null

  const hasDelta = delta !== undefined && delta !== null
  const isUp = hasDelta && delta >= 0
  const isGood = invertDelta ? !isUp : isUp
  const TrendIcon = isUp ? TrendingUp : TrendingDown

  return (
    <div className={cn(SURFACE_CLASS[surface], STAT_PADDING, className)}>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {Icon ? (
          <Icon
            className="size-3.5 shrink-0 text-[hsl(var(--color-primary))] sm:size-4"
            aria-hidden="true"
          />
        ) : null}
        <span className={STAT_LABEL}>{label}</span>
      </div>

      {text !== null ? (
        <p
          className={cn(
            'mt-1.5 truncate font-bold tabular-nums sm:mt-2',
            valueFontClass(text),
            amountTone(value as number),
          )}
          title={text}
        >
          {text}
        </p>
      ) : (
        // A pre-formatted string has no magnitude to size against, so it takes
        // the fixed step rather than the automatic one.
        <p className={cn('mt-1.5 text-lg sm:mt-2 sm:text-xl', STAT_VALUE)}>{value}</p>
      )}

      {hasDelta && (
        <div className="mt-1 flex items-center gap-1">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
              isGood
                ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
                : 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
            )}
          >
            <TrendIcon className="size-3" aria-hidden="true" />
            {formatPercent(delta, locale)}
          </span>
          {deltaLabel && (
            <span className="truncate text-[10px] text-[hsl(var(--fg-tertiary))]">
              {deltaLabel}
            </span>
          )}
        </div>
      )}

      {hint ? <div className={cn('mt-0.5', STAT_HINT)}>{hint}</div> : null}
    </div>
  )
}

KpiCard.displayName = 'KpiCard'

/** Four across on desktop, two on mobile — the dashboard's own row. */
export function KpiGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>{children}</div>
}
