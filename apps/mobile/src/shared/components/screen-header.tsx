import React, { memo, type ReactNode } from 'react'
import { View } from 'react-native'
import { Text, useTheme } from '@hisabche/mobile-ui'

export interface ScreenHeaderProps {
  title: string
  subtitle?: string | undefined
  trailing?: ReactNode | undefined
}

export const ScreenHeader = memo(function ScreenHeader({
  title,
  subtitle,
  trailing,
}: ScreenHeaderProps) {
  const { spacing } = useTheme()

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        // 16px, the page padding web uses (`p-4`).
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  )
})
