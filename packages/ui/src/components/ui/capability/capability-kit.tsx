'use client'

// ============================================
// packages/ui/src/components/ui/capability/capability-kit.tsx
//
// The shared surface behind the Tier 1/2 screens — till, assets, bank,
// budgets, timesheets, expiry, conflicts, governance.
//
// ---------------------------------------------------------------------------
// THIS IS A THIN ADAPTER, NOT A DESIGN SYSTEM
//
// The first version of this file declared its own `Panel`, `ActionButton`,
// `Badge` and a hand-written `inputClass`, with colours spelled out in
// Tailwind arbitrary values. That was a mistake: it built a SECOND design
// system alongside the project's own, so these eight screens drifted from
// every other screen in the product — different corner radii, different
// focus rings, different disabled states, and none of it inheriting a future
// change to the real components.
//
// Everything here now composes `Card`, `Button`, `Badge`, `Input`, `Table`,
// `Skeleton` and `EmptyState` from this package. What is left is only the part
// that is genuinely specific to these screens:
//
//   · money that arrives as an integer in MINOR units,
//   · durations that arrive as whole minutes,
//   · a vocabulary of tones ("this figure is bad news") mapped onto the
//     project's variant names in ONE place rather than in eight views.
//
// If a screen needs something not here, it should reach for the project
// component directly — not add a new primitive to this file.
// ============================================

import { DocsHelpLink } from '../docs/docs-help-link'
import type { LucideIcon } from 'lucide-react'

import { STAT_CARD_SURFACE, STAT_HINT, STAT_LABEL, STAT_PADDING, STAT_VALUE } from '../stat-surface'
import { SelectField as SharedSelectField } from '../select-field'
import React from 'react'

import { cn } from '../../../lib/utils'
import { formatSelectedMoney, formatSelectedAmount } from '../../../lib/money-display'
import { Badge as UiBadge } from '../badge'
import { Button } from '../button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../card'
import { Input } from '../input'
import { Skeleton } from '../skeleton'

/* ─── Money ───────────────────────────────────────────────────────────────── */

/**
 * A figure the server sent in MINOR units.
 *
 * This and `MinorInput` are the only two places in these screens that cross
 * between minor and major units. Eight private `/ 100` expressions would be
 * eight chances for one of them to round differently.
 */
export const Money = React.memo(function Money({
  minor,
  signed = false,
  tone,
  className,
}: {
  minor: number
  /** Show an explicit + on positives, where the sign IS the meaning. */
  signed?: boolean
  /** 'auto' colours by sign; otherwise say it explicitly. */
  tone?: 'auto' | 'good' | 'bad' | 'muted' | undefined
  className?: string
}) {
  const resolved = tone === 'auto' ? (minor > 0 ? 'good' : minor < 0 ? 'bad' : 'muted') : tone

  return (
    <span
      dir="ltr"
      className={cn(
        'tabular-nums font-medium',
        resolved === 'good' && 'text-[hsl(var(--color-success))]',
        resolved === 'bad' && 'text-[hsl(var(--color-destructive))]',
        resolved === 'muted' && 'text-[hsl(var(--fg-tertiary))]',
        className,
      )}
    >
      {signed && minor > 0 ? '+' : ''}
      {formatSelectedMoney(minor / 100)}
    </span>
  )
})

/** Minutes as the server stores them, shown as hours and minutes. */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) return '—'

  const whole = Math.trunc(Math.abs(minutes))
  const hours = Math.floor(whole / 60)
  const rest = whole % 60

  return `${minutes < 0 ? '-' : ''}${formatSelectedAmount(hours)}:${String(rest).padStart(2, '0')}`
}

/* ─── Layout ──────────────────────────────────────────────────────────────── */

/** A section. `Card` underneath, so it matches every other panel in the app. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/** A labelled figure. `hint` carries the comparison the figure needs. */
/**
 * One figure, drawn the way the dashboard draws figures.
 *
 * ---------------------------------------------------------------------------
 * T3 — WHAT CHANGED AND WHY
 *
 * This was a flat tinted box: `rounded-xl bg-[hsl(var(--bg-subtle))]`, a
 * regular-weight number, no border, no elevation. The dashboard's KPI is an
 * elevated card with bold tabular numerals. Sixteen screens used this one, so
 * a third of the product looked like a different application — which is the
 * owner's report, «ظاهرشان با بقیه‌ی داشبورد یکی نیست».
 *
 * The classes come from `stat-surface`, shared with `BentoStats`. Neither
 * component hardcodes the treatment any more, so the two cannot drift.
 *
 * `icon` is optional and new: the dashboard cards carry one, and a screen that
 * has a sensible icon can now match completely.
 */
export function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className={cn(STAT_CARD_SURFACE, STAT_PADDING)}>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {Icon ? (
          <Icon
            className="size-3.5 shrink-0 text-[hsl(var(--color-primary))] sm:size-4"
            aria-hidden="true"
          />
        ) : null}
        <span className={STAT_LABEL}>{label}</span>
      </div>
      {/* `text-lg sm:text-xl` rather than the bento's automatic sizing: these
          screens pass formatted strings, not raw numbers, so there is no
          magnitude to size against. */}
      <p className={cn('mt-1.5 text-lg sm:mt-2 sm:text-xl', STAT_VALUE)}>{value}</p>
      {hint ? <div className={cn('mt-0.5', STAT_HINT)}>{hint}</div> : null}
    </div>
  )
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  // Matches the dashboard's desktop row: four across, two on mobile.
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
}

/* ─── States ──────────────────────────────────────────────────────────────── */

/**
 * Loading, as the shape of what is coming.
 *
 * `Skeleton` rather than the word "loading": the row heights are the row
 * heights of the table that is about to arrive, so the page does not jump.
 */
export function Loading({ label, rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label={label ?? 'loading'}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}

/**
 * A failure, said out loud.
 *
 * These screens read from and post to a ledger. An error that renders as an
 * empty table reads as "there is nothing here", which is the one answer that
 * must never be given by accident.
 */
export function ErrorNote({
  message,
  onRetry,
  retryLabel,
}: {
  message: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.08)] px-4 py-3 text-sm text-[hsl(var(--color-destructive))]"
    >
      <p>{message}</p>
      {onRetry ? (
        <Button variant="ghost" size="sm" className="mt-2" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}

/* ─── Vocabulary ──────────────────────────────────────────────────────────── */

/**
 * These screens talk about money, so they say "good" and "bad", not
 * "success" and "destructive". The translation to the project's variant names
 * lives here once instead of in every view.
 */
const BADGE_VARIANT = {
  neutral: 'outline',
  good: 'success',
  warn: 'warning',
  bad: 'destructive',
  info: 'secondary',
} as const

export type Tone = keyof typeof BADGE_VARIANT

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: string
  children: React.ReactNode
}) {
  return <UiBadge variant={BADGE_VARIANT[tone as Tone] ?? 'outline'}>{children}</UiBadge>
}

const BUTTON_VARIANT = {
  primary: 'default',
  quiet: 'outline',
  danger: 'destructive',
} as const

export function ActionButton({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANT
}) {
  return (
    <Button variant={BUTTON_VARIANT[variant]} className={className} {...props}>
      {children}
    </Button>
  )
}

/* ─── Fields ──────────────────────────────────────────────────────────────── */

/**
 * A money field. Holds MINOR units; the person types major ones.
 *
 * The conversion happens once, here, on the way in — so nothing downstream
 * ever holds a fraction of an afghani.
 */
export function MinorInput({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number
  onChange: (minor: number) => void
  label: string
  disabled?: boolean
}) {
  return (
    <Input
      label={label}
      type="number"
      inputMode="decimal"
      dir="ltr"
      disabled={disabled}
      className="tabular-nums"
      value={Number.isFinite(value) ? value / 100 : 0}
      onChange={(event) => {
        const major = Number(event.target.value)
        onChange(Number.isFinite(major) ? Math.round(major * 100) : 0)
      }}
    />
  )
}

/**
 * A choice, on the project's own Select, with a label above it.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ THE CONTROL ITSELF LIVES IN `../select-field`. THIS IS THE LABEL WRAPPER.
 *
 * It used to render its own Radix structure. That was a second implementation
 * of the same control, and it had a defect the shared one exists to fix:
 * Radix throws on a `SelectItem` whose value is the empty string, and `''` is
 * what every filter dropdown in this product uses for «همه». Passing such an
 * option here crashed the page when the list opened.
 *
 * Two components with one purpose is the parallel-architecture guardrail, so
 * this one keeps only what is actually its own — the label — and delegates
 * the control.
 */
export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label className="text-sm font-medium text-[hsl(var(--fg-primary))]">{label}</label>
      ) : null}
      <SharedSelectField
        value={value}
        onChange={onChange}
        options={options}
        {...(placeholder ? { placeholder } : {})}
        {...(disabled ? { disabled } : {})}
      />
    </div>
  )
}

/**
 * A whole-number field — a quantity, an hour count, a number of periods.
 *
 * Clamping happens here rather than in each view, because the clamp is the
 * rule: a quantity below `min` is not a smaller quantity, it is a typo, and
 * eight views clamping it their own way is eight chances for one of them to
 * let a negative through into a stock movement.
 */
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  disabled,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
}) {
  return (
    <Input
      label={label}
      type="number"
      inputMode="numeric"
      dir="ltr"
      min={min}
      max={max}
      disabled={disabled}
      className="tabular-nums"
      value={Number.isFinite(value) ? value : min}
      onChange={(event) => {
        const parsed = Number(event.target.value)
        if (!Number.isFinite(parsed)) return onChange(min)

        const floored = Math.max(min, Math.trunc(parsed))
        onChange(max === undefined ? floored : Math.min(max, floored))
      }}
    />
  )
}

/** A plain text field, so a view never hand-rolls an input. */
export function Field({
  label,
  value,
  onChange,
  disabled,
  type = 'text',
  dir,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  type?: string
  dir?: 'ltr' | 'rtl'
}) {
  return (
    <Input
      label={label}
      type={type}
      dir={dir}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

/* ─── Page shell ──────────────────────────────────────────────────────────── */

/**
 * A capability screen's title, with a link to its documentation.
 *
 * ⚠️ THE «?» IS DETECTED, NOT DECLARED.
 *
 * Thirty screens render through this header and NONE of them had to change:
 * `DocsHelpLink` reads the route and the locale itself and looks the article
 * up in one table. Threading props through thirty callers would have been
 * thirty chances to forget one, and a permanent invitation for a new screen to
 * ship without the link. A route with no article shows no icon at all.
 *
 * The link is contextual: `/docs/inventory` from the warehouse screen, never
 * a generic `/docs`. A help hub makes the reader search for their own question
 * again on arrival.
 */
export function CapabilityHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    // Same treatment as the invoices list header: title and action share one
    // row at every width, so on mobile the action sits opposite the title
    // instead of pushing the content down.
    <header className="flex flex-row items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h1 className="flex items-center gap-1.5 text-xl font-bold text-[hsl(var(--fg-primary))] sm:text-2xl lg:text-3xl">
          <span className="truncate">{title}</span>
          {/* Reads the route itself — see DocsHelpLink. A route with no
              documentation article renders nothing. */}
          <DocsHelpLink />
        </h1>
        <p className="text-xs text-[hsl(var(--fg-secondary))] sm:text-sm">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap justify-end gap-2">{action}</div> : null}
    </header>
  )
}

/**
 * The outer shell of a capability screen.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ T3 — THIS USED TO ADD ITS OWN WIDTH AND PADDING, AND THAT WAS THE
 * MISMATCH THE OWNER REPORTED.
 *
 * It was:
 *
 *     mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6
 *
 * Two problems, both structural rather than stylistic:
 *
 *   · `p-4 sm:p-6` sat INSIDE `<main className="... p-4 ...">`, so every
 *     capability screen carried double padding and started further from the
 *     edge than every other page.
 *   · `max-w-5xl mx-auto` centred the content in a narrow column while
 *     /invoices, /warehouse and the rest run the full width of the shell. On a
 *     wide monitor the difference is unmissable, and it is what «ظاهرشان با
 *     بقیه‌ی داشبورد یکی نیست» describes.
 *
 * The spacing now matches what the mainstream pages use — `invoices-view` and
 * `warehouse-view` both open with exactly this — so the layout owns the frame
 * and the page owns its rhythm.
 */
export function CapabilityPage({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5 sm:space-y-6">{children}</div>
}

/**
 * A titled list on a capability screen: heading, optional hint, then the
 * shared `DataTable` as its child.
 *
 * Not a `Panel`: `DataTable` already draws its own bordered surface, the way
 * the invoices list does, and a card around it would be a border inside a
 * border.
 */
export function ListSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string | undefined
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))] sm:text-lg">
            {title}
          </h2>
          {description ? (
            <p className="text-xs text-[hsl(var(--fg-tertiary))] sm:text-sm">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/* ─── Re-exports ──────────────────────────────────────────────────────────── */
//
// So a view importing from this kit reaches the PROJECT's table and empty
// state rather than writing a bare `<table>`. One import site, and every
// screen gets the same header treatment, hover state and RTL handling.

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../table'
export { EmptyState } from '../empty-state'

// The ten mandatory states of §5, resolved by the contract package so every
// screen says the same thing when several are true at once. A view that needs
// 'forbidden', 'offline' or 'conflict' reaches for this rather than inventing
// a fifth vocabulary for them.
