'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Inbox } from 'lucide-react'
import { Button, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * The small vocabulary every admin screen shares: a filter pill, a status dot,
 * a section card, and the three states a list can be in.
 *
 * These are COMPOSITIONS, not new primitives — `Button` and `Skeleton` still
 * come from `@hisabche/ui`. The point is that "selected filter", "empty list"
 * and "load failed" look identical on every screen, which is what makes three
 * separate pages read as one console.
 */

/* ─── Filter pill ─────────────────────────────────────────────────────────── */

export function FilterPill({
  selected,
  onClick,
  children,
  /** Optional status dot rendered before the label. */
  tone,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  tone?: StatusTone
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // `aria-pressed` rather than a role hack: this is a toggle, and a screen
      // reader must be able to tell the selected filter from the rest without
      // seeing the blue fill.
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected
          ? 'border-blue-500 bg-blue-500 text-white'
          : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground',
      )}
    >
      {tone && <StatusDot tone={tone} muted={selected} />}
      {children}
    </button>
  )
}

/* ─── Status dot ──────────────────────────────────────────────────────────── */

export type StatusTone = 'positive' | 'attention' | 'negative' | 'neutral'

const TONE_CLASS: Record<StatusTone, string> = {
  positive: 'bg-success',
  attention: 'bg-warning',
  negative: 'bg-destructive',
  neutral: 'bg-muted-foreground',
}

/**
 * Colour alone is never the message: every dot in this app sits next to its
 * own text label, so a red/green distinction is redundant reinforcement rather
 * than the only signal. `aria-hidden` keeps it out of the accessibility tree
 * for exactly that reason.
 */
export function StatusDot({ tone, muted = false }: { tone: StatusTone; muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn('h-2 w-2 shrink-0 rounded-full', muted ? 'bg-white/80' : TONE_CLASS[tone])}
    />
  )
}

/* ─── Section card ────────────────────────────────────────────────────────── */

export function Panel({
  className,
  children,
  // Narrow on purpose: a panel is either standalone or a list item. An open
  // `ElementType` would let a caller nest a <button> inside a <button>.
  as: Tag = 'div',
}: {
  className?: string
  children: ReactNode
  as?: 'div' | 'li' | 'section' | 'article'
}) {
  return <Tag className={cn('rounded-2xl border border-border bg-card', className)}>{children}</Tag>
}

/* ─── States ──────────────────────────────────────────────────────────────── */

export function ListSkeleton({ rows = 5, height = 'h-20' }: { rows?: number; height?: string }) {
  return (
    <ul aria-hidden="true" className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index}>
          <Skeleton className={cn('w-full rounded-2xl', height)} />
        </li>
      ))}
    </ul>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
        <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations()
  return (
    // `role="alert"` so the failure is announced rather than only drawn.
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-destructive">{message}</span>
      <Button size="sm" variant="outline" className="min-h-[44px]" onClick={onRetry}>
        {t('admin.error.retry')}
      </Button>
    </div>
  )
}

/* ─── Pagination ──────────────────────────────────────────────────────────── */

export function Pagination({
  page,
  pageSize,
  total,
  busy,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  busy: boolean
  onPage: (page: number) => void
}) {
  const t = useTranslations()
  if (total <= pageSize) return null

  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min((page + 1) * pageSize, total)

  return (
    <nav
      aria-label={t('admin.pagination.label')}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <span className="text-sm text-muted-foreground">
        {t('admin.pagination.showing', { from, to, total })}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="min-h-[44px] rounded-xl"
          disabled={page === 0 || busy}
          onClick={() => onPage(Math.max(0, page - 1))}
        >
          {t('admin.pagination.previous')}
        </Button>
        <Button
          variant="outline"
          className="min-h-[44px] rounded-xl"
          disabled={to >= total || busy}
          onClick={() => onPage(page + 1)}
        >
          {t('admin.pagination.next')}
        </Button>
      </div>
    </nav>
  )
}
