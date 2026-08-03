import React, { memo, useCallback, useRef } from 'react'
import { ActivityIndicator, Animated, Pressable, View, type ViewStyle } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { MIN_TOUCH_TARGET } from '../tokens/layout'
import { Text } from './text'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant | undefined
  size?: ButtonSize | undefined
  loading?: boolean | undefined
  disabled?: boolean | undefined
  fullWidth?: boolean | undefined
  icon?: React.ReactNode | undefined
  testID?: string | undefined
}

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: MIN_TOUCH_TARGET, lg: 54 }
const PRESSED_SCALE = 0.97

export const Button = memo(function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  testID,
}: ButtonProps) {
  const { colors, radius, spacing, elevation } = useTheme()
  const scale = useRef(new Animated.Value(1)).current
  const isInactive = disabled || loading

  const animate = useCallback(
    (toValue: number) => {
      Animated.spring(scale, { toValue, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
    },
    [scale]
  )

  const surface: Record<ButtonVariant, ViewStyle> = {
    primary: { backgroundColor: colors.primary, ...elevation.brand },
    secondary: { backgroundColor: colors.surfaceMuted },
    ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderStrong },
    subtle: { backgroundColor: colors.primarySoft },
    destructive: { backgroundColor: colors.destructiveSoft },
  }
  const tone: Record<ButtonVariant, string> = {
    primary: colors.primaryFg,
    secondary: colors.fgPrimary,
    ghost: colors.fgPrimary,
    subtle: colors.primary,
    destructive: colors.destructive,
  }

  return (
    <Animated.View style={{ transform: [{ scale }], alignSelf: fullWidth ? 'stretch' : 'flex-start' }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled: isInactive, busy: loading }}
        disabled={isInactive}
        onPress={onPress}
        onPressIn={() => animate(PRESSED_SCALE)}
        onPressOut={() => animate(1)}
        style={[
          {
            height: HEIGHT[size],
            borderRadius: radius.md,
            paddingHorizontal: spacing.xl,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
          },
          surface[variant],
          isInactive && { opacity: 0.45 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={tone[variant]} size="small" />
        ) : (
          <>
            {icon ? <View>{icon}</View> : null}
            <Text variant="label" style={{ color: tone[variant] }}>
              {label}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  )
})
