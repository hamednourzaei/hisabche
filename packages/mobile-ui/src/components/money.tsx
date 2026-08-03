// ============================================
// Money — the product's most important piece of text.
//
// The amount carries the weight; the currency sign is deliberately smaller and
// dimmer so the eye lands on the digits first (Revolut / Stripe treatment).
// ============================================

import React, { memo } from 'react'
import { View, type ViewStyle } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Text, type TextTone } from './text'

export type MoneySize = 'hero' | 'large' | 'default' | 'inline'

export interface MoneyProps {
  /** Pre-formatted, locale-aware amount — no currency sign. */
  amount: string
  /** Currency sign or code, e.g. "؋". */
  sign?: string | undefined
  size?: MoneySize | undefined
  tone?: TextTone | undefined
  /** Renders a leading +/− and colours by direction. */
  signed?: boolean | undefined
  style?: ViewStyle | undefined
}

const AMOUNT_VARIANT = {
  hero: 'numericHero',
  large: 'numericLarge',
  default: 'numeric',
  inline: 'bodyStrong',
} as const

const SIGN_VARIANT = {
  hero: 'heading',
  large: 'subheading',
  default: 'label',
  inline: 'caption',
} as const

export const Money = memo(function Money({
  amount,
  sign,
  size = 'default',
  tone = 'primary',
  signed = false,
  style,
}: MoneyProps) {
  const { spacing } = useTheme()
  const negative = signed && amount.trim().startsWith('-')
  const resolvedTone: TextTone = signed ? (negative ? 'danger' : 'success') : tone

  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
        style,
      ]}
    >
      <Text
        variant={AMOUNT_VARIANT[size]}
        tone={resolvedTone}
        numberOfLines={1}
        adjustsFontSizeToFit={size === 'hero'}
      >
        {signed && !negative ? `+${amount}` : amount}
      </Text>

      {sign ? (
        <Text variant={SIGN_VARIANT[size]} tone="tertiary">
          {sign}
        </Text>
      ) : null}
    </View>
  )
})
