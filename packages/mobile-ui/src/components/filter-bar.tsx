import React, { memo } from 'react'
import { Pressable, ScrollView, View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Text } from './text'

export interface FilterOption<T extends string> {
  value: T
  label: string
  count?: number | undefined
}

export interface FilterBarProps<T extends string> {
  options: readonly FilterOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function FilterBar<T extends string>({ options, value, onChange }: FilterBarProps<T>) {
  const { colors, radius, spacing } = useTheme()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // `flexGrow: 0` stops the bar claiming vertical space, and `alignItems:
      // center` stops each chip stretching to the container height — without it a
      // filter row rendered as tall blocks instead of chips wherever the parent
      // gave the ScrollView a height (Expo Web showed this clearly).
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
      }}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              // Web's filter tab measures 32px tall.
              minHeight: 32,
              // Web's filter tab measures 16px, not a full pill.
              borderRadius: radius.lg,
              backgroundColor: active ? colors.primary : colors.surfaceMuted,
            }}
          >
            <Text variant="label" style={{ color: active ? colors.primaryFg : colors.fgSecondary }}>
              {option.label}
            </Text>
            {option.count !== undefined ? (
              <View
                style={{
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.full,
                  backgroundColor: active ? colors.primaryFg : colors.surfaceElevated,
                }}
              >
                <Text
                  variant="legal"
                  style={{ color: active ? colors.primary : colors.fgTertiary }}
                >
                  {String(option.count)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
