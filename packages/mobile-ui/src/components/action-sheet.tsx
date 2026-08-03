// ============================================
// ActionSheet — a short list of choices in a BottomSheet.
// ============================================

import React, { memo, type ReactNode } from 'react'
import { Pressable, ScrollView, View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { BottomSheet } from './bottom-sheet'
import { Text } from './text'

export interface ActionSheetItem {
  key: string
  label: string
  icon?: ReactNode | undefined
  destructive?: boolean | undefined
  onPress: () => void
}

export interface ActionSheetProps {
  visible: boolean
  onClose: () => void
  title?: string | undefined
  items: readonly ActionSheetItem[]
}

export const ActionSheet = memo(function ActionSheet({
  visible,
  onClose,
  title,
  items,
}: ActionSheetProps) {
  const { spacing, colors, radius } = useTheme()

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} height={0.42}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            onPress={() => {
              onClose()
              item.onPress()
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.lg,
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
            })}
          >
            {item.icon ? <View>{item.icon}</View> : null}
            <Text variant="bodyStrong" tone={item.destructive ? 'danger' : 'primary'}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </BottomSheet>
  )
})
