import React, { memo, useMemo } from 'react'
import { View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Text } from './text'

export interface AvatarProps {
  name: string
  size?: number | undefined
}

/** Deterministic hue per name so the same customer always looks the same. */
function hueOf(name: string): number {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360
  }
  return hash
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0)).join('') || '؟'
}

export const Avatar = memo(function Avatar({ name, size = 40 }: AvatarProps) {
  const { radius } = useTheme()
  const hue = useMemo(() => hueOf(name), [name])

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `hsla(${hue}, 60%, 50%, 0.18)`,
      }}
    >
      <Text variant="label" style={{ color: `hsl(${hue}, 65%, 62%)` }}>
        {initialsOf(name)}
      </Text>
    </View>
  )
})
