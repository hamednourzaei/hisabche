// ============================================
// Custom tab bar — animated indicator, scale on press, haptic feedback.
// Replaces the stock Expo Router tab bar.
// ============================================

import React, { memo, useCallback, useRef } from 'react'
import { Animated, Platform, Pressable, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Text, useTheme } from '@hisabche/mobile-ui'

const BAR_HEIGHT = 58

function selectionFeedback(): void {
  if (Platform.OS === 'web') return
  void Haptics.selectionAsync().catch(() => undefined)
}

interface TabItemProps {
  focused: boolean
  label: string
  icon: React.ReactNode
  onPress: () => void
}

const TabItem = memo(function TabItem({ focused, label, icon, onPress }: TabItemProps) {
  const { colors, spacing, radius, duration } = useTheme()
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current

  Animated.timing(progress, {
    toValue: focused ? 1 : 0,
    duration: duration.fast,
    useNativeDriver: true,
  }).start()

  const handlePress = useCallback(() => {
    selectionFeedback()
    onPress()
  }, [onPress])

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={handlePress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}
    >
      <Animated.View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xs,
          borderRadius: radius.full,
          backgroundColor: focused ? colors.primarySoft : 'transparent',
          transform: [
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          ],
        }}
      >
        {icon}
      </Animated.View>

      <Text variant="legal" tone={focused ? 'brand' : 'tertiary'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
})

export type TabIconRenderer = (props: { color: string; focused: boolean }) => React.ReactNode

export function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, spacing } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={{
        flexDirection: 'row',
        height: BAR_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.surfaceElevated,
        borderTopWidth: 1,
        borderTopColor: colors.borderDefault,
      }}
    >
      {state.routes.map((route, index) => {
        const options = descriptors[route.key]?.options
        const focused = state.index === index
        const color = focused ? colors.primary : colors.fgTertiary

        return (
          <TabItem
            key={route.key}
            focused={focused}
            label={typeof options?.title === 'string' ? options.title : route.name}
            icon={options?.tabBarIcon?.({ color, focused, size: 22 })}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
            }}
          />
        )
      })}
    </View>
  )
}
