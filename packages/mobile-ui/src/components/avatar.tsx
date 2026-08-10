import React, { memo, useMemo } from 'react'
import { View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Text } from './text'

export interface AvatarProps {
  /**
   * Optional on purpose. This renders server data — an invoice whose customer
   * was deleted, or a record saved before a name was required, arrives with
   * nothing here. A leaf component showing a coloured circle must degrade to a
   * placeholder rather than take the whole screen down with it.
   */
  name?: string | null | undefined
  size?: number | undefined
}

export const PLACEHOLDER_INITIAL = '؟'

/**
 * Colour and initials for a name, tolerating anything the server sends.
 *
 * Exported so the fallback behaviour can be tested without a renderer — the
 * component itself is trivial once this is right.
 */
export function avatarPresentation(name: string | null | undefined): {
  hue: number
  initials: string
} {
  const safeName = typeof name === 'string' ? name.trim() : ''

  return {
    hue: hueOf(safeName),
    initials: safeName ? initialsOf(safeName) : PLACEHOLDER_INITIAL,
  }
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
  return parts.map((part) => part.charAt(0)).join('') || PLACEHOLDER_INITIAL
}

export const Avatar = memo(function Avatar({ name, size = 40 }: AvatarProps) {
  const { radius } = useTheme()
  const safeName = typeof name === 'string' ? name.trim() : ''
  const { hue, initials } = useMemo(() => avatarPresentation(safeName), [safeName])

  return (
    <View
      accessibilityRole="image"
      // An empty label is worse than none — screen readers announce the raw
      // element instead. Fall back to a generic description.
      accessibilityLabel={safeName || undefined}
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
        {initials}
      </Text>
    </View>
  )
})
