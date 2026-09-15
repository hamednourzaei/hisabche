// packages/ui/src/components/ui/landing/chapter-scene.tsx
//
// One chapter of the product story: label, title, lead, then cards (or example
// questions). The landing mounts it once per chapter, in the order set by
// landing-page.tsx. SERVER COMPONENT — never hydrated.
//
// ⚠️ EVERY CARD NAMES SOMETHING THE CODE DOES (audit of 15 Sep 2026):
//   ledger    → posting functions keep debit = credit; /trial-balance
//   money     → /aging/:kind (receivable | payable), POS till, banking service
//   inventory → stock_movements, /api/products/low-stock, warehouse transfers
//   offline   → apps/desktop SQLite + sync engine + /conflicts review
//   reports   → /income-statement, /cash-flow, aging, low-stock, budgeting
//   ai        → ai-chat.service reads ONLY four reporting views
//               (sales_summary, customer_balance, inventory_summary,
//               outstanding_invoices) — the example questions stay inside them
//   multi     → workspaces per user, /api/branch, consolidated reports
// A planned feature is not a card. Remove the card before shipping a claim.
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  CircleDollarSign,
  ClipboardList,
  Landmark,
  MessageCircleQuestion,
  PackageMinus,
  PiggyBank,
  RefreshCw,
  Repeat,
  Scale,
  Store,
  TrendingUp,
  UsersRound,
  WalletCards,
  WifiOff,
} from 'lucide-react'

import { cn } from '../../../lib/utils'
import { LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'

export const CHAPTERS = {
  ledger: { cards: [BookOpen, WalletCards, BarChart3] as LucideIcon[], chips: 0, examples: 0 },
  money: {
    cards: [ArrowDownToLine, ArrowUpFromLine, CircleDollarSign] as LucideIcon[],
    chips: 4,
    examples: 0,
  },
  inventory: { cards: [Boxes, PackageMinus, Repeat] as LucideIcon[], chips: 0, examples: 0 },
  offline: { cards: [WifiOff, RefreshCw, Scale] as LucideIcon[], chips: 0, examples: 0 },
  reports: {
    cards: [TrendingUp, Landmark, ArrowDownToLine, Boxes, PiggyBank] as LucideIcon[],
    chips: 0,
    examples: 0,
  },
  ai: { cards: [] as LucideIcon[], chips: 0, examples: 4 },
  multi: { cards: [Store, Building2, UsersRound] as LucideIcon[], chips: 0, examples: 0 },
} as const

export type ChapterKey = keyof typeof CHAPTERS

export interface ChapterSceneProps {
  t: (key: string, fallback?: string) => string
  chapter: ChapterKey
  /** Alternate grounds so consecutive chapters read as separate sections. */
  muted?: boolean | undefined
}

export default function ChapterScene({ t, chapter, muted }: ChapterSceneProps) {
  const { cards, chips, examples } = CHAPTERS[chapter]
  const k = `landing.chapter.${chapter}`

  return (
    <section
      id={chapter}
      className={cn(LANDING_SECTION, muted && 'bg-[hsl(var(--surface-muted)/0.3)]')}
    >
      <div className={LANDING_CONTAINER}>
        {chapter === 'offline' && (
          <p className="mb-3 text-center">
            <span className="rounded-full border border-[hsl(var(--color-primary)/0.35)] px-3 py-1 font-mono text-xs font-semibold tracking-wider text-[hsl(var(--color-primary))]">
              {t(`${k}.badge`)}
            </span>
          </p>
        )}
        <SectionHeader
          label={t(`${k}.label`)}
          title={t(`${k}.title`)}
          description={t(`${k}.desc`)}
        />

        {cards.length > 0 && (
          <ul
            className={cn(
              'grid grid-cols-1 gap-3 sm:gap-4',
              cards.length === 5 ? 'sm:grid-cols-2 lg:grid-cols-5' : 'sm:grid-cols-3',
            )}
          >
            {cards.map((Icon, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.6)] p-4 sm:flex-col sm:p-5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))] sm:size-10">
                  <Icon className="size-[1.125rem] sm:size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="mb-1 font-semibold text-[hsl(var(--fg-primary))]">
                    {t(`${k}.card${i + 1}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
                    {t(`${k}.card${i + 1}.desc`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {chips > 0 && (
          <ul className="mt-5 flex flex-wrap justify-center gap-2 sm:mt-6">
            {Array.from({ length: chips }, (_, i) => (
              <li
                key={i}
                className="rounded-full border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-1 text-sm text-[hsl(var(--fg-secondary))]"
              >
                {t(`${k}.chip${i + 1}`)}
              </li>
            ))}
          </ul>
        )}

        {examples > 0 && (
          <ul className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
            {Array.from({ length: examples }, (_, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.6)] p-4"
              >
                <MessageCircleQuestion
                  className="mt-0.5 size-5 shrink-0 text-[hsl(var(--color-primary))]"
                  aria-hidden="true"
                />
                <q className="text-sm text-[hsl(var(--fg-primary))] sm:text-base">
                  {t(`${k}.example${i + 1}`)}
                </q>
              </li>
            ))}
            <li className="flex items-center gap-2 text-sm text-[hsl(var(--fg-tertiary))] sm:col-span-2 sm:justify-center">
              <ClipboardList className="size-4 shrink-0" aria-hidden="true" />
              {t(`${k}.note`)}
            </li>
          </ul>
        )}
      </div>
    </section>
  )
}
