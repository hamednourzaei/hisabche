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
//
// ---------------------------------------------------------------------------
// LAYOUT — the invoices list structure: header, stat strip (the selected
// statement's reconciliation), statements on the shared DataTable (a row
// selects), then the suggestions on a second one — no selection, no bulk bar:
// one confirmation per row, by design.
// ============================================

import { memo, useMemo, useState } from 'react'
import { Banknote, BookOpen, Scale, Unlink } from 'lucide-react'
import type { BankStatement, MatchSuggestion, ReconciliationSummary } from '@hisabche/api'
import { useDateFormat } from '../../../hooks/use-date-format'
import { DataTable, matchesSearch, type TableColumn } from '../data-table'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  ErrorNote,
  ListSection,
  Loading,
  Money,
  Panel,
  Stat,
  StatGrid,
} from '../capability/capability-kit'
import { ImportStatementPanel, type ImportStatementPanelProps } from './import-statement-panel'

export interface BankViewProps {
  t: (key: string, fallback?: string) => string
  statements: BankStatement[]
  selectedId: string | null
  suggestions: MatchSuggestion[]
  reconciliation: ReconciliationSummary | null
  isLoading: boolean
  isDetailLoading: boolean
  /** #62 — account suggestions for the unmatched lines, passed in by the container. */
  categorySlot?: React.ReactNode
  /** A failed detail read must not render as «no suggestions». */
  detailError: string | null
  error: string | null
  actionError: string | null
  isBusy: boolean
  onSelect: (statementId: string) => void
  onReconcile: (input: { statementLineId: string; bookEntryId: string }) => void
  onRefresh: () => void
  /** The statement importer — bank/cash accounts, and what happens on submit. */
  importer: Omit<ImportStatementPanelProps, 't'>
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
  categorySlot,
  reconciliation,
  isLoading,
  isDetailLoading,
  detailError,
  error,
  actionError,
  isBusy,
  onSelect,
  onReconcile,
  onRefresh,
  importer,
}: BankViewProps) {
  const { date } = useDateFormat()
  const [search, setSearch] = useState('')
  const [suggestionSearch, setSuggestionSearch] = useState('')

  const statementRows = useMemo(
    () => statements.filter((statement) => matchesSearch(search, [date(statement.statementDate)])),
    [date, search, statements],
  )

  const suggestionRows = useMemo(
    () =>
      suggestions.filter((suggestion) =>
        matchesSearch(suggestionSearch, [
          t(`bank.confidence_${suggestion.confidence}`, suggestion.confidence),
          ...suggestion.reasons.map((reason) => t(`bank.reason_${reason}`, reason)),
        ]),
      ),
    [suggestionSearch, suggestions, t],
  )

  const statementColumns = useMemo<TableColumn<BankStatement>[]>(
    () => [
      {
        id: 'statementDate',
        labelKey: 'common.date',
        labelFallback: 'تاریخ',
        locked: true,
        sortValue: (statement) => statement.statementDate,
        render: (statement) => (
          <span
            className={
              statement.id === selectedId
                ? 'font-semibold text-[hsl(var(--color-primary))]'
                : 'text-[hsl(var(--fg-primary))]'
            }
          >
            {date(statement.statementDate)}
          </span>
        ),
      },
      {
        id: 'closingBalance',
        labelKey: 'bank.statement_balance',
        labelFallback: 'مانده‌ی بانک',
        align: 'end',
        sortValue: (statement) => statement.closingBalanceMinor,
        render: (statement) => <Money minor={statement.closingBalanceMinor} tone="muted" />,
      },
    ],
    [date, selectedId],
  )

  const suggestionColumns = useMemo<TableColumn<MatchSuggestion>[]>(
    () => [
      {
        id: 'confidence',
        labelKey: 'bank.confidence',
        labelFallback: 'اطمینان',
        sortValue: (suggestion) => suggestion.score,
        render: (suggestion) => (
          <span className="inline-flex items-center gap-1.5">
            <Badge tone={CONFIDENCE_TONE[suggestion.confidence] ?? 'neutral'}>
              {t(`bank.confidence_${suggestion.confidence}`, suggestion.confidence)}
            </Badge>
            {suggestion.isAmbiguous ? (
              <Badge tone="warn">{t('bank.ambiguous', 'مبهم — بیش از یک گزینه')}</Badge>
            ) : null}
            {suggestion.review?.kind === 'check' && suggestion.review.reason === 'BANK_CHARGE' ? (
              <Badge tone="warn">
                {t('bank.review_bank_charge', 'احتمالاً کارمزد بانک — تطبیق ندهید')}
              </Badge>
            ) : null}
            {suggestion.review?.kind === 'ready' ? (
              <Badge tone="good">{t('bank.review_ready', 'شماره‌ی مرجع بانک یکی است')}</Badge>
            ) : null}
          </span>
        ),
      },
      {
        id: 'difference',
        labelKey: 'bank.difference',
        labelFallback: 'اختلاف',
        align: 'end',
        sortValue: (suggestion) => suggestion.differenceMinor,
        render: (suggestion) =>
          suggestion.differenceMinor !== 0 ? (
            <Money minor={suggestion.differenceMinor} signed tone="auto" />
          ) : (
            '—'
          ),
      },
      {
        id: 'daysApart',
        labelKey: 'bank.days_apart',
        labelFallback: 'روز فاصله',
        align: 'end',
        showFrom: 'md',
        sortValue: (suggestion) => suggestion.daysApart,
        render: (suggestion) => <span className="tabular-nums">{suggestion.daysApart}</span>,
      },
      {
        id: 'reasons',
        labelKey: 'bank.reasons',
        labelFallback: 'دلایل',
        showFrom: 'lg',
        render: (suggestion) => (
          <span className="text-xs text-[hsl(var(--fg-tertiary))]">
            {suggestion.reasons.map((reason) => t(`bank.reason_${reason}`, reason)).join(' · ')}
          </span>
        ),
      },
      {
        id: 'actions',
        labelKey: 'bank.confirm_match',
        labelFallback: 'تأیید این تطبیق',
        locked: true,
        align: 'end',
        render: (suggestion) => (
          <ActionButton
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
        ),
      },
    ],
    [isBusy, onReconcile, t],
  )

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

      {actionError ? <ErrorNote message={actionError} /> : null}

      <ImportStatementPanel t={t} {...importer} />

      {reconciliation && !detailError ? (
        <StatGrid>
          <Stat
            icon={Banknote}
            label={t('bank.statement_balance', 'مانده‌ی بانک')}
            value={<Money minor={reconciliation.statementBalanceMinor} />}
          />
          <Stat
            icon={BookOpen}
            label={t('bank.book_balance', 'مانده‌ی دفاتر')}
            value={<Money minor={reconciliation.bookBalanceMinor} />}
          />
          <Stat
            icon={Scale}
            label={t('bank.difference', 'اختلاف')}
            value={<Money minor={reconciliation.differenceMinor} signed tone="auto" />}
          />
          <Stat
            icon={Unlink}
            label={t('bank.unmatched', 'تطبیق‌نشده')}
            value={`${reconciliation.unmatchedLines} / ${reconciliation.unmatchedEntries}`}
            hint={t('bank.unmatched_hint', 'بانک / دفاتر')}
          />
        </StatGrid>
      ) : null}

      <ListSection title={t('bank.statements', 'صورتحساب‌ها')}>
        {isLoading ? (
          <Loading label={t('common.loading', 'در حال بارگذاری…')} />
        ) : error ? (
          <ErrorNote
            message={error}
            onRetry={onRefresh}
            retryLabel={t('common.retry', 'تلاش دوباره')}
          />
        ) : (
          <DataTable
            tableId="bank-statements"
            t={t}
            rows={statementRows}
            columns={statementColumns}
            rowKey={(statement) => statement.id}
            onRowClick={(statement) => onSelect(statement.id)}
            searchValue={search}
            onSearchChange={setSearch}
            minWidthClass="min-w-[320px]"
            emptyState={
              <EmptyState
                icon="invoice"
                title={t('bank.empty_title', 'صورتحسابی وارد نشده')}
                description={t('bank.empty_hint', 'صورتحساب بانک را وارد کنید تا تطبیق آغاز شود.')}
              />
            }
          />
        )}
      </ListSection>

      {selectedId ? (
        isDetailLoading ? (
          <Loading label={t('common.loading', 'در حال بارگذاری…')} />
        ) : detailError ? (
          <ErrorNote
            message={detailError}
            onRetry={onRefresh}
            retryLabel={t('common.retry', 'تلاش دوباره')}
          />
        ) : (
          <>
            {reconciliation && reconciliation.reconcilingItems.length > 0 ? (
              <Panel
                title={t('bank.summary', 'خلاصه‌ی تطبیق')}
                description={t(
                  'bank.summary_hint',
                  'اختلاف، به‌صورت فهرست اقلامی که آن را می‌سازند.',
                )}
              >
                <ul className="divide-y divide-[hsl(var(--border-default))] text-sm">
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
              </Panel>
            ) : null}

            <ListSection
              title={t('bank.suggestions', 'پیشنهادهای تطبیق')}
              description={t(
                'bank.suggestions_hint',
                'هر پیشنهاد را یک نفر تأیید می‌کند. تأیید گروهی وجود ندارد.',
              )}
            >
              <DataTable
                tableId="bank-suggestions"
                t={t}
                rows={suggestionRows}
                columns={suggestionColumns}
                rowKey={(suggestion) => `${suggestion.statementLineId}-${suggestion.bookEntryId}`}
                searchValue={suggestionSearch}
                onSearchChange={setSuggestionSearch}
                minWidthClass="min-w-[480px] sm:min-w-[720px]"
                emptyState={
                  <EmptyState icon="search" title={t('bank.no_suggestions', 'پیشنهادی نیست.')} />
                }
              />
            </ListSection>

            {categorySlot}
          </>
        )
      ) : null}
    </CapabilityPage>
  )
})

BankView.displayName = 'BankView'
