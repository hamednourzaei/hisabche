// ============================================
// Accounting — transaction feed plus the trial balance summary.
// ============================================

import React, { useMemo } from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTransactions, useTrialBalance, type TrialBalance } from '@hisabche/api'
import type { Transaction } from '@hisabche/validation'
import { MetricCard, MobileCard, Text, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { QueryList } from '../../../shared/components/query-list'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { currencySign, formatAmount, formatCurrency, formatDate } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'

export function AccountingScreen() {
  const { t } = useTranslation('mobile')
  const { spacing } = useTheme()
  const currency = useCurrency()

  const transactions = useTransactions(
    useMemo(() => ({ page: 1, limit: 30, sortDirection: 'desc' as const }), []),
  )
  // The endpoint returns one row per account — totals are summed here.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const trialBalance = useTrialBalance(today)

  const totals = useMemo(() => {
    const rows: TrialBalance[] = trialBalance.data ?? []
    return {
      credit: rows.reduce((sum, row) => sum + (row.credit ?? 0), 0),
      debit: rows.reduce((sum, row) => sum + (row.debit ?? 0), 0),
    }
  }, [trialBalance.data])

  const header = (
    <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
      <View style={{ flex: 1 }}>
        <MetricCard
          label={t('accounting.income')}
          amount={formatAmount(totals.credit)}
          sign={currencySign(currency)}
          loading={trialBalance.isLoading}
        />
      </View>
      <View style={{ flex: 1 }}>
        <MetricCard
          label={t('accounting.expense')}
          amount={formatAmount(totals.debit)}
          sign={currencySign(currency)}
          loading={trialBalance.isLoading}
        />
      </View>
    </View>
  )

  return (
    <AppScreen>
      <NavScreenHeader id="money" />

      <QueryList<Transaction>
        data={transactions.data?.transactions}
        estimatedItemSize={76}
        isLoading={transactions.isLoading}
        isRefetching={transactions.isRefetching}
        error={transactions.error}
        onRetry={transactions.refetch}
        keyExtractor={(item, index) => item.id ?? `tx-${index}`}
        emptyTitle={t('common.empty')}
        header={header}
        renderItem={({ item }) => (
          <MobileCard padding="sm">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {item.description ?? item.type}
                </Text>
                <Text variant="caption" tone="secondary">
                  {formatDate(item.date)}
                </Text>
              </View>
              <Text variant="bodyStrong">{formatCurrency(item.amount, currency)}</Text>
            </View>
          </MobileCard>
        )}
      />
    </AppScreen>
  )
}
