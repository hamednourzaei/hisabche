// ============================================
// CRM — customer list with balance status.
// ============================================

import React, { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useCustomers } from '@hisabche/api'
import type { Customer } from '@hisabche/validation'
import { FilterBar, SearchBar, type FilterOption } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { QueryList } from '../../../shared/components/query-list'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { useCurrency } from '../../settings/preferences.store'
import { CustomerRow } from '../components/customer-row'

type BalanceFilter = 'all' | 'debt' | 'credit' | 'settled'

function matchesFilter(balance: number, filter: BalanceFilter): boolean {
  if (filter === 'debt') return balance > 0
  if (filter === 'credit') return balance < 0
  if (filter === 'settled') return balance === 0
  return true
}

export function CustomersScreen() {
  const { t } = useTranslation('mobile')
  const router = useRouter()
  const currency = useCurrency()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<BalanceFilter>('all')

  const query = useCustomers(
    useMemo(() => ({ page: 1, limit: 40, sortDirection: 'desc' as const, search }), [search])
  )

  const customers = useMemo(
    () => {
      const list: Customer[] = query.data?.customers ?? []
      return list.filter((c) => matchesFilter(c.openingBalance ?? 0, filter))
    },
    [filter, query.data]
  )

  const options: readonly FilterOption<BalanceFilter>[] = [
    { value: 'all', label: t('common.all') },
    { value: 'debt', label: t('customers.debt') },
    { value: 'credit', label: t('customers.credit') },
    { value: 'settled', label: t('customers.settled') },
  ]

  const balanceLabel = useCallback(
    (balance: number) => {
      if (balance > 0) return t('customers.debt')
      if (balance < 0) return t('customers.credit')
      return t('customers.settled')
    },
    [t]
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
      <FilterBar options={options} value={filter} onChange={setFilter} />

      <QueryList<Customer>
        data={customers}
        estimatedItemSize={88}
        isLoading={query.isLoading}
        isRefetching={query.isRefetching}
        error={query.error}
        onRetry={query.refetch}
        keyExtractor={(item, index) => item.id ?? `customer-${index}`}
        emptyTitle={t('customers.emptyTitle')}
        emptyDescription={t('customers.emptyDescription')}
        renderItem={({ item }) => (
          <CustomerRow
            customer={item}
            currency={currency}
            balanceLabel={balanceLabel}
            onPress={openDetail}
          />
        )}
      />
    </AppScreen>
  )
}
