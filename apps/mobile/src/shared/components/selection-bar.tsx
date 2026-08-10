// ============================================
// Selection bar — the native counterpart of the web bulk action toolbar.
//
// Replaces the screen header while selection mode is active, which is the
// platform convention: the user is in a different mode, and the chrome should
// say so rather than adding a floating strip.
// ============================================

import React, { memo } from 'react'
import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text, useTheme } from '@hisabche/mobile-ui'

export interface SelectionBarAction {
  key: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
  destructive?: boolean | undefined
  onPress: () => void
}

export interface SelectionBarProps {
  count: number
  actions: readonly SelectionBarAction[]
  onExit: () => void
  exitLabel: string
  /** e.g. "۳ مورد انتخاب شد" — already interpolated by the caller. */
  countLabel: string
  busy?: boolean | undefined
}

export const SelectionBar = memo(function SelectionBar({
  count,
  actions,
  onExit,
  exitLabel,
  countLabel,
  busy = false,
}: SelectionBarProps) {
  const { colors, spacing } = useTheme()

  if (count === 0) return null

  return (
    <View
      accessibilityRole="toolbar"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surfaceMuted,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderDefault,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={exitLabel}
        onPress={onExit}
        // 44pt is the minimum reliable touch target; the icon alone is smaller.
        hitSlop={12}
        style={{ minWidth: 32, minHeight: 32, justifyContent: 'center' }}
      >
        <Ionicons name="close" size={22} color={colors.fgPrimary} />
      </Pressable>

      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {countLabel}
      </Text>

      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={action.onPress}
          hitSlop={12}
          style={{
            minWidth: 32,
            minHeight: 32,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Ionicons
            name={action.icon}
            size={21}
            color={action.destructive ? colors.destructive : colors.fgPrimary}
          />
        </Pressable>
      ))}
    </View>
  )
})
