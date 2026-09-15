// packages/ui/src/components/ui/landing/chapter-visuals.tsx
//
// "Show how it works" panels for the landing chapters: a journal entry, a till
// summary, the offline pipeline, an AI answer. SERVER COMPONENTS — no hooks, no
// JavaScript, no animation (PageSpeed: mobile 99 / desktop 100 on 15 Sep 2026;
// nothing here may cost main-thread time).
//
// ⚠️ G1 — THESE ARE WORKED EXAMPLES, NOT DATA. Every panel carries a visible
// «نمونه» label and uses round illustrative figures from the message catalogue.
// What each panel SHOWS is how the product behaves (verified in code):
//   journal → a sale posts a balanced double entry (posting functions)
//   till    → receipts, payments and transfers move a till balance (POS/banking)
//   offline → desktop SQLite + sync_queue, mobile outbox, /conflicts review
//   ai      → the question is answerable from the customer_balance and
//             outstanding_invoices views the assistant can read
//
// ⚠️ DOM BUDGET. Arrows and ticks are CSS characters (::before / ::after), not
// lucide icons: every icon is an <svg> plus paths that React walks on hydration.
// With SVG marks the landing reached 1780 elements and local TBT rose
// (desktop ~120 → 215 ms). Add an icon here only where it carries meaning.
import type { ReactNode } from 'react'
import { CloudOff, MessageCircleQuestion, Sparkles, Wifi } from 'lucide-react'

import { cn } from '../../../lib/utils'

type T = (key: string, fallback?: string) => string

const PANEL =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 shadow-sm sm:p-6'

/** A success tick drawn as text. */
const TICK = "before:font-bold before:text-[hsl(var(--color-success))] before:content-['✓']"

function PanelHead({ t, title }: { t: T; title: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <p className="font-semibold text-[hsl(var(--fg-primary))]">{title}</p>
      <span className="rounded-md bg-[hsl(var(--surface-muted))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--fg-tertiary))]">
        {t('landing.visual.example')}
      </span>
    </div>
  )
}

/**
 * A chain of steps joined by reading-direction arrows (← in RTL, → in LTR,
 * as `::after` text). Wraps on phones as whole items, never mid-label.
 */
export function StepChain({ t, prefix, count }: { t: T; prefix: string; count: number }) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2.5">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="flex items-center gap-2 whitespace-nowrap after:text-[hsl(var(--fg-tertiary))] after:content-['←'] last:after:content-none ltr:after:content-['→']"
        >
          <span className="rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-2.5 py-1 text-[0.8125rem] font-medium text-[hsl(var(--fg-primary))] sm:px-3 sm:py-1.5 sm:text-sm">
            {t(`${prefix}${i + 1}`)}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function JournalVisual({ t }: { t: T }) {
  const k = 'landing.visual.journal'
  const cell = 'border-t border-[hsl(var(--border-default))] py-2.5 text-[hsl(var(--fg-primary))]'
  const empty = cn(cell, 'text-end text-[hsl(var(--fg-tertiary))]')
  const amount = t(`${k}.amount`)
  return (
    <div className={PANEL}>
      <PanelHead t={t} title={t(`${k}.title`)} />
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] text-sm tabular-nums [&>*:not(:nth-child(3n+1))]:ps-6 sm:[&>*:not(:nth-child(3n+1))]:ps-10">
        <span className="pb-2 text-xs text-[hsl(var(--fg-tertiary))]">{t(`${k}.account`)}</span>
        <span className="pb-2 text-end text-xs text-[hsl(var(--fg-tertiary))]">
          {t(`${k}.debit`)}
        </span>
        <span className="pb-2 text-end text-xs text-[hsl(var(--fg-tertiary))]">
          {t(`${k}.credit`)}
        </span>
        <span className={cell}>{t(`${k}.debitAccount`)}</span>
        <span className={cn(cell, 'text-end font-medium')}>{amount}</span>
        <span className={empty}>—</span>
        <span className={cell}>{t(`${k}.creditAccount`)}</span>
        <span className={empty}>—</span>
        <span className={cn(cell, 'text-end font-medium')}>{amount}</span>
      </div>
      <p
        className={cn(
          'mt-3 flex items-center gap-2 text-sm text-[hsl(var(--color-success))]',
          TICK,
        )}
      >
        {t(`${k}.balanced`)}
      </p>
    </div>
  )
}

export function TillVisual({ t }: { t: T }) {
  const k = 'landing.visual.till'
  const rows = ['opening', 'receipts', 'payments', 'transfer'] as const
  return (
    <div className={PANEL}>
      <PanelHead t={t} title={t(`${k}.title`)} />
      <dl className="text-sm tabular-nums">
        {rows.map((row) => (
          <div
            key={row}
            className="flex justify-between gap-4 border-b border-[hsl(var(--border-default))] py-2.5"
          >
            <dt className="text-[hsl(var(--fg-secondary))]">{t(`${k}.${row}`)}</dt>
            <dd className="font-medium text-[hsl(var(--fg-primary))]">{t(`${k}.${row}Amount`)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 pt-3 text-base">
          <dt className="font-semibold text-[hsl(var(--fg-primary))]">{t(`${k}.balance`)}</dt>
          <dd className="font-bold text-[hsl(var(--color-primary))]">{t(`${k}.balanceAmount`)}</dd>
        </div>
      </dl>
    </div>
  )
}

export function OfflineVisual({ t }: { t: T }) {
  const k = 'landing.visual.offline'
  return (
    <div className="space-y-6">
      <StepChain t={t} prefix={`${k}.pipe`} count={6} />
      <div className={cn(PANEL, 'mx-auto max-w-2xl')}>
        <PanelHead t={t} title={t(`${k}.title`)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-[hsl(var(--surface-muted)/0.6)] p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
              <CloudOff className="size-4 text-[hsl(var(--color-warning))]" aria-hidden="true" />
              {t(`${k}.off`)}
            </p>
            <ul className="space-y-1.5 text-sm text-[hsl(var(--fg-secondary))]">
              {[1, 2, 3, 4].map((i) => (
                <li key={i} className={cn('flex items-center gap-2', TICK)}>
                  {t(`${k}.action${i}`)}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-[hsl(var(--color-primary)/0.08)] p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
              <Wifi className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
              {t(`${k}.on`)}
            </p>
            <p className="text-sm text-[hsl(var(--fg-secondary))]">{t(`${k}.syncing`)}</p>
            <p
              className={cn(
                'mt-1.5 flex items-center gap-2 text-sm font-medium text-[hsl(var(--color-success))]',
                TICK,
              )}
            >
              {t(`${k}.synced`)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AiVisual({ t }: { t: T }) {
  const k = 'landing.visual.ai'
  return (
    <div className={cn(PANEL, 'mx-auto max-w-2xl')}>
      <PanelHead t={t} title={t(`${k}.title`)} />
      <p className="mb-3 flex items-start gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-3 text-sm text-[hsl(var(--fg-primary))] sm:text-base">
        <MessageCircleQuestion
          className="mt-0.5 size-5 shrink-0 text-[hsl(var(--fg-tertiary))]"
          aria-hidden="true"
        />
        {t(`${k}.question`)}
      </p>
      <div className="flex items-start gap-2 rounded-xl bg-[hsl(var(--color-primary)/0.08)] px-4 py-3">
        <Sparkles
          className="mt-0.5 size-5 shrink-0 text-[hsl(var(--color-primary))]"
          aria-hidden="true"
        />
        <p className="text-pretty text-sm leading-relaxed text-[hsl(var(--fg-primary))] sm:text-base">
          {t(`${k}.answer`)}
        </p>
      </div>
    </div>
  )
}
