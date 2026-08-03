import React, { memo } from 'react'
import { View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Text } from './text'

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'destructive' | 'info'

export interface BadgeProps {
  label: string
  tone?: BadgeTone | undefined
}

export function badgePalette(
  colors: ReturnType<typeof useTheme>['colors']
): Record<BadgeTone, { bg: string; fg: string }> {
  return {
    neutral: { bg: colors.surfaceMuted, fg: colors.fgSecondary },
    primary: { bg: colors.primarySoft, fg: colors.primary },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    destructive: { bg: colors.destructiveSoft, fg: colors.destructive },
    info: { bg: colors.infoSoft, fg: colors.info },
  }
}

export const Badge = memo(function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const { colors, radius, spacing } = useTheme()
  const palette = badgePalette(colors)[tone]

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: palette.bg,
        borderRadius: radius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: 3,
      }}
    >
      <Text variant="legal" style={{ color: palette.fg }}>
        {label}
      </Text>
    </View>
  )
})
