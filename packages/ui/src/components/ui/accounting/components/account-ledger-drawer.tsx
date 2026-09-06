'use client'

// ============================================
// packages/ui/src/components/ui/accounting/components/account-ledger-drawer.tsx
//
// H3 — the lines behind a figure.
//
// ---------------------------------------------------------------------------
// WHAT WAS WRONG
//
// `GET /accounting/general-ledger` has existed since the accounting module was
// written, is capability-guarded, computes a running balance and an opening
// balance — and had **no callers at all**. Every number in the Trial Balance,
// the Balance Sheet and the Income Statement was a dead end: an accountant who
// wanted to know what made up «۴٬۲۰۰٬۰۰۰ فروش» had nowhere to click.
//
// ---------------------------------------------------------------------------
// THE PERIOD TRAVELS WITH THE FIGURE
//
// The drill-down is opened with the SAME window as the report it came from. A
// drawer that showed the whole history would not add up to the number that was
// clicked, and the person checking would have no way to tell whether the
// report or the drawer was wrong.
//
// The opening balance is shown for the same reason: without it the first row's
// running balance starts at zero and every figure below it is wrong by the
// opening amount — while still looking perfectly self-consistent.
//
// ---------------------------------------------------------------------------
// A LINE LINKS TO WHAT PRODUCED IT
//
// `source_type`/`source_id` are now carried through from the journal entry, so
// a sales line reaches its invoice. A manual entry has no source and gets no
// link — `routeForEntity` returns null and the row renders as text, which is
// the honest answer rather than a link that goes nowhere.
// ============================================

import { X } from 'lucide-react'

import { routeForEntity } from '../../../../lib/entity-route'
import { cn } from '../../../../lib/utils'
import {
  LedgerFoot,
  LedgerHead,
  LedgerRow,
  LedgerTable,
  LedgerTd,
  LedgerTh,
  useLedgerNumber,
} from './ledger-table'

export interface AccountLedgerLine {
  lineId: string
  entryId: string
  entryNumber: string
  date: string
  description: string
  reference: string
  sourceType: string | null
  sourceId: string | null
  debit: number
  credit: number
  balance: number
}

export interface AccountLedgerDrawerProps {
  t: (key: string, fallback?: string) => string
  /** `null` closes the drawer. */
  account: { id: string; code: string; name: string } | null
  /** The window the figure was read in — shown, so it cannot be mistaken. */
  from: string
  to: string
  isLoading: boolean
  openingBalance: number
  closingBalance: number
  lines: AccountLedgerLine[]
  onClose: () => void
  /** Given a route from `routeForEntity`. Optional — no route, no link. */
  onNavigate?: ((route: string) => void) | undefined
}

export function AccountLedgerDrawer({
  t,
  account,
  from,
  to,
  isLoading,
  openingBalance,
  closingBalance,
  lines,
  onClose,
  onNavigate,
}: AccountLedgerDrawerProps) {
  const n = useLedgerNumber()

  if (!account) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={`${account.code} — ${account.name}`}
      // Clicking the backdrop closes. The panel below stops propagation, so a
      // click inside — selecting a figure to copy, say — does not dismiss it.
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-3xl flex-col bg-[hsl(var(--surface-elevated))] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border-default))] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-[hsl(var(--fg-primary))]">
              <span className="font-mono text-[hsl(var(--fg-tertiary))]">{account.code}</span>{' '}
              {account.name}
            </h2>
            {/* The window, stated. The drawer sums to the figure that opened
                it only for this period, and a reader must be able to see
                which one they are looking at. */}
            <p className="mt-0.5 text-xs text-[hsl(var(--fg-tertiary))]">
              {from ? `${from} — ${to}` : `${t('accounting.upTo', 'تا')} ${to}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('action.close', 'بستن')}
            className="shrink-0 rounded-full p-2 text-[hsl(var(--fg-secondary))] transition-colors hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-lg bg-[hsl(var(--surface-muted))]"
                />
              ))}
            </div>
          ) : (
            <LedgerTable caption={`${account.code} — ${account.name}`}>
              <LedgerHead>
                <LedgerTh>{t('accounting.journal.date', 'تاریخ')}</LedgerTh>
                <LedgerTh>{t('accounting.journal.entry', 'سند')}</LedgerTh>
                <LedgerTh>{t('accounting.journal.description', 'شرح')}</LedgerTh>
                <LedgerTh numeric>{t('accounting.journal.debit', 'بدهکار')}</LedgerTh>
                <LedgerTh numeric>{t('accounting.journal.credit', 'بستانکار')}</LedgerTh>
                <LedgerTh numeric>{t('accounting.trialBalance.balance', 'مانده')}</LedgerTh>
              </LedgerHead>

              <tbody>
                {/* The opening balance is a ROW, not a footnote. It is the
                    starting point of every running balance below it, and a
                    reader who cannot see it cannot check any of them. */}
                <LedgerRow>
                  <LedgerTd muted colSpan={5}>
                    {t('accounting.openingBalance', 'مانده‌ی ابتدای دوره')}
                  </LedgerTd>
                  <LedgerTd numeric strong>
                    {n(openingBalance, 'zero')}
                  </LedgerTd>
                </LedgerRow>

                {lines.map((line) => {
                  // `routeForEntity`, which answers `null` rather than guessing.
                  // A manual entry has no source document and must render as
                  // text — a link that silently lands on a list is worse than
                  // no link, because the reader believes they saw the record.
                  const route =
                    line.sourceType && line.sourceId
                      ? routeForEntity(line.sourceType, line.sourceId)
                      : null

                  return (
                    <LedgerRow key={line.lineId}>
                      <LedgerTd muted>{line.date}</LedgerTd>
                      <LedgerTd mono muted>
                        {line.entryNumber || '—'}
                      </LedgerTd>
                      <LedgerTd>
                        {route && onNavigate ? (
                          <button
                            type="button"
                            onClick={() => onNavigate(route)}
                            className={cn(
                              'text-start text-[hsl(var(--color-primary))] hover:underline',
                              'rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
                            )}
                          >
                            {line.description || line.reference || line.sourceType}
                          </button>
                        ) : (
                          <span>{line.description || line.reference || '—'}</span>
                        )}
                      </LedgerTd>
                      <LedgerTd numeric>{n(line.debit)}</LedgerTd>
                      <LedgerTd numeric>{n(line.credit)}</LedgerTd>
                      <LedgerTd numeric strong>
                        {n(line.balance, 'zero')}
                      </LedgerTd>
                    </LedgerRow>
                  )
                })}

                {lines.length === 0 ? (
                  <LedgerRow>
                    <LedgerTd muted colSpan={6}>
                      {t(
                        'accounting.generalLedger.empty',
                        'در این دوره هیچ سند ثبت‌شده‌ای روی این حساب نیست.',
                      )}
                    </LedgerTd>
                  </LedgerRow>
                ) : null}
              </tbody>

              <LedgerFoot>
                <LedgerTd strong colSpan={5}>
                  {t('accounting.closingBalance', 'مانده‌ی پایان دوره')}
                </LedgerTd>
                <LedgerTd numeric strong>
                  {n(closingBalance, 'zero')}
                </LedgerTd>
              </LedgerFoot>
            </LedgerTable>
          )}
        </div>
      </div>
    </div>
  )
}
