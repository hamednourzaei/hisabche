import React, { memo } from 'react'
import { View } from 'react-native'
import type { Product } from '@hisabche/validation'
import type { CurrencyCode } from '@hisabche/store'
import { MobileCard, Money, StatusChip, Text, useTheme, type BadgeTone } from '@hisabche/mobile-ui'

import { currencySign, formatAmount, formatNumber } from '../../../shared/lib/format'

export type StockLevel = 'inStock' | 'lowStock' | 'outOfStock'

export function stockLevel(quantity: number, minStockLevel: number): StockLevel {
  if (quantity <= 0) return 'outOfStock'
  if (minStockLevel > 0 && quantity <= minStockLevel) return 'lowStock'
  return 'inStock'
}

const TONE: Record<StockLevel, BadgeTone> = {
  inStock: 'success',
  lowStock: 'warning',
  outOfStock: 'destructive',
}

export interface ProductRowProps {
  product: Product
  currency: CurrencyCode
  stockLabel: (level: StockLevel) => string
  unitLabel: string
  onPress: (id: string) => void
}

export const ProductRow = memo(function ProductRow({
  product,
  currency,
  stockLabel,
  unitLabel,
  onPress,
}: ProductRowProps) {
  const { spacing, colors, radius } = useTheme()
  const quantity = product.quantity ?? 0
  const level = stockLevel(quantity, product.minStockLevel ?? 0)

  return (
    <MobileCard onPress={() => onPress(product.id ?? '')} padding="lg">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {product.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="caption" tone="secondary">
              {`${formatNumber(quantity)} ${unitLabel}`}
            </Text>
            <View
              style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: colors.fgTertiary }}
            />
            <Money
              amount={formatAmount(product.sellPrice ?? 0)}
              sign={currencySign(currency)}
              size="inline"
              tone="secondary"
            />
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', gap: spacing.sm }}>
          <StatusChip label={stockLabel(level)} tone={TONE[level]} />
          <View
            style={{
              width: 44,
              height: 4,
              borderRadius: radius.full,
              backgroundColor: colors.surfaceMuted,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.min(100, (quantity / Math.max(1, (product.minStockLevel ?? 1) * 3)) * 100)}%`,
                height: '100%',
                backgroundColor:
                  level === 'inStock'
                    ? colors.success
                    : level === 'lowStock'
                      ? colors.warning
                      : colors.destructive,
              }}
            />
          </View>
        </View>
      </View>
    </MobileCard>
  )
})
