// ============================================
// Customer detail — profile, ledger balance, transaction history.
// ============================================

import React, { useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useCustomer, useLedger, useTransactions } from '@hisabche/api'
import type { Transaction } from '@hisabche/validation'
import { ErrorState, MetricCard, MobileCard, Skeleton, Text, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { currencySign, formatAmount, formatCurrency, formatDate } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'

export function CustomerDetailScreen() {
  const { t } = useTranslation('mobile')
  const { spacing } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const currency = useCurrency()

  const customer = useCustomer(id)
  const ledger = useLedger(id)
  const transactions = useTransactions(
    useMemo(() => ({ page: 1, limit: 20, sortDirection: 'desc' as const, customerId: id }), [id])
  )

  if (customer.isLoading) {
    return (
      <AppScreen>
        <ScreenHeader title={t('customers.title')} />
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          <Skeleton height={80} />
          <Skeleton height={120} />
        </View>
      </AppScreen>
    )
  }

  if (customer.isError || !customer.data) {
    return (
      <AppScreen>
        <ScreenHeader title={t('customers.title')} />
        <ErrorState
          title={t('common.error')}
          retryLabel={t('common.retry')}
          onRetry={customer.refetch}
        />
      </AppScreen>
    )
  }

  const balance = ledger.data?.closingBalance ?? customer.data.openingBalance ?? 0
  const items: Transaction[] = transactions.data?.transactions ?? []

  return (
    <AppScreen>
      <ScreenHeader title={customer.data.fullName} subtitle={customer.data.phone ?? undefined} />

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <MetricCard
          label={balance > 0 ? t('customers.debt') : t('customers.credit')}
          amount={formatAmount(Math.abs(balance))}
          sign={currencySign(currency)}
          loading={ledger.isLoading}
        />

        <Text variant="heading">{t('customers.transactions')}</Text>

        {items.length === 0 ? (
          <Text variant="body" tone="secondary">
            {t('common.empty')}
          </Text>
        ) : (
          items.map((item, index) => (
            <MobileCard key={item.id ?? `tx-${index}`} padding="sm">
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
          ))
        )}
      </ScrollView>
    </AppScreen>
  )
}
