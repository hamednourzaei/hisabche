import React, { memo } from 'react'
import { View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Text } from './text'

export interface TrendPillProps {
  /** Signed percentage change vs. the previous period. */
  value: number
  label?: string | undefined
}

export const TrendPill = memo(function TrendPill({ value, label }: TrendPillProps) {
  const { colors, radius, spacing } = useTheme()

  const flat = Math.abs(value) < 0.05
  const positive = value > 0

  const background = flat
    ? colors.surfaceMuted
    : positive
      ? colors.successSoft
      : colors.destructiveSoft
  const foreground = flat ? colors.fgTertiary : positive ? colors.success : colors.destructive

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          backgroundColor: background,
          borderRadius: radius.full,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        }}
      >
        <Text variant="caption" style={{ color: foreground }}>
          {flat ? '—' : positive ? '↑' : '↓'}
        </Text>
        <Text variant="label" style={{ color: foreground }}>
          {`${Math.abs(value).toFixed(1)}%`}
        </Text>
      </View>

      {label ? (
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  )
})
