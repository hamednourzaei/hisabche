// packages/ui/src/components/ui/accounting/components/AccountRow.tsx
'use client'

import { memo } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '../../../../lib/utils'
import type { Account } from '@hisabche/api'

import { LedgerRow, LedgerTd } from './ledger-table'

interface AccountRowProps {
  account: Account
}

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

export const AccountRow = memo(function AccountRow({ account }: AccountRowProps) {
  const t = useTranslations()
  const tone = TYPE_TONE[account.type] ?? FALLBACK_TONE

  return (
    <LedgerRow>
      <LedgerTd mono muted>
        {account.code}
      </LedgerTd>

      <LedgerTd strong>{account.name}</LedgerTd>

      <LedgerTd>
        <span className={cn('whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium', tone)}>
          {t(`accounting.accountTypes.${account.type}`)}
        </span>
      </LedgerTd>

      <LedgerTd>
        {/*
          A dot alone carried the active/inactive state, with the meaning only
          in an aria-label. Colour is not information on its own — someone who
          cannot distinguish these two sees an identical dot either way — so the
          inactive state now says so in text.
        */}
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              'inline-block size-2 rounded-full',
              account.isActive ? 'bg-[hsl(var(--color-success))]' : 'bg-[hsl(var(--fg-tertiary))]',
            )}
          />
          {!account.isActive && (
            <span className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t('accounting.accounts.inactive')}
            </span>
          )}
          <span className="sr-only">
            {account.isActive ? t('accounting.accounts.active') : t('accounting.accounts.inactive')}
          </span>
        </span>
      </LedgerTd>
    </LedgerRow>
  )
})
