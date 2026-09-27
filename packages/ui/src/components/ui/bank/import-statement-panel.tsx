'use client'

// ============================================
// packages/ui/src/components/ui/bank/import-statement-panel.tsx
//
// A bank's CSV export → a statement to reconcile. Props only.
//
// The bank screen's empty state said «import a statement to begin» while no
// screen could import one — the endpoint and the hook existed, nothing called
// them (راهنمای سشن §۷٫۱). This is that caller.
//
// ⚠️ Nothing is sent while a single row is unreadable. A statement missing one
// withdrawal reconciles to a balance that is wrong and looks right; the person
// is shown the row instead, and fixes the file.
// ============================================

import { memo, useMemo, useState } from 'react'
import { Upload } from 'lucide-react'
import {
  parseAmountMinor,
  parseBankStatementCsv,
  type ParseResult,
} from '../../../lib/bank-statement-csv'
import { ActionButton, ErrorNote, Loading, Money, Panel } from '../capability/capability-kit'
import { Input } from '../input'
import { SelectField } from '../select-field'

/**
 * The banking service scales EVERY amount by 100 (banking.service.ts reads
 * `amount * 100` for payments and journal lines alike), so a statement line
 * must be in the same unit or no amount would ever match.
 */
export const BANK_MINOR_DIGITS = 2

export interface ImportStatementInputShape {
  accountId: string
  statementDate: string
  openingBalanceMinor: number
  closingBalanceMinor: number
  lines: Array<{
    onDate: string
    amountMinor: number
    description: string
    externalRef: string | null
  }>
}

export interface ImportStatementPanelProps {
  t: (key: string, fallback?: string) => string
  accounts: Array<{ id: string; code: string; name: string }>
  /** A failed or pending account read is not «you have no bank account». */
  accountsLoading: boolean
  accountsError: string | null
  isImporting: boolean
  error: string | null
  onImport: (input: ImportStatementInputShape) => void
}

const PROBLEM_KEY = {
  DATE: 'bank.import.problemDate',
  AMOUNT: 'bank.import.problemAmount',
  BOTH_SIDES: 'bank.import.problemBothSides',
} as const

const FAILURE_KEY = {
  EMPTY: 'bank.import.fileEmpty',
  NO_DATE_COLUMN: 'bank.import.noDateColumn',
  NO_AMOUNT_COLUMN: 'bank.import.noAmountColumn',
} as const

export const ImportStatementPanel = memo(function ImportStatementPanel({
  t,
  accounts,
  accountsLoading,
  accountsError,
  isImporting,
  error,
  onImport,
}: ImportStatementPanelProps) {
  const [accountId, setAccountId] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [opening, setOpening] = useState('')

  const openingMinor = opening.trim() === '' ? 0 : parseAmountMinor(opening, BANK_MINOR_DIGITS)
  const summary = useMemo(() => {
    if (!parsed?.ok) return null
    const into = parsed.lines
      .filter((l) => l.amountMinor > 0)
      .reduce((s, l) => s + l.amountMinor, 0)
    const out = parsed.lines.filter((l) => l.amountMinor < 0).reduce((s, l) => s + l.amountMinor, 0)
    const dates = parsed.lines.map((l) => l.onDate).sort()
    return { into, out, last: dates[dates.length - 1] ?? null }
  }, [parsed])

  if (accountsLoading) {
    return (
      <Panel title={t('bank.import.title')}>
        <Loading label={t('common.loading')} />
      </Panel>
    )
  }

  if (accountsError) {
    return (
      <Panel title={t('bank.import.title')}>
        <ErrorNote message={accountsError} />
      </Panel>
    )
  }

  if (accounts.length === 0) {
    return (
      <Panel title={t('bank.import.title')}>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('bank.import.noBankAccount')}</p>
      </Panel>
    )
  }

  const ready =
    parsed?.ok === true &&
    parsed.lines.length > 0 &&
    parsed.problems.length === 0 &&
    accountId !== '' &&
    openingMinor !== null &&
    summary?.last != null &&
    !isImporting

  return (
    <Panel title={t('bank.import.title')}>
      <div className="space-y-3">
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('bank.import.help')}</p>

        <label className="block text-sm">
          <span className="mb-1 block text-[hsl(var(--fg-secondary))]">
            {t('bank.import.account')}
          </span>
          <SelectField
            name="accountId"
            data-field="accountId"
            value={accountId}
            onChange={setAccountId}
            placeholder={t('bank.import.chooseAccount')}
            aria-label={t('bank.import.account')}
            options={accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
          />
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-[hsl(var(--color-primary))]">
          <Upload className="size-4" aria-hidden="true" />
          <span>{fileName ?? t('bank.import.chooseFile')}</span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setFileName(file.name)
              setParsed(parseBankStatementCsv(await file.text(), BANK_MINOR_DIGITS))
            }}
          />
        </label>

        {parsed && !parsed.ok && <ErrorNote message={t(FAILURE_KEY[parsed.reason])} />}

        {parsed?.ok && summary && (
          <div className="space-y-2 rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-sm">
            <p>
              {t('bank.import.lines')}: <span dir="ltr">{parsed.lines.length}</span>
            </p>
            <p>
              {t('bank.import.moneyIn')}: <Money minor={summary.into} tone="good" /> ·{' '}
              {t('bank.import.moneyOut')}: <Money minor={summary.out} tone="bad" />
            </p>
            {parsed.problems.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-[hsl(var(--color-destructive))]">
                  {t('bank.import.problems')} ({parsed.problems.length})
                </p>
                <ul className="space-y-1">
                  {parsed.problems.slice(0, 10).map((p) => (
                    <li key={p.row} className="text-xs">
                      {t('bank.import.row')} <span dir="ltr">{p.row}</span>:{' '}
                      {t(PROBLEM_KEY[p.reason])}
                      <code className="ms-2 break-all text-[hsl(var(--fg-tertiary))]" dir="ltr">
                        {p.raw}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {parsed?.ok && (
          <label className="block text-sm">
            <span className="mb-1 block text-[hsl(var(--fg-secondary))]">
              {t('bank.import.openingBalance')}
            </span>
            <Input
              name="openingBalanceMinor"
              inputMode="decimal"
              dir="ltr"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
            />
            {openingMinor === null && (
              <span className="text-xs text-[hsl(var(--color-destructive))]">
                {t('bank.import.badAmount')}
              </span>
            )}
            {openingMinor !== null && summary && (
              <span className="mt-1 block text-xs text-[hsl(var(--fg-secondary))]">
                {t('bank.import.closingBalance')}:{' '}
                <Money minor={openingMinor + summary.into + summary.out} />
              </span>
            )}
          </label>
        )}

        {error && <ErrorNote message={error} />}

        <ActionButton
          disabled={!ready}
          onClick={() => {
            if (!ready || !parsed?.ok || !summary?.last || openingMinor === null) return
            onImport({
              accountId,
              statementDate: summary.last,
              openingBalanceMinor: openingMinor,
              closingBalanceMinor: openingMinor + summary.into + summary.out,
              lines: parsed.lines,
            })
          }}
        >
          {isImporting ? t('bank.import.importing') : t('bank.import.submit')}
        </ActionButton>
      </div>
    </Panel>
  )
})

ImportStatementPanel.displayName = 'ImportStatementPanel'
