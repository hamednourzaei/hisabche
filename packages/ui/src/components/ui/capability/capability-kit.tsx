'use client'

// ============================================
// packages/ui/src/components/ui/capability/capability-kit.tsx
//
// The small shared surface behind the six Tier 1/2 screens — till, assets,
// bank, budgets, timesheets, expiry.
//
// ---------------------------------------------------------------------------
// WHY THESE SIX SHARE A KIT
//
// They are all money screens built on the same server contract: integers in
// minor units, a state that is one of a fixed few, and a figure that is only
// meaningful next to the figure it is being compared against. Six private
// copies of `amountMinor / 100` is six chances for one of them to round.
//
// `Money` and `MinorInput` are the only places in these screens that cross
// between minor and major units. Nothing else sees a float.
// ============================================

import React from 'react'
import { cn } from '../../../lib/utils'
import { formatSelectedMoney, formatSelectedAmount } from '../../../lib/money-display'

/* ─── Money ───────────────────────────────────────────────────────────────── */

/**
 * A figure the server sent in minor units.
 *
 * `signed` shows an explicit + on positives — used where the sign IS the
 * meaning (a variance, a gain or loss, a reconciliation difference), and left
 * off where a bare amount reads better.
 */
export const Money = React.memo(function Money({
  minor,
  signed = false,
  tone,
  className,
}: {
  minor: number
  signed?: boolean
  /** 'auto' colours by sign; otherwise say it explicitly. */
  tone?: 'auto' | 'good' | 'bad' | 'muted'
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
        resolved === 'muted' && 'text-[hsl(var(--muted-foreground))]',
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
  const whole = Math.trunc(Math.abs(minutes))
  const hours = Math.floor(whole / 60)
  const rest = whole % 60
  const sign = minutes < 0 ? '-' : ''
  return `${sign}${formatSelectedAmount(hours)}:${String(rest).padStart(2, '0')}`
}

/* ─── Layout ──────────────────────────────────────────────────────────────── */

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
    <section
      className={cn(
        'rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5',
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{description}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/** A labelled figure. `hint` carries the comparison the figure needs. */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-[hsl(var(--muted)/0.4)] px-4 py-3">
      <div className="text-xs text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className="mt-1 text-lg">{value}</div>
      {hint ? (
        <div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{hint}</div>
      ) : null}
    </div>
  )
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
}

/* ─── States ──────────────────────────────────────────────────────────────── */

export function Loading({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">{label}</div>
  )
}

/**
 * A failure, said out loud.
 *
 * These screens read from and post to a ledger. An error that renders as an
 * empty table reads as "there is nothing here", which is the one answer that
 * is never safe to give by accident.
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
    <div className="rounded-xl border border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.08)] px-4 py-3 text-sm text-[hsl(var(--color-destructive))]">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-2 underline underline-offset-4">
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}

const BADGE_TONES: Record<string, string> = {
  neutral: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  good: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  warn: 'bg-[hsl(var(--color-warning)/0.14)] text-[hsl(var(--color-warning))]',
  bad: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
  info: 'bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))]',
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        BADGE_TONES[tone] ?? BADGE_TONES.neutral,
      )}
    >
      {children}
    </span>
  )
}

/* ─── Actions ─────────────────────────────────────────────────────────────── */

export function ActionButton({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'quiet' | 'danger'
}) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50',
        variant === 'primary' &&
          'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90',
        variant === 'quiet' &&
          'border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)]',
        variant === 'danger' && 'bg-[hsl(var(--color-destructive))] text-white hover:opacity-90',
        className,
      )}
    >
      {children}
    </button>
  )
}

export const inputClass =
  'w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm'

/** A money field. Holds minor units; the person types major ones. */
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
    <label className="block">
      <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        dir="ltr"
        disabled={disabled}
        value={Number.isFinite(value) ? value / 100 : 0}
        onChange={(event) => {
          const major = Number(event.target.value)
          // Rounded here, once, on the way in. Everything downstream is an
          // integer, so nothing accumulates a fraction of an afghani.
          onChange(Number.isFinite(major) ? Math.round(major * 100) : 0)
        }}
        className={cn(inputClass, 'mt-1 tabular-nums')}
      />
    </label>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

/** A page heading shared by all six screens. */
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
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">{title}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{description}</p>
      </div>
      {action}
    </header>
  )
}

export function CapabilityPage({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">{children}</div>
}
