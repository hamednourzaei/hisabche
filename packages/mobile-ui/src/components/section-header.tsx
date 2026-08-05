import React, { memo, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Text } from './text'

export interface SectionHeaderProps {
  title: string
  subtitle?: string | undefined
  actionLabel?: string | undefined
  onAction?: (() => void) | undefined
  actionTestID?: string | undefined
  trailing?: ReactNode | undefined
}

export const SectionHeader = memo(function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  actionTestID,
  trailing,
}: SectionHeaderProps) {
  const { spacing } = useTheme()

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="heading">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="tertiary">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing}

      {actionLabel && onAction ? (
        <Pressable testID={actionTestID} accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text variant="label" tone="brand">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
})
