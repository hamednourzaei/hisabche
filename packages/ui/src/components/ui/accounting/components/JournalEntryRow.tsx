// packages/ui/src/components/ui/accounting/components/JournalEntryRow.tsx
'use client'

import { useLedgerNumber } from './ledger-table'
import { memo, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { formatDate as formatIntlDate } from '@hisabche/formatting'

import { cn } from '../../../../lib/utils'
import { useDateFormat } from '../../../../hooks/use-date-format'
import { routeForEntity } from '../../../../lib/entity-route'
import type { JournalEntry, Account } from '@hisabche/api'
import { useLocalePush } from '../../../../hooks/use-locale-push'

interface JournalEntryRowProps {
  entry: JournalEntry
  accounts: Account[]
}

// ⚠️ THE CALENDAR IS NOT A CONSTANT. This was pinned to `'fa-AF'`, so an
// English reader got the Afghan solar calendar in Persian digits and an
// Iranian Persian reader got «سنبله» where their own calendar says «شهریور» —
// the right calendar with the wrong month names, which reads as a typo rather
// than a bug and so was never reported as one. It follows the UI language now.
function formatDate(date: string, lang: string): string {
  try {
    return formatIntlDate(date, lang, {
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
  // The reader's calendar — see the helper above.
  const { lang } = useDateFormat()

  const push = useLocalePush()
  const n = useLedgerNumber()
  const [isOpen, setIsOpen] = useState(false)

  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  // next-intl's `t` takes VALUES as its second argument, not a fallback — a
  // missing key returns the key itself. The source labels below are new, so
  // they need a real fallback or an untranslated locale shows «entity.invoice».
  const safeT = useCallback(
    (key: string, fallback: string) => {
      const value = t(key as never)
      return value && value !== key ? value : fallback
    },
    [t],
  )

  // H3 — where the document that produced this entry lives, or `null`.
  const sourceRoute = useMemo(
    () =>
      entry.sourceType && entry.sourceId ? routeForEntity(entry.sourceType, entry.sourceId) : null,
    [entry.sourceType, entry.sourceId],
  )

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
            {formatDate(entry.date, lang)}
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

          {/* H3 — the source document.
              `sourceType`/`sourceId` have been on this entry since the ledger
              port was written and were never rendered, so an expanded entry
              showed its arithmetic and not what caused it. `routeForEntity`
              answers `null` for a manual entry, which then correctly shows a
              label instead of a link. */}
          {entry.sourceType && entry.sourceType !== 'manual' ? (
            <div className="mt-2 border-t border-[hsl(var(--border-default)/0.5)] pt-2">
              {sourceRoute ? (
                <button
                  type="button"
                  onClick={() => push(sourceRoute)}
                  className="rounded text-xs text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
                >
                  {safeT('accounting.journal.openSource', 'مشاهده سند مبدأ')} —{' '}
                  {safeT(`entity.${entry.sourceType}`, entry.sourceType)}
                </button>
              ) : (
                <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {safeT('accounting.journal.source', 'مبدأ')}: {entry.sourceType}
                </span>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
})
