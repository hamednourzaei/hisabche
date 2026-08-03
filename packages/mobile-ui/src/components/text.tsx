import React, { memo } from 'react'
import { Text as RNText, type TextProps as RNTextProps } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import type { TypographyVariant } from '../tokens/typography'

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'onBrand'

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant | undefined
  tone?: TextTone | undefined
}

export const Text = memo(function Text({
  variant = 'body',
  tone = 'primary',
  style,
  ...rest
}: TextProps) {
  const { typography, colors } = useTheme()

  const toneColor: Record<TextTone, string> = {
    primary: colors.fgPrimary,
    secondary: colors.fgSecondary,
    tertiary: colors.fgTertiary,
    brand: colors.primary,
    success: colors.success,
    warning: colors.warning,
    danger: colors.destructive,
    info: colors.info,
    onBrand: colors.primaryFg,
  }

  return <RNText {...rest} style={[typography[variant], { color: toneColor[tone] }, style]} />
})
