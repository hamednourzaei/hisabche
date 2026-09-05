// packages/ui/src/components/ui/accounting/components/JournalEntryRow.tsx
'use client'

import { useLedgerNumber } from './ledger-table'
import { memo, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { JournalEntry, Account } from '@hisabche/api'

interface JournalEntryRowProps {
  entry: JournalEntry
  accounts: Account[]
}

function formatDate(date: string): string {
  try {
    return new Date(date).toLocaleDateString('fa-AF', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return date
  }
}

export const JournalEntryRow = memo(function JournalEntryRow({
  entry,
  accounts,
}: JournalEntryRowProps) {
  const t = useTranslations()
  const n = useLedgerNumber()
  const [isOpen, setIsOpen] = useState(false)

  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  const accountMap = useMemo(() => {
    const map = new Map<string, Account>()
    for (const acc of accounts) map.set(acc.id, acc)
    return map
  }, [accounts])

  const totals = useMemo(() => {
    const debit = entry.lines.reduce((sum, l) => sum + l.debit, 0)
    const credit = entry.lines.reduce((sum, l) => sum + l.credit, 0)
    return { debit, credit }
  }, [entry.lines])

  return (
    <div className="border-b border-[hsl(var(--border-default)/0.5)] last:border-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-2 px-2 md:px-3 lg:px-4 py-2 md:py-2.5 lg:py-3 hover:bg-[hsl(var(--surface-muted))] transition-colors text-start"
      >
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <span className="shrink-0 whitespace-nowrap text-xs text-[hsl(var(--fg-tertiary))]">
            {formatDate(entry.date)}
          </span>
          <span className="truncate text-sm font-medium text-[hsl(var(--fg-primary))]">
            {entry.description}
          </span>
          {entry.reference && (
            <span className="hidden shrink-0 text-xs text-[hsl(var(--fg-tertiary))] md:inline">
              #{entry.reference}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
            {n(totals.debit, 'zero')}
          </span>
          <ChevronDown
            className={cn(
              'size-3.5 md:size-4 text-[hsl(var(--fg-tertiary))] transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </div>
      </button>

      {isOpen && (
        <div className="px-2 md:px-3 lg:px-4 pb-2 md:pb-3">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-[hsl(var(--fg-tertiary))]">
                <th className="text-start font-medium py-1">{t('accounting.journal.account')}</th>
                <th className="text-end font-medium py-1">{t('accounting.journal.debit')}</th>
                <th className="text-end font-medium py-1">{t('accounting.journal.credit')}</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((line) => {
                const account = accountMap.get(line.accountId)
                return (
                  <tr key={line.id} className="text-sm">
                    <td className="py-1 text-[hsl(var(--fg-secondary))]">
                      {account ? `${account.code} - ${account.name}` : line.accountId}
                    </td>
                    <td className="py-1 text-end tabular-nums text-[hsl(var(--fg-primary))]">
                      {n(line.debit)}
                    </td>
                    <td className="py-1 text-end tabular-nums text-[hsl(var(--fg-primary))]">
                      {n(line.credit)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
})
