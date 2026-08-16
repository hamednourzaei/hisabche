// ============================================
// Product detail — stock level, pricing, identifiers.
// ============================================

import React from 'react'
import { ScrollView, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { profitPerUnit, stockValue, totalProfit } from '@hisabche/validation'
import { useProduct } from '@hisabche/api'
import { ErrorState, MobileCard, Skeleton, Text, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { formatCurrency, formatNumber } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'

export function ProductDetailScreen() {
  const { t } = useTranslation('mobile')
  const tCommon = useCommonT()
  const { spacing, colors } = useTheme()
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
        <ErrorState
          title={t('common.error')}
          retryLabel={t('common.retry')}
          onRetry={query.refetch}
        />
      </AppScreen>
    )
  }

  return (
    <AppScreen>
      <ScreenHeader title={product.name} subtitle={product.sku ?? product.barcode} />

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {/* Info grid — mirrors web's 4 InfoBoxes (قیمت فروش / قیمت خرید /
            تعداد / حداقل موجودی) in a 2×2 grid on a phone. */}
        <MobileCard padding="md">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <InfoBox
              label={tCommon('warehouse.sellPrice', 'قیمت فروش')}
              value={formatCurrency(product.sellPrice ?? 0, currency)}
              basis="50%"
            />
            <InfoBox
              label={tCommon('warehouse.buyPrice', 'قیمت خرید')}
              value={formatCurrency(product.buyPrice ?? 0, currency)}
              basis="50%"
            />
            <InfoBox
              label={tCommon('warehouse.quantity', 'تعداد')}
              value={`${formatNumber(product.quantity ?? 0)} ${t(
                `units.${product.unit ?? 'piece'}`,
                {
                  defaultValue: product.unit ?? '',
                },
              )}`}
              basis="50%"
            />
            <InfoBox
              label={tCommon('warehouse.minStock', 'حداقل موجودی')}
              value={formatNumber(product.minStockLevel ?? 0)}
              basis="50%"
            />
          </View>

          {/* Meta row — border-separated like web's second grid row. */}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.borderDefault,
              marginTop: spacing.md,
              paddingTop: spacing.md,
              flexDirection: 'row',
              flexWrap: 'wrap',
            }}
          >
            <InfoBox
              label={tCommon('warehouse.category', 'دسته‌بندی')}
              value={product.category ?? '—'}
              basis="50%"
              small
            />
            <InfoBox
              label={tCommon('warehouse.unit', 'واحد')}
              value={t(`units.${product.unit ?? 'piece'}`, {
                defaultValue: product.unit ?? '',
              })}
              basis="50%"
              small
            />
            <InfoBox
              label={tCommon('warehouse.totalValue', 'ارزش کل موجودی')}
              value={formatCurrency(stockValue(product), currency)}
              basis="100%"
              small
              accent
            />
          </View>
        </MobileCard>

        {/* Profit cards — web renders these as three separate interactive
            cards: موجودی فعلی / سود هر واحد / سود کل موجودی. Same as cards on
            a phone, same ordering. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <ProfitCard
            value={formatNumber(product.quantity ?? 0)}
            label={tCommon('warehouse.currentStock', 'موجودی فعلی')}
            basis="47%"
          />
          <ProfitCard
            value={formatCurrency(profitPerUnit(product), currency)}
            label={tCommon('warehouse.profitPerUnit', 'سود هر واحد')}
            basis="47%"
            success
          />
          <ProfitCard
            value={formatCurrency(totalProfit(product), currency)}
            label={tCommon('warehouse.totalProfit', 'سود کل موجودی')}
            basis="100%"
            accent
          />
        </View>

        {/* Identity — SKU + barcode, matching web's header metadata. */}
        <MobileCard>
          <View style={{ gap: spacing.sm }}>
            <Row label={t('inventory.sku')} value={product.sku ?? '—'} />
            <Row label={tCommon('warehouse.barcode', 'بارکد')} value={product.barcode ?? '—'} />
          </View>
        </MobileCard>
      </ScrollView>
    </AppScreen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <Text variant="bodyStrong" style={{ color: colors.fgPrimary }}>
        {value}
      </Text>
    </View>
  )
}

/** Web's InfoBox — small icon-headed value pair; `basis` keeps the 2×2 grid. */
function InfoBox({
  label,
  value,
  basis,
  small = false,
  accent = false,
}: {
  label: string
  value: string
  basis: '50%' | '100%'
  small?: boolean
  accent?: boolean
}) {
  const { spacing, colors } = useTheme()
  return (
    <View style={{ flexBasis: basis, paddingVertical: spacing.xs, paddingHorizontal: spacing.xs }}>
      <Text variant={small ? 'caption' : 'label'} tone="secondary" numberOfLines={1}>
        {label}
      </Text>
      <Text
        variant={small ? 'bodyStrong' : 'heading'}
        numberOfLines={1}
        style={accent ? { color: colors.primary } : undefined}
      >
        {value}
      </Text>
    </View>
  )
}

/** Web's interactive profit card — centered value + label. */
function ProfitCard({
  value,
  label,
  basis,
  success = false,
  accent = false,
}: {
  value: string
  label: string
  basis: '47%' | '100%'
  success?: boolean
  accent?: boolean
}) {
  const { spacing, colors } = useTheme()
  const color = success ? colors.success : accent ? colors.primary : colors.fgPrimary
  return (
    <MobileCard padding="md" style={{ flexBasis: basis, flexGrow: 1, alignItems: 'center' }}>
      <Text variant="heading" style={{ color }}>
        {value}
      </Text>
      <Text variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>
        {label}
      </Text>
    </MobileCard>
  )
}
