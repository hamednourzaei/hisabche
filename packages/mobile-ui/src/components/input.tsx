// ============================================
// Input — floating label, focus ring, optional password reveal.
// The label animates on the native driver so typing never drops frames.
// ============================================

import React, { forwardRef, useCallback, useMemo, useRef, useState } from 'react'
import {
  Animated,
  I18nManager,
  Pressable,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
  type TextInputProps,
} from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Text } from './text'

const FIELD_HEIGHT = 60

export interface InputProps extends Omit<TextInputProps, 'placeholder'> {
  label: string
  error?: string | undefined
  hint?: string | undefined
  leading?: React.ReactNode | undefined
  /** Adds a show/hide toggle and starts masked. */
  password?: boolean | undefined
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, leading, password = false, style, onFocus, onBlur, value, ...rest },
  ref,
) {
  const { colors, radius, spacing, typography } = useTheme()
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const hasValue = Boolean(value && String(value).length > 0)
  const raised = focused || hasValue
  const progress = useRef(new Animated.Value(raised ? 1 : 0)).current

  const animate = useCallback(
    (toValue: number) => {
      Animated.timing(progress, { toValue, duration: 140, useNativeDriver: true }).start()
    },
    [progress],
  )

  const handleFocus = useCallback(
    (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setFocused(true)
      animate(1)
      onFocus?.(event)
    },
    [animate, onFocus],
  )

  const handleBlur = useCallback(
    (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setFocused(false)
      if (!hasValue) animate(0)
      onBlur?.(event)
    },
    [animate, hasValue, onBlur],
  )

  const labelStyle = useMemo(
    () => ({
      transform: [
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -11] }) },
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.84] }) },
      ],
      opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
    }),
    [progress],
  )

  const borderColor = error ? colors.destructive : focused ? colors.primary : colors.borderDefault

  return (
    <View style={{ gap: spacing.xs }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          height: FIELD_HEIGHT,
          paddingHorizontal: spacing.lg,
          // `xl` (20px) — what web's `rounded-xl` field resolves to. Was `md`.
          borderRadius: radius.xl,
          borderWidth: focused ? 2 : 1,
          borderColor,
          backgroundColor: colors.surfaceMuted,
        }}
      >
        {leading}

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                alignSelf: I18nManager.isRTL ? 'flex-end' : 'flex-start',
              },
              labelStyle,
            ]}
          >
            <Text variant={raised ? 'legal' : 'body'} tone={focused ? 'brand' : 'tertiary'}>
              {label}
            </Text>
          </Animated.View>

          <TextInput
            ref={ref}
            value={value}
            secureTextEntry={password && !revealed}
            onFocus={handleFocus}
            onBlur={handleBlur}
            textAlign={I18nManager.isRTL ? 'right' : 'left'}
            style={[
              typography.body,
              { color: colors.fgPrimary, paddingTop: raised ? 16 : 0, paddingBottom: 0 },
              style,
            ]}
            {...rest}
          />
        </View>

        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            hitSlop={10}
            onPress={() => setRevealed((current) => !current)}
          >
            <Text variant="caption" tone="secondary">
              {revealed ? '⦿' : '⦾'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {error || hint ? (
        <Text variant="legal" tone={error ? 'danger' : 'tertiary'}>
          {error ?? hint}
        </Text>
      ) : null}
    </View>
  )
})
