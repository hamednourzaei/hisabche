import React, { memo } from 'react'
import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { CurrencyCode } from '@hisabche/store'
import { MobileCard, Text, useTheme } from '@hisabche/mobile-ui'

import { formatCurrency, formatNumber } from '../../../shared/lib/format'
import { lineTotal, type DraftItem } from '../hooks/use-invoice-draft'

export interface LineItemRowProps {
  item: DraftItem
  currency: CurrencyCode
  onRemove: () => void
}

export const LineItemRow = memo(function LineItemRow({
  item,
  currency,
  onRemove,
}: LineItemRowProps) {
  const { t } = useTranslation('mobile')
  const { spacing, colors } = useTheme()

  return (
    <MobileCard padding="sm">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {item.productName}
          </Text>
          <Text variant="caption" tone="secondary">
            {`${formatNumber(item.quantity)} × ${formatCurrency(item.unitPrice, currency)}`}
          </Text>
        </View>

        <Text variant="bodyStrong">{formatCurrency(lineTotal(item), currency)}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
          onPress={onRemove}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={18} color={colors.destructive} />
        </Pressable>
      </View>
    </MobileCard>
  )
})
