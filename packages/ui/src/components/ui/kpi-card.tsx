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
 *
 * ⚠️ IT MUST APPLY TO STRINGS, NOT ONLY TO NUMBERS.
 *
 * This existed from the start and almost nothing reached it: the card sized a
 * NUMBER automatically and gave every pre-formatted string a fixed
 * `text-lg sm:text-xl`. Practically every screen passes a formatted string —
 * money with its own currency rules — so «۲۶۱٬۵۰۰٬۰۰۰» rendered at the fixed
 * size and overflowed its card, which is exactly what the owner reported.
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

/**
 * The same ladder, one step larger — for a HEADLINE figure (the chart's total,
 * the funnel's focused stage) rather than a card's.
 *
 * ⚠️ ONE LADDER, THREE ENTRY POINTS. Three hand-written breakpoint sets is how
 * the dashboard came to have a card that shrank and a headline beside it that
 * did not.
 */
export function headlineFontClass(text: string): string {
  const len = text.length
  if (len <= 7) return 'text-2xl sm:text-3xl'
  if (len <= 11) return 'text-xl sm:text-2xl'
  if (len <= 16) return 'text-lg sm:text-xl'
  if (len <= 20) return 'text-base sm:text-lg'
  if (len <= 26) return 'text-sm sm:text-base'
  return 'text-xs sm:text-sm'
}

/** The same ladder, one step smaller — for a supporting stat in a tight row. */
export function statFontClass(text: string): string {
  const len = text.length
  if (len <= 11) return 'text-sm'
  if (len <= 16) return 'text-xs'
  if (len <= 22) return 'text-[11px]'
  return 'text-[10px]'
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
  /** The shape of what is coming, at the card's own height. */
  isLoading?: boolean
  /**
   * H1 — where this number lives.
   *
   * With it the card is a real `<button>`: keyboard focus, Enter and Space and
   * an accessible name, none of which an onClick on a div gives. Without it it
   * stays a plain box — a card that looks pressable and does nothing reads as
   * a broken app.
   */
  onOpen?: (() => void) | undefined
  /** What the drill-down shows, for the tooltip and the screen reader. */
  openLabel?: string | undefined
  /**
   * ⚠️ «—» WHEN THERE IS NOTHING TO COMPARE, instead of no line at all.
   *
   * For a ROW of cards: without it the cards that have no comparison are
   * shorter than the ones that do, and the row's baselines break. The dash
   * means «not compared», never «unchanged» — which is why it is a dash and
   * not «۰٪».
   */
  showEmptyDelta?: boolean
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
  isLoading = false,
  onOpen,
  openLabel,
  showEmptyDelta = false,
}: KpiCardProps) {
  const locale = useIntlLocale()

  // A number is formatted here; a string is already formatted by the caller.
  // ⚠️ BOTH get the automatic size — see `valueFontClass`. Only a ReactNode
  // keeps the fixed step, because there is no text to measure.
  const isNumeric = typeof value === 'number'
  const text = isNumeric ? fullAmount(value, locale) : typeof value === 'string' ? value : null

  const hasDelta = delta !== undefined && delta !== null
  const isUp = hasDelta && delta >= 0
  const isGood = invertDelta ? !isUp : isUp
  const TrendIcon = isUp ? TrendingUp : TrendingDown

  if (isLoading) {
    return (
      <div
        className={cn(
          'h-[104px] rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse',
          className,
        )}
        aria-hidden="true"
      />
    )
  }

  const Tag = onOpen ? 'button' : 'div'

  return (
    <Tag
      {...(onOpen
        ? {
            type: 'button' as const,
            onClick: onOpen,
            title: openLabel ?? label,
            'aria-label': openLabel ? `${label} — ${openLabel}` : label,
          }
        : {})}
      className={cn(
        SURFACE_CLASS[surface],
        STAT_PADDING,
        // RTL-safe: `text-start`, never `text-left`. A button centre-aligns
        // its content by default, which would silently re-align every figure
        // the moment a card became clickable.
        onOpen &&
          'w-full text-start cursor-pointer hover:border-[hsl(var(--color-primary)/0.5)] hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
        className,
      )}
    >
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
            // Only a real number carries a sign worth colouring; a formatted
            // string (a name, a date, money with its own symbol) stays neutral.
            isNumeric ? amountTone(value as number) : 'text-[hsl(var(--fg-primary))]',
          )}
          title={text}
        >
          {text}
        </p>
      ) : (
        // A ReactNode — an element, not text. Nothing to measure, so it keeps
        // the fixed step.
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

      {!hasDelta && showEmptyDelta && (
        // Not «۰٪»: nothing was compared, and a zero would claim it was.
        <p className="mt-1 text-[11px] text-[hsl(var(--fg-tertiary))]">—</p>
      )}

      {hint ? <div className={cn('mt-0.5', STAT_HINT)}>{hint}</div> : null}
    </Tag>
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
