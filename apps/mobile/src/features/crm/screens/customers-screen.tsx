// ============================================
// CRM — customer list with balance status.
// ============================================

import React, { useCallback, useMemo, useState } from 'react'
import { Alert, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useCustomers } from '@hisabche/api'
import { csvFilename } from '@hisabche/formatting'
import {
  CUSTOMER_EXPORT_COLUMNS,
  customerDebtLabel,
  resolveExportColumns,
} from '@hisabche/ui-contract'
import type { Customer } from '@hisabche/validation'
import { FilterBar, SearchBar, useTheme, type FilterOption } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { QueryList } from '../../../shared/components/query-list'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { shareAsCSV } from '../../../shared/lib/export-csv'
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
  const tCommon = useCommonT()
  const { colors } = useTheme()
  const router = useRouter()
  const currency = useCurrency()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<BalanceFilter>('all')

  const query = useCustomers(
    useMemo(() => ({ page: 1, limit: 40, sortDirection: 'desc' as const, search }), [search]),
  )

  const customers = useMemo(() => {
    const list: Customer[] = query.data?.customers ?? []
    return list.filter((c) => matchesFilter(c.openingBalance ?? 0, filter))
  }, [filter, query.data])

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
    [t],
  )

  const openDetail = useCallback((id: string) => router.push(`/customers/${id}`), [router])

  // Same columns and the same rule as the web list — export what is currently
  // filtered, so the user gets what they can see.
  const exportCsv = useCallback(async () => {
    const rows = customers.map((customer) => ({
      name: customer.fullName ?? '',
      phone: customer.phone ?? '',
      debt: customer.openingBalance ?? 0,
      openInvoices: '',
      lastPurchase: '',
      status:
        (customer.openingBalance ?? 0) > 0
          ? tCommon('customers.export.statusDebtor', 'بدهکار')
          : tCommon('customers.export.statusSettled', 'تسویه'),
    }))

    const columns = resolveExportColumns<(typeof rows)[number]>(
      CUSTOMER_EXPORT_COLUMNS,
      tCommon,
    ).map((column) =>
      column.key === 'debt' ? { ...column, label: customerDebtLabel(currency, tCommon) } : column,
    )

    const result = await shareAsCSV(rows, columns, csvFilename('customers', new Date()))

    if (result === 'empty') Alert.alert(t('common.empty'))
    if (result === 'unavailable') Alert.alert(t('common.error'))
  }, [currency, customers, t, tCommon])

  return (
    <AppScreen>
      <NavScreenHeader
        id="buyers"
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tCommon('common.export', 'خروجی CSV')}
            testID="export-customers"
            onPress={() => void exportCsv()}
            hitSlop={12}
          >
            <Ionicons name="download-outline" size={20} color={colors.fgSecondary} />
          </Pressable>
        }
      />
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
