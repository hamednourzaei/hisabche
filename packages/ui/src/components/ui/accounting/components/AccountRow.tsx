// packages/ui/src/components/ui/accounting/components/AccountRow.tsx
'use client'

// The two cells of an account that carry meaning beyond their text — its type
// and whether it is active. The chart of accounts is the shared DataTable now;
// these are what its columns render.

import { memo } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '../../../../lib/utils'
import type { Account } from '@hisabche/api'

/**
 * ⚠️ TOKENS, NOT RAW TAILWIND COLOURS.
 *
 * These were `text-blue-500 bg-blue-500/10`, rose, purple, emerald and amber —
 * five palette colours that appear in no theme file, do not respond to the
 * light/dark switch, and cannot be changed anywhere central.
 *
 * The replacement is not five tokens for five types, because the five account
 * types are not five unrelated things. They are the two sides of the accounting
 * identity plus the two halves of the income statement:
 *
 *   asset      what the business HAS        → primary
 *   liability  what it OWES                 → destructive
 *   equity     the residual                 → neutral
 *   revenue    money earned                 → success
 *   expense    money spent                  → warning
 *
 * Someone reading the chart of accounts learns the shape of the books from the
 * colour, instead of learning five arbitrary hues.
 */
const TYPE_TONE: Record<string, string> = {
  asset: 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]',
  liability: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
  equity: 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
  revenue: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  expense: 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
}

const FALLBACK_TONE = 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-tertiary))]'

/** The account types, in the order of the accounting identity. */
export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const

export const AccountTypeBadge = memo(function AccountTypeBadge({
  type,
}: {
  type: Account['type']
}) {
  const t = useTranslations()
  return (
    <span
      className={cn(
        'whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium',
        TYPE_TONE[type] ?? FALLBACK_TONE,
      )}
    >
      {t(`accounting.accountTypes.${type}`)}
    </span>
  )
})

/**
 * A dot alone carried the active/inactive state, with the meaning only in an
 * aria-label. Colour is not information on its own — someone who cannot
 * distinguish these two sees an identical dot either way — so the inactive
 * state says so in text.
 */
export const AccountStatusMark = memo(function AccountStatusMark({
  isActive,
}: {
  isActive: boolean
}) {
  const t = useTranslations()
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn(
          'inline-block size-2 rounded-full',
          isActive ? 'bg-[hsl(var(--color-success))]' : 'bg-[hsl(var(--fg-tertiary))]',
        )}
      />
      {!isActive && (
        <span className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t('accounting.accounts.inactive')}
        </span>
      )}
      <span className="sr-only">
        {isActive ? t('accounting.accounts.active') : t('accounting.accounts.inactive')}
      </span>
    </span>
  )
})
