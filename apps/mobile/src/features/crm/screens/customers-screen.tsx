// ============================================
// CRM — customer list with balance status.
// ============================================

import React, { useCallback, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useCustomers } from '@hisabche/api'
import type { Customer } from '@hisabche/validation'
import { MobileCard, SearchBar, StatusChip, Text, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { QueryList } from '../../../shared/components/query-list'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { formatCurrency } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'

export function CustomersScreen() {
  const { t } = useTranslation('mobile')
  const { spacing } = useTheme()
  const router = useRouter()
  const currency = useCurrency()

  const [search, setSearch] = useState('')
  const query = useCustomers(
    useMemo(() => ({ page: 1, limit: 30, sortDirection: 'desc' as const, search }), [search])
  )

  const openDetail = useCallback((id: string) => router.push(`/customers/${id}`), [router])

  return (
    <AppScreen>
      <ScreenHeader title={t('customers.title')} />
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={t('common.search')}
        clearAccessibilityLabel={t('common.clear')}
      />

      <QueryList<Customer>
        data={query.data?.customers}
        estimatedItemSize={84}
        isLoading={query.isLoading}
        isRefetching={query.isRefetching}
        error={query.error}
        onRetry={query.refetch}
        keyExtractor={(item, index) => item.id ?? `customer-${index}`}
        emptyTitle={t('customers.emptyTitle')}
        emptyDescription={t('customers.emptyDescription')}
        renderItem={({ item }) => {
          const balance = item.openingBalance ?? 0
          return (
            <MobileCard onPress={() => openDetail(item.id ?? '')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {item.fullName}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {item.phone ?? '—'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                  <Text variant="bodyStrong">{formatCurrency(Math.abs(balance), currency)}</Text>
                  <StatusChip
                    label={balanceLabel(balance, t)}
                    tone={balance > 0 ? 'destructive' : balance < 0 ? 'info' : 'success'}
                  />
                </View>
              </View>
            </MobileCard>
          )
        }}
      />
    </AppScreen>
  )
}

function balanceLabel(balance: number, t: (key: string) => string): string {
  if (balance > 0) return t('customers.debt')
  if (balance < 0) return t('customers.credit')
  return t('customers.settled')
}
