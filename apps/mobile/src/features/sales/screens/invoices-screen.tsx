// ============================================
// Invoice list — search, status filter chips, swipe actions.
// Server data is merged with the offline outbox so a freshly created
// offline invoice appears immediately.
// ============================================

import React, { useCallback, useMemo, useState } from 'react'
import { Share } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useInvoices, type InvoiceWithCustomer } from '@hisabche/api'
import type { InvoiceStatus } from '@hisabche/validation'
import {
  FilterBar,
  FloatingButton,
  SearchBar,
  SwipeRow,
  useTheme,
  type FilterOption,
} from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { QueryList } from '../../../shared/components/query-list'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { currencySign, formatAmount } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'
import { usePendingInvoices } from '../../offline/use-outbox'
import { InvoiceRow } from '../components/invoice-row'

const PAGE_SIZE = 20

type StatusFilter = 'all' | 'pending' | 'paid' | 'overdue'

function statusKey(status: InvoiceStatus): string {
  return `sales.status${status.charAt(0).toUpperCase()}${status.slice(1)}`
}

export function InvoicesScreen() {
  const { t } = useTranslation('mobile')
  const { colors } = useTheme()
  const router = useRouter()
  const currency = useCurrency()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const filters = useMemo(
    () => ({
      page: 1,
      limit: PAGE_SIZE,
      sortDirection: 'desc' as const,
      search,
      ...(status === 'all' ? {} : { status: status as InvoiceStatus }),
    }),
    [search, status]
  )

  const query = useInvoices(filters)
  const pending = usePendingInvoices()

  const items = useMemo<InvoiceWithCustomer[]>(
    () => [...(status === 'all' ? pending : []), ...(query.data?.invoices ?? [])],
    [pending, query.data, status]
  )

  const options: readonly FilterOption<StatusFilter>[] = [
    { value: 'all', label: t('common.all'), count: items.length },
    { value: 'pending', label: t('sales.statusPending') },
    { value: 'paid', label: t('sales.statusPaid') },
    { value: 'overdue', label: t('sales.statusOverdue') },
  ]

  const openDetail = useCallback((id: string) => router.push(`/sales/${id}`), [router])
  const openCreate = useCallback(() => router.push('/sales/new'), [router])

  const shareInvoice = useCallback(
    (invoice: InvoiceWithCustomer) => {
      const line = `${invoice.invoiceNumber} — ${formatAmount(invoice.total ?? 0)} ${currencySign(currency)}`
      void Share.share({ message: line })
    },
    [currency]
  )

  return (
    <AppScreen>
      <ScreenHeader title={t('sales.title')} />
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={t('common.search')}
        clearAccessibilityLabel={t('common.clear')}
      />
      <FilterBar options={options} value={status} onChange={setStatus} />

      <QueryList<InvoiceWithCustomer>
        data={items}
        estimatedItemSize={96}
        isLoading={query.isLoading}
        isRefetching={query.isRefetching}
        error={query.error}
        onRetry={query.refetch}
        keyExtractor={(item, index) => item.id ?? `pending-${index}`}
        emptyTitle={t('sales.emptyTitle')}
        emptyDescription={t('sales.emptyDescription')}
        emptyAction={{ label: t('sales.newInvoice'), onPress: openCreate }}
        renderItem={({ item }) => (
          <SwipeRow
            actions={[
              {
                key: 'share',
                label: t('common.share'),
                tone: 'brand',
                icon: <Ionicons name="share-outline" size={17} color={colors.primaryFg} />,
                onPress: () => shareInvoice(item),
              },
            ]}
          >
            <InvoiceRow
              invoice={item}
              currency={currency}
              statusLabel={t(statusKey((item.status ?? 'pending') as InvoiceStatus), {
                defaultValue: item.status ?? '',
              })}
              onPress={openDetail}
            />
          </SwipeRow>
        )}
      />

      <FloatingButton
        testID="fab-new-invoice"
        accessibilityLabel={t('sales.newInvoice')}
        label={t('sales.newInvoice')}
        onPress={openCreate}
        bottomOffset={62}
        icon={<Ionicons name="add" size={20} color={colors.primaryFg} />}
      />
    </AppScreen>
  )
}
