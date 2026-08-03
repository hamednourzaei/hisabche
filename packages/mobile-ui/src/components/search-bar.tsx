import React, { memo } from 'react'
import { I18nManager, Pressable, TextInput, View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Text } from './text'

export interface SearchBarProps {
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  clearAccessibilityLabel: string
  onSubmit?: (() => void) | undefined
  /** Rendered at the trailing edge, e.g. a barcode-scan button. */
  trailing?: React.ReactNode | undefined
}

export const SearchBar = memo(function SearchBar({
  value,
  onChangeText,
  placeholder,
  clearAccessibilityLabel,
  onSubmit,
  trailing,
}: SearchBarProps) {
  const { colors, radius, spacing, typography } = useTheme()

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          height: 44,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceMuted,
        }}
      >
        <Text variant="body" tone="tertiary">
          ⌕
        </Text>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.fgTertiary}
          returnKeyType="search"
          onSubmitEditing={onSubmit}
          autoCorrect={false}
          textAlign={I18nManager.isRTL ? 'right' : 'left'}
          style={[typography.body, { flex: 1, color: colors.fgPrimary, paddingVertical: 0 }]}
        />

        {value.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearAccessibilityLabel}
            hitSlop={10}
            onPress={() => onChangeText('')}
          >
            <Text variant="caption" tone="tertiary">
              ✕
            </Text>
          </Pressable>
        ) : null}
      </View>

      {trailing}
    </View>
  )
})
