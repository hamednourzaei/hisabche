import React from 'react'
import { View, type ViewProps } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import type { SpacingKey } from '../tokens/layout'

export interface ScreenProps extends ViewProps {
  padding?: SpacingKey | undefined
}

/** Root container applying the themed background to every screen. */
export function Screen({ padding = 'none', style, children, ...rest }: ScreenProps) {
  const { colors, spacing } = useTheme()

  return (
    <View
      {...rest}
      style={[
        { flex: 1, backgroundColor: colors.surfaceBase, padding: spacing[padding] },
        style,
      ]}
    >
      {children}
    </View>
  )
}
