// ============================================
// Inventory — product list with stock filters and barcode lookup.
// ============================================

import React, { useCallback, useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useProducts } from '@hisabche/api'
import type { Product } from '@hisabche/validation'
import { FilterBar, SearchBar, useTheme, type FilterOption } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { QueryList } from '../../../shared/components/query-list'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { useCurrency } from '../../settings/preferences.store'
import { ProductRow, type StockLevel } from '../components/product-row'


type StockFilter = 'all' | 'lowStock' | 'outOfStock'

export function ProductsScreen() {
  const { t } = useTranslation('mobile')
  const { colors, spacing } = useTheme()
  const router = useRouter()
  const currency = useCurrency()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StockFilter>('all')

  const FILTERS: readonly FilterOption<StockFilter>[] = [
    { value: 'all', label: t('common.all') },
    { value: 'lowStock', label: t('inventory.lowStock') },
    { value: 'outOfStock', label: t('inventory.outOfStock') },
  ]

  const query = useProducts(
    useMemo(
      () => ({ page: 1, limit: 30, search, lowStock: filter === 'lowStock' ? true : undefined }),
      [filter, search]
    )
  )

  const products = useMemo(() => {
    const list: Product[] = query.data?.products ?? []
    if (filter === 'outOfStock') return list.filter((p) => (p.quantity ?? 0) <= 0)
    return list
  }, [filter, query.data])

  const stockLabel = useCallback((level: StockLevel) => t(`inventory.${level}`), [t])
  const openDetail = useCallback((id: string) => router.push(`/inventory/${id}`), [router])

  return (
    <AppScreen>
      <ScreenHeader
        title={t('inventory.title')}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('inventory.scanBarcode')}
            onPress={() => router.push('/inventory/scan')}
            hitSlop={8}
            style={{ padding: spacing.xs }}
          >
            <Ionicons name="barcode-outline" size={24} color={colors.primary} />
          </Pressable>
        }
      />

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={t('common.search')}
        clearAccessibilityLabel={t('common.clear')}
      />
      <FilterBar options={FILTERS} value={filter} onChange={setFilter} />

      <QueryList<Product>
        data={products}
        estimatedItemSize={84}
        isLoading={query.isLoading}
        isRefetching={query.isRefetching}
        error={query.error}
        onRetry={query.refetch}
        keyExtractor={(item, index) => item.id ?? `product-${index}`}
        emptyTitle={t('inventory.emptyTitle')}
        emptyDescription={t('inventory.emptyDescription')}
        renderItem={({ item }) => (
          <ProductRow
            product={item}
            currency={currency}
            stockLabel={stockLabel}
            unitLabel={t(`common.unit`)}
            onPress={openDetail}
          />
        )}
      />
    </AppScreen>
  )
}
