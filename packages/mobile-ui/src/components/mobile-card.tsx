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
  /**
   * Long-press is the native equivalent of a checkbox column: it is how a list
   * enters selection mode without a permanent control taking up row space.
   */
  onLongPress?: (() => void) | undefined
  /** Tints the card and exposes selected state to assistive tech. */
  selected?: boolean | undefined
  accessibilityLabel?: string | undefined
}

const PRESSED_SCALE = 0.975

export const MobileCard = memo(function MobileCard({
  variant = 'elevated',
  padding = 'lg',
  elevated,
  onPress,
  onLongPress,
  selected = false,
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
    [scale],
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

  // Selection reads as a border plus a tint rather than a checkbox — colour
  // alone would not survive a greyscale display or colour-blind vision.
  const selectedStyle: ViewStyle | null = selected
    ? {
        borderWidth: 2,
        borderColor: theme.colors.primary,
        backgroundColor: theme.colors.surfaceMuted,
      }
    : null

  const composed = [base, surface[variant], theme.elevation[elevated ?? 'sm'], selectedStyle, style]

  if (!onPress && !onLongPress) {
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
        accessibilityState={{ selected }}
        onPress={onPress}
        onLongPress={onLongPress}
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
