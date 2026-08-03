import React, { memo, useEffect, useRef } from 'react'
import { Animated, Easing, type DimensionValue, type ViewStyle } from 'react-native'

import { useTheme } from '../theme/theme-provider'

export interface SkeletonProps {
  width?: DimensionValue | undefined
  height?: number | undefined
  rounded?: number | undefined
  style?: ViewStyle | undefined
}

/** Low-cost opacity pulse — runs on the native driver (Redmi 9 friendly). */
export const Skeleton = memo(function Skeleton({
  width = '100%',
  height = 16,
  rounded,
  style,
}: SkeletonProps) {
  const { colors, radius } = useTheme()
  const pulse = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  return (
    <Animated.View
      accessibilityRole="progressbar"
      style={[
        {
          width,
          height,
          borderRadius: rounded ?? radius.sm,
          backgroundColor: colors.surfaceMuted,
          opacity: pulse,
        },
        style,
      ]}
    />
  )
})
