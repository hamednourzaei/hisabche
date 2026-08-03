// ============================================
// OfflineBanner — makes the sync state visible instead of hiding it
// behind Settings. Collapses to nothing when online and fully synced.
// ============================================

import React, { memo, useEffect, useRef } from 'react'
import { Animated, Pressable, View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Text } from './text'

export interface OfflineBannerProps {
  offline: boolean
  pendingCount: number
  offlineLabel: string
  /** Rendered when there are queued items, e.g. "۳ فاکتور منتظر همگام‌سازی". */
  pendingLabel: string
  onPress?: (() => void) | undefined
}

export const OfflineBanner = memo(function OfflineBanner({
  offline,
  pendingCount,
  offlineLabel,
  pendingLabel,
  onPress,
}: OfflineBannerProps) {
  const { colors, radius, spacing, duration } = useTheme()
  const visible = offline || pendingCount > 0
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: duration.fast,
      useNativeDriver: true,
    }).start()
  }, [duration, progress, visible])

  if (!visible) return null

  const tone = offline ? colors.warning : colors.info
  const background = offline ? colors.warningSoft : colors.infoSoft

  return (
    <Animated.View style={{ opacity: progress, paddingHorizontal: spacing.lg }}>
      <Pressable
        accessibilityRole={onPress ? 'button' : 'text'}
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          backgroundColor: background,
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
        <Text variant="caption" style={{ color: tone, flex: 1 }} numberOfLines={1}>
          {offline ? offlineLabel : pendingLabel}
        </Text>
      </Pressable>
    </Animated.View>
  )
})
