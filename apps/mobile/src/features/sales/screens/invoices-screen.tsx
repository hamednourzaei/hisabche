// ============================================
// Invoice list — server data merged with the offline outbox
// so a freshly created offline invoice appears immediately.
// ============================================

import React, { useCallback, useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useInvoices, type InvoiceWithCustomer } from '@hisabche/api'
import type { InvoiceStatus } from '@hisabche/validation'
import { FloatingButton, SearchBar, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { QueryList } from '../../../shared/components/query-list'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { useCurrency } from '../../settings/preferences.store'
import { usePendingInvoices } from '../../offline/use-outbox'
import { InvoiceRow } from '../components/invoice-row'

const PAGE_SIZE = 20

export function InvoicesScreen() {
  const { t } = useTranslation('mobile')
  const { colors } = useTheme()
  const router = useRouter()
  const currency = useCurrency()

  const [search, setSearch] = useState('')
  const filters = useMemo(
    () => ({ page: 1, limit: PAGE_SIZE, sortDirection: 'desc' as const, search }),
    [search]
  )

  const query = useInvoices(filters)
  const pending = usePendingInvoices()

  const items = useMemo<InvoiceWithCustomer[]>(
    () => [...pending, ...(query.data?.invoices ?? [])],
    [pending, query.data]
  )

  const statusLabel = useCallback(
    (status: InvoiceStatus) =>
      t(`sales.status${status.charAt(0).toUpperCase()}${status.slice(1)}`, {
        defaultValue: status,
      }),
    [t]
  )

  const openDetail = useCallback((id: string) => router.push(`/sales/${id}`), [router])
  const openCreate = useCallback(() => router.push('/sales/new'), [router])

  return (
    <AppScreen>
      <ScreenHeader title={t('sales.title')} />
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={t('common.search')}
        clearAccessibilityLabel={t('common.clear')}
      />

      <QueryList<InvoiceWithCustomer>
        data={items}
        estimatedItemSize={92}
        isLoading={query.isLoading}
        isRefetching={query.isRefetching}
        error={query.error}
        onRetry={query.refetch}
        keyExtractor={(item, index) => item.id ?? `pending-${index}`}
        emptyTitle={t('sales.emptyTitle')}
        emptyDescription={t('sales.emptyDescription')}
        emptyAction={{ label: t('sales.newInvoice'), onPress: openCreate }}
        renderItem={({ item }) => (
          <InvoiceRow
            invoice={item}
            currency={currency}
            statusLabel={statusLabel((item.status ?? 'pending') as InvoiceStatus)}
            onPress={openDetail}
          />
        )}
      />

      <FloatingButton
        accessibilityLabel={t('sales.newInvoice')}
        label={t('sales.newInvoice')}
        onPress={openCreate}
        icon={<Ionicons name="add" size={20} color={colors.primaryFg} />}
      />
    </AppScreen>
  )
}
