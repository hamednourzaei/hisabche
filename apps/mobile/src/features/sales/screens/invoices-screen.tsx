// ============================================
// Invoice list — search, status filter chips, swipe actions.
// Server data is merged with the offline outbox so a freshly created
// offline invoice appears immediately.
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
import { SelectionBar } from '../../../shared/components/selection-bar'
import { currencySign, formatAmount } from '../../../shared/lib/format'
import { useSelectionMode } from '../../../shared/hooks/use-selection-mode'
import { useCurrency } from '../../settings/preferences.store'
import { usePendingInvoices } from '../../offline/use-outbox'
import { InvoiceRow } from '../components/invoice-row'

const PAGE_SIZE = 20

type StatusFilter = 'all' | 'pending' | 'paid' | 'overdue'

/** Mirrors the web list's filter — همه / فروش / خرید. */
type TypeFilter = 'all' | 'sale' | 'purchase'

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
  const [type, setType] = useState<TypeFilter>('all')

  const filters = useMemo(
    () => ({
      page: 1,
      limit: PAGE_SIZE,
      sortDirection: 'desc' as const,
      search,
      ...(status === 'all' ? {} : { status: status as InvoiceStatus }),
      // Filter on the canonical `invoice.type`, never on display text — the
      // same field the web list and the backend query use.
      ...(type === 'all' ? {} : { type }),
    }),
    [search, status, type],
  )

  const query = useInvoices(filters)
  const pending = usePendingInvoices()

  const items = useMemo<InvoiceWithCustomer[]>(() => {
    // Queued invoices have not reached the server, so the server-side filter
    // cannot see them; apply the same predicate locally rather than dropping
    // them from a filtered view.
    const queued =
      status === 'all'
        ? pending.filter((invoice) => type === 'all' || (invoice.type ?? 'sale') === type)
        : []

    return [...queued, ...(query.data?.invoices ?? [])]
  }, [pending, query.data, status, type])

  const options: readonly FilterOption<StatusFilter>[] = [
    { value: 'all', label: t('common.all'), count: items.length },
    { value: 'pending', label: t('sales.statusPending') },
    { value: 'paid', label: t('sales.statusPaid') },
    { value: 'overdue', label: t('sales.statusOverdue') },
  ]

  const typeOptions: readonly FilterOption<TypeFilter>[] = [
    { value: 'all', label: t('common.all') },
    { value: 'sale', label: t('sales.sale') },
    { value: 'purchase', label: t('sales.purchase') },
  ]

  // Native selection: long-press a row to enter selection mode, then tap to
  // toggle. No permanent checkbox column — that is a desktop table idiom and
  // would cost row space on a phone.
  const selection = useSelectionMode()

  const visibleIds = useMemo(
    () => items.map((invoice) => invoice.id).filter((id): id is string => Boolean(id)),
    [items],
  )

  useEffect(() => {
    selection.prune(visibleIds)
  }, [visibleIds, selection])

  const openDetail = useCallback(
    (id: string) => {
      // While selecting, a tap toggles instead of navigating away.
      if (selection.active) {
        selection.toggle(id)
        return
      }
      router.push(`/sales/${id}`)
    },
    [router, selection],
  )

  const openCreate = useCallback(() => router.push('/sales/new'), [router])

  const shareSelected = useCallback(() => {
    const chosen = items.filter((invoice) => invoice.id && selection.isSelected(invoice.id))
    const message = chosen
      .map(
        (invoice) =>
          `${invoice.invoiceNumber} — ${formatAmount(invoice.total ?? 0)} ${currencySign(currency)}`,
      )
      .join('\n')

    if (message) void Share.share({ message })
    selection.exit()
  }, [items, selection, currency])

  const shareInvoice = useCallback(
    (invoice: InvoiceWithCustomer) => {
      const line = `${invoice.invoiceNumber} — ${formatAmount(invoice.total ?? 0)} ${currencySign(currency)}`
      void Share.share({ message: line })
    },
    [currency],
  )

  return (
    <AppScreen>
      {selection.active ? (
        <SelectionBar
          count={selection.selectedCount}
          countLabel={t('common.selectedCount', {
            count: selection.selectedCount,
            defaultValue: `${selection.selectedCount}`,
          })}
          exitLabel={t('common.cancel')}
          onExit={selection.exit}
          actions={[
            {
              key: 'share',
              label: t('common.share'),
              icon: 'share-outline',
              onPress: shareSelected,
            },
          ]}
        />
      ) : (
        <ScreenHeader title={t('sales.title')} />
      )}
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={t('common.search')}
        clearAccessibilityLabel={t('common.clear')}
      />
      <FilterBar options={typeOptions} value={type} onChange={setType} />
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
              typeLabel={
                (item.type ?? 'sale') === 'purchase' ? t('sales.purchase') : t('sales.sale')
              }
              onPress={openDetail}
              onLongPress={item.id ? () => selection.begin(item.id as string) : undefined}
              selected={item.id ? selection.isSelected(item.id) : false}
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
