// ============================================
// Bank reconciliation on a phone.
//
// Web anatomy (packages/ui/components/ui/bank/bank-view.tsx):
//   statements → summary with the difference enumerated → suggestions, each
//   confirmed individually.
//
// The rule that matters travels with the screen, not the platform: there is no
// bulk accept here either. A pair the server cannot separate is marked
// ambiguous and shown that way; guessing between two invoices for the same
// amount sends a receipt to the wrong one, and the person who finds out is the
// customer being chased for a debt they already paid.
// ============================================

import React, { useState } from 'react'
import { Pressable, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  useBankStatements,
  useMatchSuggestions,
  useReconcileLine,
  useReconciliation,
  type BankStatement,
  type MatchSuggestion,
  type ReconciliationSummary,
} from '@hisabche/api'
import { Button, EmptyState, ErrorState, Skeleton, Text, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { MinorMoney, Section, StatRow, StateBadge } from '../../capability/capability-kit'

const CONFIDENCE_TONE = {
  certain: 'success',
  likely: 'info',
  possible: 'warning',
} as const

export function BankScreen() {
  useTranslation('mobile')
  const t = useCommonT()
  const { spacing } = useTheme()

  const [chosenId, setChosenId] = useState<string | null>(null)

  const statements = useBankStatements()
  const statementList: BankStatement[] = statements.data ?? []

  // The newest statement is the default, DERIVED rather than stored. An effect
  // that writes state on load costs a cascading render, and a stored default
  // goes stale the moment the list changes underneath it — the person is left
  // looking at a statement that is no longer the newest, with nothing saying so.
  //
  // Derived before the detail hooks, because they are keyed by it.
  const selectedId = chosenId ?? statementList[0]?.id ?? null

  const suggestions = useMatchSuggestions(selectedId ?? '')
  const reconciliation = useReconciliation(selectedId ?? '')
  const reconcile = useReconcileLine()

  const suggestionList: MatchSuggestion[] = suggestions.data?.suggestions ?? []

  return (
    <AppScreen>
      <NavScreenHeader id="bank" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {statements.isLoading ? <Skeleton height={140} /> : null}

        {statements.error ? (
          <ErrorState
            title={t('common.error', 'خطا')}
            description={(statements.error as Error).message}
            retryLabel={t('common.retry', 'تلاش دوباره')}
            onRetry={() => statements.refetch()}
          />
        ) : null}

        {!statements.isLoading && statementList.length === 0 ? (
          <EmptyState
            title={t('bank.empty_title', 'صورتحسابی وارد نشده')}
            description={t('bank.empty_hint', 'صورتحساب بانک را وارد کنید تا تطبیق آغاز شود.')}
          />
        ) : null}

        {statementList.length > 0 ? (
          <Section title={t('bank.statements', 'صورتحساب‌ها')}>
            {statementList.map((statement) => (
              <Pressable key={statement.id} onPress={() => setChosenId(statement.id)}>
                <StatRow
                  label={statement.statementDate}
                  hint={statement.id === selectedId ? '•' : undefined}
                  value={<MinorMoney minor={statement.closingBalanceMinor} tone="muted" />}
                />
              </Pressable>
            ))}
          </Section>
        ) : null}

        {reconciliation.data ? (
          <Section
            title={t('bank.summary', 'خلاصه‌ی تطبیق')}
            subtitle={t('bank.summary_hint', 'اختلاف، به‌صورت فهرست اقلامی که آن را می‌سازند.')}
          >
            <StatRow
              label={t('bank.statement_balance', 'مانده‌ی بانک')}
              value={<MinorMoney minor={reconciliation.data.statementBalanceMinor} />}
            />
            <StatRow
              label={t('bank.book_balance', 'مانده‌ی دفاتر')}
              value={<MinorMoney minor={reconciliation.data.bookBalanceMinor} />}
            />
            <StatRow
              label={t('bank.difference', 'اختلاف')}
              value={<MinorMoney minor={reconciliation.data.differenceMinor} signed />}
            />

            {reconciliation.data.reconcilingItems.map(
              (item: ReconciliationSummary['reconcilingItems'][number]) => (
                <StatRow
                  key={`${item.side}-${item.id}`}
                  label={item.description}
                  hint={t(`bank.side_${item.side}`, item.side)}
                  value={<MinorMoney minor={item.amountMinor} signed />}
                />
              ),
            )}
          </Section>
        ) : null}

        {selectedId ? (
          <Section
            title={t('bank.suggestions', 'پیشنهادهای تطبیق')}
            subtitle={t(
              'bank.suggestions_hint',
              'هر پیشنهاد را یک نفر تأیید می‌کند. تأیید گروهی وجود ندارد.',
            )}
          >
            {suggestions.isLoading ? <Skeleton height={100} /> : null}

            {suggestionList.length === 0 && !suggestions.isLoading ? (
              <Text variant="body" tone="secondary">
                {t('bank.no_suggestions', 'پیشنهادی نیست.')}
              </Text>
            ) : null}

            {suggestionList.map((suggestion) => (
              <Section
                key={`${suggestion.statementLineId}-${suggestion.bookEntryId}`}
                title={suggestion.reasons
                  .map((reason) => t(`bank.reason_${reason}`, reason))
                  .join(' · ')}
                trailing={
                  <StateBadge
                    tone={CONFIDENCE_TONE[suggestion.confidence]}
                    label={t(`bank.confidence_${suggestion.confidence}`, suggestion.confidence)}
                  />
                }
              >
                {suggestion.isAmbiguous ? (
                  <StateBadge
                    tone="warning"
                    label={t('bank.ambiguous', 'مبهم — بیش از یک گزینه')}
                  />
                ) : null}

                {suggestion.differenceMinor !== 0 ? (
                  <StatRow
                    label={t('bank.difference', 'اختلاف')}
                    value={<MinorMoney minor={suggestion.differenceMinor} signed />}
                  />
                ) : null}

                <StatRow
                  label={t('bank.days_apart', 'روز فاصله')}
                  value={String(suggestion.daysApart)}
                />

                <Button
                  label={t('bank.confirm_match', 'تأیید این تطبیق')}
                  variant="secondary"
                  disabled={reconcile.isPending}
                  onPress={() =>
                    reconcile.mutate({
                      statementLineId: suggestion.statementLineId,
                      bookEntryId: suggestion.bookEntryId,
                    })
                  }
                  fullWidth
                />
              </Section>
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </AppScreen>
  )
}
