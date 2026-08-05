// ============================================
// Customer detail — profile header, ledger balance, transaction history.
// ============================================

import React, { useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useCustomer, useLedger, useTransactions } from '@hisabche/api'
import type { Transaction } from '@hisabche/validation'
import {
  ErrorState,
  MobileCard,
  Money,
  SectionHeader,
  Skeleton,
  Text,
  useTheme,
} from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { currencySign, formatAmount, formatDate } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'
import { CustomerProfileHeader } from '../components/customer-profile-header'

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
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={140} />
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
      <ScreenHeader title={t('customers.title')} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <CustomerProfileHeader
          fullName={customer.data.fullName}
          phone={customer.data.phone}
          balance={balance}
          currency={currency}
          loading={ledger.isLoading}
        />

        <View>
          <SectionHeader title={t('customers.transactions')} />

          {items.length === 0 ? (
            <MobileCard variant="muted" elevated="none" padding="lg">
              <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
                {t('common.empty')}
              </Text>
            </MobileCard>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {items.map((item, index) => (
                <MobileCard key={item.id ?? `tx-${index}`} variant="muted" elevated="none" padding="md">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {item.description ?? item.type}
                      </Text>
                      <Text variant="legal" tone="tertiary">
                        {formatDate(item.date)}
                      </Text>
                    </View>
                    <Money
                      amount={formatAmount(item.amount)}
                      sign={currencySign(currency)}
                      size="inline"
                    />
                  </View>
                </MobileCard>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </AppScreen>
  )
}
