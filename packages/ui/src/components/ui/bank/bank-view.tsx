'use client'

// ============================================
// packages/ui/src/components/ui/bank/bank-view.tsx
//
// Bank reconciliation.
//
// ---------------------------------------------------------------------------
// EVERY MATCH IS CONFIRMED BY A PERSON
//
// There is deliberately no "accept all suggestions" button on this screen, and
// adding one would undo the point of it. The server scores candidates and says
// WHY it scored them; a pair it cannot separate is marked ambiguous and shown
// with that warning attached.
//
// Two invoices for the same amount from the same customer in the same week is
// ordinary. Guessing between them sends a receipt to the wrong invoice, and
// the person who finds out is the customer being chased for a debt they have
// already paid.
//
// The difference between the bank and the books is shown as a LIST of the
// items that account for it, not as a number. A number tells you that you are
// wrong; the list tells you where.
// ============================================

import { memo } from 'react'
import type { BankStatement, MatchSuggestion, ReconciliationSummary } from '@hisabche/api'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  ErrorNote,
  Loading,
  Money,
  Panel,
  Stat,
  StatGrid,
} from '../capability/capability-kit'

export interface BankViewProps {
  t: (key: string, fallback?: string) => string
  statements: BankStatement[]
  selectedId: string | null
  suggestions: MatchSuggestion[]
  reconciliation: ReconciliationSummary | null
  isLoading: boolean
  isDetailLoading: boolean
  error: string | null
  actionError: string | null
  isBusy: boolean
  onSelect: (statementId: string) => void
  onReconcile: (input: { statementLineId: string; bookEntryId: string }) => void
  onRefresh: () => void
}

const CONFIDENCE_TONE: Record<string, string> = {
  certain: 'good',
  likely: 'info',
  possible: 'warn',
}

export const BankView = memo(function BankView({
  t,
  statements,
  selectedId,
  suggestions,
  reconciliation,
  isLoading,
  isDetailLoading,
  error,
  actionError,
  isBusy,
  onSelect,
  onReconcile,
  onRefresh,
}: BankViewProps) {
  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('bank.title', 'مغایرت‌گیری بانکی')}
        description={t('bank.subtitle', 'تطبیق صورتحساب بانک با دفاتر')}
        action={
          <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
            {t('common.refresh', 'تازه‌سازی')}
          </ActionButton>
        }
      />

      {error ? (
        <ErrorNote
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry', 'تلاش دوباره')}
        />
      ) : null}
      {actionError ? <ErrorNote message={actionError} /> : null}

      {isLoading ? <Loading label={t('common.loading', 'در حال بارگذاری…')} /> : null}

      {!isLoading && statements.length === 0 ? (
        <Panel title={t('bank.empty_title', 'صورتحسابی وارد نشده')}>
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {t('bank.empty_hint', 'صورتحساب بانک را وارد کنید تا تطبیق آغاز شود.')}
          </p>
        </Panel>
      ) : null}

      {statements.length > 0 ? (
        <Panel title={t('bank.statements', 'صورتحساب‌ها')}>
          <ul className="divide-y divide-[hsl(var(--border-default))]">
            {statements.map((statement) => (
              <li key={statement.id}>
                <button
                  type="button"
                  onClick={() => onSelect(statement.id)}
                  className={
                    'flex w-full items-center justify-between gap-3 py-2.5 text-start text-sm transition hover:bg-[hsl(var(--surface-muted)/0.4)] ' +
                    (statement.id === selectedId ? 'bg-[hsl(var(--surface-muted)/0.5)]' : '')
                  }
                >
                  <span className="tabular-nums" dir="ltr">
                    {statement.statementDate}
                  </span>
                  <Money minor={statement.closingBalanceMinor} tone="muted" />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {isDetailLoading ? <Loading label={t('common.loading', 'در حال بارگذاری…')} /> : null}

      {reconciliation ? (
        <Panel
          title={t('bank.summary', 'خلاصه‌ی تطبیق')}
          description={t('bank.summary_hint', 'اختلاف، به‌صورت فهرست اقلامی که آن را می‌سازند.')}
        >
          <StatGrid>
            <Stat
              label={t('bank.statement_balance', 'مانده‌ی بانک')}
              value={<Money minor={reconciliation.statementBalanceMinor} />}
            />
            <Stat
              label={t('bank.book_balance', 'مانده‌ی دفاتر')}
              value={<Money minor={reconciliation.bookBalanceMinor} />}
            />
            <Stat
              label={t('bank.difference', 'اختلاف')}
              value={<Money minor={reconciliation.differenceMinor} signed tone="auto" />}
            />
            <Stat
              label={t('bank.unmatched', 'تطبیق‌نشده')}
              value={`${reconciliation.unmatchedLines} / ${reconciliation.unmatchedEntries}`}
              hint={t('bank.unmatched_hint', 'بانک / دفاتر')}
            />
          </StatGrid>

          {reconciliation.reconcilingItems.length > 0 ? (
            <ul className="mt-4 divide-y divide-[hsl(var(--border-default))] text-sm">
              {reconciliation.reconcilingItems.map((item) => (
                <li
                  key={`${item.side}-${item.id}`}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span>
                    <Badge tone={item.side === 'statement' ? 'info' : 'neutral'}>
                      {t(`bank.side_${item.side}`, item.side)}
                    </Badge>{' '}
                    <span className="text-[hsl(var(--fg-tertiary))]">{item.description}</span>
                  </span>
                  <Money minor={item.amountMinor} signed tone="auto" />
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ) : null}

      {selectedId ? (
        <Panel
          title={t('bank.suggestions', 'پیشنهادهای تطبیق')}
          description={t(
            'bank.suggestions_hint',
            'هر پیشنهاد را یک نفر تأیید می‌کند. تأیید گروهی وجود ندارد.',
          )}
        >
          {suggestions.length === 0 ? (
            <p className="text-sm text-[hsl(var(--fg-tertiary))]">
              {t('bank.no_suggestions', 'پیشنهادی نیست.')}
            </p>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((suggestion) => (
                <li
                  key={`${suggestion.statementLineId}-${suggestion.bookEntryId}`}
                  className="rounded-xl border border-[hsl(var(--border-default))] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={CONFIDENCE_TONE[suggestion.confidence] ?? 'neutral'}>
                      {t(`bank.confidence_${suggestion.confidence}`, suggestion.confidence)}
                    </Badge>
                    {suggestion.isAmbiguous ? (
                      <Badge tone="warn">{t('bank.ambiguous', 'مبهم — بیش از یک گزینه')}</Badge>
                    ) : null}
                    {suggestion.differenceMinor !== 0 ? (
                      <span>
                        {t('bank.difference', 'اختلاف')}:{' '}
                        <Money minor={suggestion.differenceMinor} signed tone="auto" />
                      </span>
                    ) : null}
                    <span className="text-[hsl(var(--fg-tertiary))]">
                      {suggestion.daysApart} {t('bank.days_apart', 'روز فاصله')}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">
                    {suggestion.reasons
                      .map((reason) => t(`bank.reason_${reason}`, reason))
                      .join(' · ')}
                  </p>

                  <ActionButton
                    className="mt-2"
                    variant="quiet"
                    disabled={isBusy}
                    onClick={() =>
                      onReconcile({
                        statementLineId: suggestion.statementLineId,
                        bookEntryId: suggestion.bookEntryId,
                      })
                    }
                  >
                    {t('bank.confirm_match', 'تأیید این تطبیق')}
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}
    </CapabilityPage>
  )
})

BankView.displayName = 'BankView'
