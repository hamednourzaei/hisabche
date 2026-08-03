// ============================================
// Product detail — stock level, pricing, identifiers.
// ============================================

import React from 'react'
import { ScrollView, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useProduct } from '@hisabche/api'
import { ErrorState, MobileCard, Skeleton, StatusChip, Text, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { formatCurrency, formatNumber } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'
import { stockLevel } from '../components/product-row'

export function ProductDetailScreen() {
  const { t } = useTranslation('mobile')
  const { spacing } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const currency = useCurrency()

  const query = useProduct(id)
  const product = query.data

  if (query.isLoading) {
    return (
      <AppScreen>
        <ScreenHeader title={t('inventory.title')} />
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          <Skeleton height={80} />
          <Skeleton height={120} />
        </View>
      </AppScreen>
    )
  }

  if (query.isError || !product) {
    return (
      <AppScreen>
        <ScreenHeader title={t('inventory.title')} />
        <ErrorState title={t('common.error')} retryLabel={t('common.retry')} onRetry={query.refetch} />
      </AppScreen>
    )
  }

  const level = stockLevel(product.quantity ?? 0, product.minStockLevel ?? 0)

  return (
    <AppScreen>
      <ScreenHeader title={product.name} subtitle={product.sku ?? product.barcode} />

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <MobileCard>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text variant="label" tone="secondary">
                {t('inventory.stock')}
              </Text>
              <Text variant="display">{formatNumber(product.quantity ?? 0)}</Text>
            </View>
            <StatusChip
              label={t(`inventory.${level}`)}
              tone={level === 'inStock' ? 'success' : level === 'lowStock' ? 'warning' : 'destructive'}
            />
          </View>
        </MobileCard>

        <MobileCard>
          <View style={{ gap: spacing.sm }}>
            <Row label={t('inventory.price')} value={formatCurrency(product.sellPrice ?? 0, currency)} />
            <Row label={t('inventory.sku')} value={product.sku ?? '—'} />
            <Row label="Barcode" value={product.barcode ?? '—'} />
          </View>
        </MobileCard>
      </ScrollView>
    </AppScreen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  )
}
