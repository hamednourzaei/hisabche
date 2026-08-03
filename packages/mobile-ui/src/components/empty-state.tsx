import React, { memo } from 'react'
import { View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Button } from './button'
import { Text } from './text'

export interface EmptyStateProps {
  title: string
  description?: string | undefined
  actionLabel?: string | undefined
  onAction?: (() => void) | undefined
  icon?: React.ReactNode | undefined
}

export const EmptyState = memo(function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  const { spacing, colors, radius } = useTheme()

  return (
    <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.sm }}>
      {icon ? (
        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.full,
            backgroundColor: colors.primarySoft,
            marginBottom: spacing.xs,
          }}
        >
          {icon}
        </View>
      ) : null}

      <Text variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Text>

      {description ? (
        <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.sm }}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  )
})
