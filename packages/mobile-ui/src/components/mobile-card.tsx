// ============================================
// MobileCard — surfaces separate by tone and elevation, not by outline.
// Only `outlined` opts into a border.
// ============================================

import React, { memo, useCallback, useRef } from 'react'
import { Animated, Pressable, View, type ViewProps, type ViewStyle } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import type { ElevationKey, SpacingKey } from '../tokens/layout'

export type CardVariant = 'elevated' | 'muted' | 'outlined' | 'glass'

export interface MobileCardProps extends ViewProps {
  variant?: CardVariant | undefined
  padding?: SpacingKey | undefined
  elevated?: ElevationKey | undefined
  onPress?: (() => void) | undefined
  accessibilityLabel?: string | undefined
}

const PRESSED_SCALE = 0.975

export const MobileCard = memo(function MobileCard({
  variant = 'elevated',
  padding = 'lg',
  elevated,
  onPress,
  style,
  children,
  ...rest
}: MobileCardProps) {
  const theme = useTheme()
  const scale = useRef(new Animated.Value(1)).current

  const animate = useCallback(
    (toValue: number) => {
      Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 0 }).start()
    },
    [scale]
  )

  const surface: Record<CardVariant, ViewStyle> = {
    elevated: { backgroundColor: theme.colors.surfaceElevated },
    muted: { backgroundColor: theme.colors.surfaceMuted },
    outlined: {
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.borderDefault,
    },
    glass: {
      backgroundColor: theme.colors.glassBg,
      borderWidth: 1,
      borderColor: theme.colors.glassBorder,
    },
  }

  const base: ViewStyle = {
    borderRadius: theme.radius.lg,
    padding: theme.spacing[padding],
  }
  const composed = [base, surface[variant], theme.elevation[elevated ?? 'sm'], style]

  if (!onPress) {
    return (
      <View {...rest} style={composed}>
        {children}
      </View>
    )
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => animate(PRESSED_SCALE)}
        onPressOut={() => animate(1)}
        style={composed}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
})
