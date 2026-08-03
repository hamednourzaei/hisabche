// ============================================
// Sparkline — inline trend built from plain Views.
// No SVG or chart library: keeps the bundle small and the Redmi 9 smooth.
// ============================================

import React, { memo, useMemo } from 'react'
import { View, type ViewStyle } from 'react-native'

import { useTheme } from '../theme/theme-provider'

export interface SparklineProps {
  values: readonly number[]
  height?: number | undefined
  color?: string | undefined
  /** Bars beyond this count are dropped from the head. */
  maxBars?: number | undefined
  style?: ViewStyle | undefined
}

export const Sparkline = memo(function Sparkline({
  values,
  height = 36,
  color,
  maxBars = 24,
  style,
}: SparklineProps) {
  const { colors, radius, spacing } = useTheme()

  const bars = useMemo(() => {
    const visible = values.slice(-maxBars)
    const max = Math.max(1, ...visible)
    return visible.map((value) => Math.max(2, (value / max) * height))
  }, [height, maxBars, values])

  if (bars.length === 0) return null

  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height },
        style,
      ]}
    >
      {bars.map((barHeight, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            height: barHeight,
            borderRadius: radius.xs,
            backgroundColor: color ?? colors.primary,
            // Older bars recede so the eye follows the trend forward.
            opacity: 0.35 + (index / bars.length) * 0.65,
            minWidth: spacing.xs / 2,
          }}
        />
      ))}
    </View>
  )
})
