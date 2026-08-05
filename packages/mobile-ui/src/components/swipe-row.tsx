// ============================================
// SwipeRow — reveals trailing actions on horizontal drag.
//
// Built on PanResponder + Animated (native driver) so it needs no
// gesture-handler dependency and stays at 60 FPS on low-end devices.
// Direction-aware: the actions sit on the correct edge under RTL.
// ============================================

import React, { memo, useMemo, useRef, type ReactNode } from 'react'
import { Animated, I18nManager, PanResponder, Pressable, View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Text } from './text'

const ACTION_WIDTH = 76
const OPEN_THRESHOLD = 40

export interface SwipeAction {
  key: string
  label: string
  icon?: ReactNode | undefined
  tone?: 'danger' | 'brand' | 'neutral' | undefined
  onPress: () => void
}

export interface SwipeRowProps {
  actions: readonly SwipeAction[]
  children: ReactNode
}

export const SwipeRow = memo(function SwipeRow({ actions, children }: SwipeRowProps) {
  const { colors, radius, spacing } = useTheme()
  const translateX = useRef(new Animated.Value(0)).current

  // In RTL the row opens to the right, so the sign of the travel flips.
  const direction = I18nManager.isRTL ? 1 : -1
  const openOffset = direction * ACTION_WIDTH * actions.length

  const settle = useMemo(
    () => (toValue: number) => {
      Animated.spring(translateX, {
        toValue,
        useNativeDriver: true,
        speed: 40,
        bounciness: 0,
      }).start()
    },
    [translateX]
  )

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Claim the gesture only once it is clearly horizontal, so the
        // surrounding list keeps its vertical scroll.
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderMove: (_event, gesture) => {
          const clamped =
            direction < 0
              ? Math.min(0, Math.max(openOffset, gesture.dx))
              : Math.max(0, Math.min(openOffset, gesture.dx))
          translateX.setValue(clamped)
        },
        onPanResponderRelease: (_event, gesture) => {
          settle(Math.abs(gesture.dx) > OPEN_THRESHOLD ? openOffset : 0)
        },
        onPanResponderTerminate: () => settle(0),
      }),
    [direction, openOffset, settle, translateX]
  )

  const toneColor: Record<NonNullable<SwipeAction['tone']>, string> = {
    danger: colors.destructive,
    brand: colors.primary,
    neutral: colors.surfaceMuted,
  }

  return (
    <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [I18nManager.isRTL ? 'left' : 'right']: 0,
          flexDirection: 'row',
        }}
      >
        {actions.map((action) => (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => {
              settle(0)
              action.onPress()
            }}
            style={{
              width: ACTION_WIDTH,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              backgroundColor: toneColor[action.tone ?? 'neutral'],
            }}
          >
            {action.icon}
            <Text variant="legal" style={{ color: colors.primaryFg }}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  )
})
