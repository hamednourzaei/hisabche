// packages/ui/src/components/ui/landing/chapter-scene.tsx
//
// One chapter of the product story: a numbered masthead, a "how it works" panel
// where one exists, then cards (or example questions). The landing mounts it
// once per chapter, in the order set by landing-page.tsx.
// SERVER COMPONENT — never hydrated.
//
// ⚠️ EVERY CARD NAMES SOMETHING THE CODE DOES (audit of 15 Sep 2026):
//   ledger    → posting functions keep debit = credit; /trial-balance
//   money     → /aging/:kind (receivable | payable), POS till, banking service
//   inventory → stock_movements, /api/products/low-stock, warehouse transfers
//   offline   → apps/desktop SQLite + sync engine, mobile outbox, /conflicts
//   reports   → /income-statement, /cash-flow, aging, low-stock, budgeting
//   ai        → ai-chat.service reads ONLY four reporting views
//               (sales_summary, customer_balance, inventory_summary,
//               outstanding_invoices) — the example questions stay inside them
//   multi     → workspaces per user, /api/branch, consolidated reports
// A planned feature is not a card. Remove the card before shipping a claim.
//
// Typography: titles `text-balance`, body `text-pretty` — no ragged
// "staircase" lines in Persian text.
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  CircleDollarSign,
  Landmark,
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

import NextLink from 'next/link'

import { cn } from '../../../lib/utils'
import { AiVisual, JournalVisual, OfflineVisual, StepChain, TillVisual } from './chapter-visuals'
import {
  CardAccent,
  LANDING_CARD,
  LANDING_CHIP,
  LANDING_CONTAINER,
  LANDING_SECTION,
  LANDING_TYPE,
  SectionHeader,
} from './landing-primitives'

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

/**
 * The docs article that explains each chapter in depth. An in-content link with
 * the article's own title as anchor text — the Mizfa report found the landing
 * body had no path to the deeper guides.
 */
const GUIDE: Record<ChapterKey, string> = {
  ledger: 'accounting',
  money: 'pos',
  inventory: 'inventory',
  offline: 'offline',
  reports: 'accounting',
  ai: 'assistant',
  multi: 'branches',
}

export interface ChapterSceneProps {
  t: (key: string, fallback?: string) => string
  chapter: ChapterKey
  /** Alternate grounds so consecutive chapters read as separate sections. */
  muted?: boolean | undefined
  /** Locale segment for the guide link. */
  localePrefix: string
  /** Chapter number of this section on the page (`02`). */
  index?: string | undefined
}

export default function ChapterScene({
  t,
  chapter,
  muted,
  localePrefix,
  index,
}: ChapterSceneProps) {
  const { cards, chips, examples } = CHAPTERS[chapter]
  const k = `landing.chapter.${chapter}`
  // Chapters with a side panel put cards and panel side by side on desktop.
  const side = chapter === 'ledger' || chapter === 'money'

  const cardList = cards.length > 0 && (
    <ul
      className={cn(
        'grid grid-cols-1 gap-3',
        side
          ? 'sm:grid-cols-3 lg:grid-cols-1'
          : cards.length === 5
            ? 'sm:grid-cols-2 lg:grid-cols-5'
            : 'sm:grid-cols-3',
      )}
    >
      {cards.map((Icon, i) => (
        <li
          key={i}
          className={cn(
            'group flex gap-4 p-4 sm:p-5',
            LANDING_CARD,
            'transition-colors duration-300 hover:bg-[hsl(var(--surface-elevated))]',
            side && 'lg:items-start',
          )}
        >
          <CardAccent />
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]">
                <Icon className="size-[1.125rem]" aria-hidden="true" />
              </span>
              <span className="font-mono text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="mb-1 text-balance text-base font-bold text-[hsl(var(--fg-primary))]">
                {t(`${k}.card${i + 1}.title`)}
              </h3>
              <p className={cn('text-pretty text-[hsl(var(--fg-secondary))]', LANDING_TYPE.body)}>
                {t(`${k}.card${i + 1}.desc`)}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )

  return (
    <section
      id={chapter}
      className={cn(LANDING_SECTION, muted && 'bg-[hsl(var(--surface-muted)/0.25)]')}
    >
      <div className={LANDING_CONTAINER}>
        <SectionHeader
          index={index}
          label={
            chapter === 'offline' ? (
              <span className="flex items-center gap-2">
                {t(`${k}.label`)}
                <span className="rounded-sm border border-[hsl(var(--color-primary)/0.35)] px-1.5 py-0.5 font-mono text-xs font-semibold text-[hsl(var(--color-primary))]">
                  {t(`${k}.badge`)}
                </span>
              </span>
            ) : (
              t(`${k}.label`)
            )
          }
          title={t(`${k}.title`)}
          description={t(`${k}.desc`)}
        />

        {side ? (
          <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-8">
            {chapter === 'ledger' ? <JournalVisual t={t} /> : <TillVisual t={t} />}
            {cardList}
          </div>
        ) : (
          <>
            {chapter === 'inventory' && (
              <div className="mb-8 border-y border-[hsl(var(--border-default))] py-6 sm:mb-10">
                <StepChain t={t} prefix={`${k}.flow`} count={6} />
              </div>
            )}
            {chapter === 'offline' && (
              <div className="mb-8 flex justify-center sm:mb-10">
                <OfflineVisual t={t} />
              </div>
            )}
            {chapter === 'ai' && (
              <div className="mb-8 flex justify-center sm:mb-10">
                <AiVisual t={t} />
              </div>
            )}
            {cardList}
          </>
        )}

        {chapter === 'ledger' && (
          <p
            className={cn(
              'mx-auto mt-8 max-w-2xl text-balance text-center font-semibold text-[hsl(var(--fg-primary))]',
              LANDING_TYPE.lead,
            )}
          >
            {t(`${k}.tagline`)}
          </p>
        )}

        {chips > 0 && (
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {Array.from({ length: chips }, (_, i) => (
              <li key={i} className={LANDING_CHIP}>
                {t(`${k}.chip${i + 1}`)}
              </li>
            ))}
          </ul>
        )}

        {examples > 0 && (
          <>
            <ul className="mx-auto mt-6 grid max-w-3xl gap-2 sm:grid-cols-2">
              {Array.from({ length: examples }, (_, i) => (
                <li
                  key={i}
                  className={cn(
                    LANDING_CARD,
                    'flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--fg-secondary))]',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="font-mono text-xs text-[hsl(var(--color-primary))]"
                  >
                    ?
                  </span>
                  <span className="text-pretty">{t(`${k}.example${i + 1}`)}</span>
                </li>
              ))}
            </ul>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-center text-sm text-[hsl(var(--fg-tertiary))]">
              {t(`${k}.note`)}
            </p>
          </>
        )}

        <p className="mt-8 text-center text-sm">
          <NextLink
            prefetch={false}
            href={`/${localePrefix}/docs/${GUIDE[chapter]}`}
            className="inline-flex items-center gap-1.5 font-medium text-[hsl(var(--color-primary))] after:content-['←'] hover:underline ltr:after:content-['→']"
          >
            {t('landing.chapter.guide')} {t(`docs.${GUIDE[chapter]}.title`)}
          </NextLink>
        </p>
      </div>
    </section>
  )
}
