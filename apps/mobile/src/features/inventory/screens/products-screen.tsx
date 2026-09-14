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
import {
  FilterBar,
  MetricCard,
  SearchBar,
  Text,
  useLayout,
  useTheme,
  type FilterOption,
} from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { QueryList } from '../../../shared/components/query-list'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { useCurrency } from '../../settings/preferences.store'
import { ProductRow, type StockLevel } from '../components/product-row'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { formatAmount } from '../../../shared/lib/format'

type StockFilter = 'all' | 'lowStock' | 'outOfStock'

/** Web's warehouse BentoStats threshold — «موجودی کم» means > 0 and < 5. */
const LOW_STOCK_THRESHOLD = 5

/** Stock value at selling price — same rule as web's warehouse stats. */
function stockValue(product: Product): number {
  return (product.quantity ?? 0) * (product.sellPrice ?? 0)
}

function compactAmount(v: number): string {
  const abs = Math.abs(v)
  const n = (x: number, d = 0) =>
    x.toLocaleString('fa-AF', { minimumFractionDigits: d, maximumFractionDigits: d })
  if (abs >= 1e9) return `${n(v / 1e9, abs >= 1e10 ? 0 : 1)} میلیارد`
  if (abs >= 1e6) return `${n(v / 1e6, abs >= 1e7 ? 0 : 1)} میلیون`
  return n(v)
}

export function ProductsScreen() {
  const { t } = useTranslation('mobile')
  const tCommon = useCommonT()
  const { colors, spacing } = useTheme()
  const { isWide } = useLayout()
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
      [filter, search],
    ),
  )

  const products = useMemo(() => {
    const list: Product[] = query.data?.products ?? []
    if (filter === 'outOfStock') return list.filter((p) => (p.quantity ?? 0) <= 0)
    return list
  }, [filter, query.data])

  // Web's warehouse BentoStats read the filtered set: ارزش کل / تعداد محصولات /
  // موجودی کم / ناموجود. Same cards, same order, on the phone in a 2×2 grid.
  const warehouseStats = useMemo(() => {
    const totalValue = products.reduce((sum, p) => sum + stockValue(p), 0)
    const lowStockCount = products.filter(
      (p) => (p.quantity ?? 0) > 0 && (p.quantity ?? 0) < LOW_STOCK_THRESHOLD,
    ).length
    const outOfStockCount = products.filter((p) => (p.quantity ?? 0) <= 0).length

    return [
      {
        id: 'value',
        icon: 'cash-outline' as const,
        label: tCommon('warehouse.totalValue', 'ارزش کل (AFN)'),
        value: `${formatAmount(totalValue)} ${currency}`,
      },
      {
        id: 'count',
        icon: 'cube-outline' as const,
        label: tCommon('warehouse.totalProducts', 'تعداد محصولات'),
        value: compactAmount(products.length),
      },
      {
        id: 'low',
        icon: 'warning-outline' as const,
        label: tCommon('warehouse.lowStock', 'موجودی کم'),
        value: compactAmount(lowStockCount),
      },
      {
        id: 'out',
        icon: 'alert-circle-outline' as const,
        label: tCommon('warehouse.outOfStock', 'ناموجود'),
        value: compactAmount(outOfStockCount),
      },
    ]
  }, [currency, products, tCommon])

  const stockLabel = useCallback((level: StockLevel) => t(`inventory.${level}`), [t])
  const openDetail = useCallback((id: string) => router.push(`/warehouse/${id}`), [router])

  return (
    <AppScreen>
      <NavScreenHeader
        id="stock"
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('inventory.scanBarcode')}
            onPress={() => router.push('/warehouse/scan')}
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

      {/* Bento stats — identical to web's warehouse, between toolbar and list. */}
      {products.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {warehouseStats.map((stat) => (
            <View
              key={stat.id}
              style={{
                flexBasis: isWide ? '22%' : '47%',
                flexGrow: 1,
                minWidth: isWide ? 0 : 150,
              }}
            >
              <MetricCard
                label={stat.label}
                amount={stat.value}
                icon={<Ionicons name={stat.icon} size={15} color={colors.primary} />}
              />
            </View>
          ))}
        </View>
      ) : null}

      <QueryList<Product>
        data={products}
        estimatedItemSize={84}
        isLoading={query.isLoading}
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
