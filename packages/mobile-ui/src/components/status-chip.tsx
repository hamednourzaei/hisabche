import React, { memo } from 'react'
import { View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { badgePalette, type BadgeTone } from './badge'
import { Text } from './text'

export interface StatusChipProps {
  label: string
  tone?: BadgeTone | undefined
}

/** Dot + label. Used for invoice, stock and sync states. */
export const StatusChip = memo(function StatusChip({ label, tone = 'neutral' }: StatusChipProps) {
  const { colors, radius, spacing } = useTheme()
  const palette = badgePalette(colors)[tone]

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        alignSelf: 'flex-start',
        backgroundColor: palette.bg,
        borderRadius: radius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: 4,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.fg }} />
      <Text variant="legal" style={{ color: palette.fg }}>
        {label}
      </Text>
    </View>
  )
})
