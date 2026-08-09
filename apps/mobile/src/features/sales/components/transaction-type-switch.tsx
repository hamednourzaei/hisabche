// ============================================
// فروش / خرید — the only thing that differs between the two flows.
//
// A segmented control rather than a tab bar: it is a property of the form
// being filled in, not a navigation destination.
// ============================================

import React, { memo } from 'react'
import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Text, useTheme } from '@hisabche/mobile-ui'

import type { TransactionType } from '../hooks/use-invoice-draft'

export interface TransactionTypeSwitchProps {
  value: TransactionType
  onChange: (next: TransactionType) => void
}

export const TransactionTypeSwitch = memo(function TransactionTypeSwitch({
  value,
  onChange,
}: TransactionTypeSwitchProps) {
  const { t } = useTranslation('mobile')
  const { colors, spacing, radius } = useTheme()

  const options: {
    type: TransactionType
    label: string
    icon: keyof typeof Ionicons.glyphMap
  }[] = [
    { type: 'sale', label: t('sales.sale', 'فروش'), icon: 'pricetag-outline' },
    { type: 'purchase', label: t('sales.purchase', 'خرید'), icon: 'cart-outline' },
  ]

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('sales.transactionType', 'نوع تراکنش')}
      style={{
        flexDirection: 'row',
        gap: spacing.xs,
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.lg,
        padding: spacing.xs,
      }}
    >
      {options.map((option) => {
        const active = value === option.type
        return (
          <Pressable
            key={option.type}
            onPress={() => onChange(option.type)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              minHeight: 44,
              borderRadius: radius.md,
              backgroundColor: active ? colors.primary : 'transparent',
            }}
          >
            <Ionicons
              name={option.icon}
              size={16}
              color={active ? colors.primaryFg : colors.fgSecondary}
            />
            <Text
              variant="bodyStrong"
              style={{ color: active ? colors.primaryFg : colors.fgSecondary }}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
})
TransactionTypeSwitch.displayName = 'TransactionTypeSwitch'
