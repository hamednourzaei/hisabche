import React, { memo } from 'react'
import { View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Button } from './button'
import { Text } from './text'

export interface ErrorStateProps {
  title: string
  description?: string | undefined
  retryLabel?: string | undefined
  onRetry?: (() => void) | undefined
}

export const ErrorState = memo(function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
}: ErrorStateProps) {
  const { spacing, colors, radius } = useTheme()

  return (
    <View
      style={{
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.lg,
        margin: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: colors.destructiveSoft,
      }}
    >
      <Text variant="heading" tone="danger" style={{ textAlign: 'center' }}>
        {title}
      </Text>

      {description ? (
        <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
          {description}
        </Text>
      ) : null}

      {retryLabel && onRetry ? (
        <Button label={retryLabel} variant="ghost" onPress={onRetry} />
      ) : null}
    </View>
  )
})
