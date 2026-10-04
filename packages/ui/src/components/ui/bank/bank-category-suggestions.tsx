'use client'

// ============================================
// «حساب پیشنهادی» for the unmatched lines of a bank statement (#62).
//
// For each line nobody has matched yet: the account lines like it have usually
// been recorded in — learned from THIS business's own confirmed
// reconciliations, shown with how many past lines it rests on.
//
// ⚠️ A suggestion, never a posting. Nothing here writes; the person records the
// entry. «Not enough history» and «history is split» are said as such — a line
// is never given an account by guesswork.
// ============================================

import { useTranslations } from 'next-intl'
import { formatNumber } from '@hisabche/formatting'
import { useBankCategorySuggestions } from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'

export const BANK_CATEGORY_VERDICTS = [
  'categorized',
  'insufficient_history',
  'ambiguous',
  'no_pattern',
] as const

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'
const th = 'px-3 py-2.5 text-start text-xs font-medium text-[hsl(var(--fg-secondary))]'
const td = 'px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))]'

export function BankCategorySuggestions({ statementId }: { statementId: string }) {
  const t = useTranslations('bank')
  const locale = useIntlLocale()
  const { date } = useDateFormat()
  const suggestions = useBankCategorySuggestions(statementId)

  return (
    <section className="space-y-2">
      <header>
        <h3 className="font-semibold text-[hsl(var(--fg-primary))]">{t('category_title')}</h3>
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('category_hint')}</p>
      </header>

      {suggestions.isLoading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
      ) : suggestions.error || !suggestions.data ? (
        <p role="alert" className={cn(card, 'p-4 text-sm text-[hsl(var(--color-destructive))]')}>
          {t('category_failed')}
        </p>
      ) : suggestions.data.lines.length === 0 ? (
        <p className={cn(card, 'p-4 text-sm text-[hsl(var(--fg-secondary))]')}>
          {t('category_none_open')}
        </p>
      ) : (
        <>
          {suggestions.data.historySize === 0 ? (
            // Nothing to learn from yet: say so once, instead of «not enough
            // history» on every row with no explanation of how to get some.
            <p className={cn(card, 'p-3 text-xs text-[hsl(var(--fg-secondary))]')}>
              {t('category_no_history')}
            </p>
          ) : null}
          <div className={cn(card, 'overflow-x-auto')}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                  <th className={th}>{t('category_date')}</th>
                  <th className={th}>{t('category_line')}</th>
                  <th className={th}>{t('category_amount')}</th>
                  <th className={th}>{t('category_account')}</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.data.lines.map((line) => {
                  const verdict = line.verdict
                  return (
                    <tr key={line.lineId} className="border-b border-[hsl(var(--border-default))]">
                      <td className={td}>{date(line.onDate)}</td>
                      <td className={cn(td, 'max-w-[18rem] truncate')} dir="auto">
                        {line.description}
                      </td>
                      <td className={cn(td, 'tabular-nums')} dir="ltr">
                        {formatNumber(line.amountMinor / 100, locale, 2)}
                      </td>
                      <td className={td}>
                        {verdict.kind === 'categorized' ? (
                          <>
                            <span className="font-medium">{verdict.suggestion.accountName}</span>
                            <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                              {t('category_evidence', {
                                share: formatNumber(
                                  Math.round(verdict.suggestion.confidence * 100),
                                  locale,
                                  0,
                                ),
                                count: formatNumber(verdict.suggestion.sampleSize, locale, 0),
                              })}
                            </span>
                          </>
                        ) : verdict.kind === 'ambiguous' ? (
                          <span className="text-xs text-[hsl(var(--fg-secondary))]">
                            {t('category_ambiguous')}{' '}
                            {verdict.candidates
                              .map((candidate) => candidate.accountName)
                              .join(' / ')}
                          </span>
                        ) : verdict.kind === 'insufficient_history' ? (
                          <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                            {t('category_insufficient', {
                              count: formatNumber(verdict.sampleSize, locale, 0),
                              minimum: formatNumber(verdict.minimum, locale, 0),
                            })}
                          </span>
                        ) : (
                          <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                            {t('category_no_pattern')}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
