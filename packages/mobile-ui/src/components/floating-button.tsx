import React, { memo, useCallback, useRef } from 'react'
import { Animated, I18nManager, Pressable } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Text } from './text'

export interface FloatingButtonProps {
  onPress: () => void
  accessibilityLabel: string
  label?: string | undefined
  icon?: React.ReactNode | undefined
  bottomOffset?: number | undefined
}

export const FloatingButton = memo(function FloatingButton({
  onPress,
  accessibilityLabel,
  label,
  icon,
  bottomOffset = 0,
}: FloatingButtonProps) {
  const { colors, spacing, radius, elevation } = useTheme()
  const scale = useRef(new Animated.Value(1)).current
  const side = I18nManager.isRTL ? { left: spacing.lg } : { right: spacing.lg }

  const animate = useCallback(
    (toValue: number) => {
      Animated.spring(scale, { toValue, useNativeDriver: true, speed: 50, bounciness: 6 }).start()
    },
    [scale]
  )

  return (
    <Animated.View
      style={[
        { position: 'absolute', bottom: spacing.lg + bottomOffset, ...side },
        { transform: [{ scale }] },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onPressIn={() => animate(0.93)}
        onPressOut={() => animate(1)}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            minHeight: 56,
            minWidth: 56,
            paddingHorizontal: label ? spacing.xl : spacing.lg,
            borderRadius: radius.full,
            backgroundColor: colors.primary,
          },
          elevation.brand,
        ]}
      >
        {icon}
        {label ? (
          <Text variant="label" style={{ color: colors.primaryFg }}>
            {label}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  )
})
