// ============================================
// Budgets on a phone.
//
// Web anatomy (packages/ui/components/ui/budgets/budgets-view.tsx):
//   the budget list, a spend check, and the variance table.
//
// The two questions stay separate here as well. Variance is retrospective and
// excludes committed money — a purchase order that was never received did not
// happen. The spend check is `budget − actual − committed`, asked before the
// money is promised, which is the whole difference between a control and a
// report.
// ============================================

import React, { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  useBudgetVariance,
  useBudgets,
  useCheckSpend,
  type Budget,
  type VarianceRow,
} from '@hisabche/api'
import { Button, EmptyState, ErrorState, Input, Skeleton, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { MinorMoney, Section, StatRow, StateBadge } from '../../capability/capability-kit'

function toMinor(text: string): number {
  const value = Number(text.replace(/[^\d.-]/g, ''))
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}

export function BudgetsScreen() {
  useTranslation('mobile')
  const t = useCommonT()
  const { spacing } = useTheme()

  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')

  const budgets = useBudgets()
  const variance = useBudgetVariance()
  const checkSpend = useCheckSpend()

  const budgetList: Budget[] = budgets.data ?? []
  const varianceRows: VarianceRow[] = variance.data ?? []

  return (
    <AppScreen>
      <NavScreenHeader id="budgets" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {budgets.isLoading ? <Skeleton height={140} /> : null}

        {budgets.error ? (
          <ErrorState
            title={t('common.error', 'خطا')}
            description={(budgets.error as Error).message}
            retryLabel={t('common.retry', 'تلاش دوباره')}
            onRetry={() => budgets.refetch()}
          />
        ) : null}

        {!budgets.isLoading && budgetList.length === 0 ? (
          <EmptyState
            title={t('budgets.empty_title', 'بودجه‌ای تعریف نشده')}
            description={t(
              'budgets.empty_hint',
              'بودجه از تنظیمات حسابداری، روی یک حساب، تعریف می‌شود.',
            )}
          />
        ) : null}

        {budgetList.length > 0 ? (
          <Section title={t('budgets.list', 'بودجه‌ها')}>
            {budgetList.map((budget) => (
              <StatRow
                key={budget.id}
                label={budget.accountId.slice(0, 8)}
                hint={`${t(`budgets.period_${budget.period}`, budget.period)} · ${t(
                  `budgets.action_${budget.action}`,
                  budget.action,
                )}`}
                value={<MinorMoney minor={budget.amountMinor} />}
              />
            ))}
          </Section>
        ) : null}

        <Section
          title={t('budgets.check_title', 'بررسی یک هزینه')}
          subtitle={t('budgets.check_hint', 'پیش از تعهد پول پرسیده می‌شود، نه بعد از آن.')}
        >
          <Input
            label={t('budgets.account', 'حساب')}
            value={accountId}
            onChangeText={setAccountId}
          />
          <View style={{ marginTop: spacing.sm }}>
            <Input
              label={t('budgets.amount_to_spend', 'مبلغ')}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Button
              label={t('budgets.check_action', 'بررسی')}
              loading={checkSpend.isPending}
              disabled={accountId.trim() === '' || toMinor(amount) <= 0}
              onPress={() => {
                // Reset first. A stale "allowed" sitting next to a new amount
                // is the one thing this control must never show.
                checkSpend.reset()
                checkSpend.mutate({
                  accountId: accountId.trim(),
                  amountMinor: toMinor(amount),
                  onDate: new Date().toISOString().slice(0, 10),
                })
              }}
              fullWidth
            />
          </View>

          {checkSpend.data ? (
            <View style={{ marginTop: spacing.md }}>
              <StateBadge
                tone={checkSpend.data.allowed ? 'success' : 'destructive'}
                label={
                  checkSpend.data.allowed
                    ? t('budgets.allowed', 'مجاز است')
                    : t('budgets.blocked', 'از سقف عبور می‌کند')
                }
              />

              {checkSpend.data.status ? (
                <>
                  <StatRow
                    label={t('budgets.budget', 'بودجه')}
                    value={<MinorMoney minor={checkSpend.data.status.budgetMinor} />}
                  />
                  <StatRow
                    label={t('budgets.actual', 'خرج‌شده')}
                    value={<MinorMoney minor={checkSpend.data.status.actualMinor} />}
                  />
                  <StatRow
                    label={t('budgets.committed', 'تعهدشده')}
                    value={
                      <MinorMoney minor={checkSpend.data.status.committedMinor} tone="muted" />
                    }
                  />
                  <StatRow
                    label={t('budgets.available', 'قابل استفاده')}
                    value={<MinorMoney minor={checkSpend.data.status.availableMinor} signed />}
                  />
                </>
              ) : null}
            </View>
          ) : null}
        </Section>

        {varianceRows.length > 0 ? (
          <Section
            title={t('budgets.variance', 'انحراف از بودجه')}
            subtitle={t('budgets.variance_hint', 'گذشته‌نگر — تعهدها در این جدول نیستند.')}
          >
            {varianceRows.map((row) => (
              <StatRow
                key={`${row.budgetId}-${row.periodStart}`}
                label={row.periodStart.slice(0, 10)}
                hint={
                  row.variancePercent != null ? `${Math.round(row.variancePercent)}%` : undefined
                }
                value={<MinorMoney minor={row.varianceMinor} signed />}
              />
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </AppScreen>
  )
}
