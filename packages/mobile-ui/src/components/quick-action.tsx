import React, { memo, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Text } from './text'

export interface QuickActionProps {
  label: string
  icon: ReactNode
  onPress: () => void
  tone?: 'brand' | 'neutral' | undefined
}

/** Icon tile used in the row under the hero KPI. */
export const QuickAction = memo(function QuickAction({
  label,
  icon,
  onPress,
  tone = 'neutral',
}: QuickActionProps) {
  const { colors, radius, spacing } = useTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <View
        style={{
          width: 46,
          height: 46,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.md,
          backgroundColor: tone === 'brand' ? colors.primarySoft : colors.surfaceMuted,
        }}
      >
        {icon}
      </View>
      <Text variant="legal" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
})
