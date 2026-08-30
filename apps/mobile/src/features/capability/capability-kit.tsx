// ============================================
// apps/mobile/src/features/capability/capability-kit.tsx
//
// The mobile counterpart of `packages/ui/.../capability/capability-kit.tsx`.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A SECOND FILE AND NOT A SHARED ONE
//
// The web kit renders `<div>` and Tailwind classes; React Native has neither.
// What IS shared is the contract underneath: the same hooks from
// `@hisabche/api`, the same integers in minor units, the same words from the
// same `common` catalog. Only the rendering differs, which is the one part
// that genuinely cannot be shared.
//
// `MinorMoney` is the single place on mobile that divides by 100, matching the
// web kit exactly. Two roundings of the same figure on two platforms is how a
// phone and a laptop come to disagree about a till.
// ============================================

import React from 'react'
import { View } from 'react-native'
import { Badge, MobileCard, Money, Text, useTheme, type BadgeTone } from '@hisabche/mobile-ui'

import { formatAmount, formatMoneyAmount, currencySign } from '../../shared/lib/format'
import { useCurrency } from '../settings/preferences.store'

/** A server figure in minor units, rendered in the reader's currency. */
export function MinorMoney({
  minor,
  size = 'default',
  signed = false,
  tone,
}: {
  minor: number
  size?: 'hero' | 'large' | 'default' | 'inline'
  signed?: boolean
  /** Mapped to the design system's own tone names below. */
  tone?: 'default' | 'muted' | 'success' | 'destructive'
}) {
  const currency = useCurrency()

  return (
    <Money
      amount={formatMoneyAmount(minor / 100, currency)}
      sign={currencySign(currency)}
      size={size}
      signed={signed}
      tone={TONE[tone ?? 'default']}
    />
  )
}

/**
 * This kit's plain words for a tone, mapped to the design system's names.
 * Screens say "muted" and "destructive" the way the web kit does, so the two
 * platforms read alike; only this table knows the difference.
 */
const TONE = {
  default: undefined,
  muted: 'secondary',
  success: 'success',
  destructive: 'danger',
} as const

/** Minutes as stored, shown as hours and minutes. Mirrors the web helper. */
export function formatMinutes(minutes: number): string {
  const whole = Math.trunc(Math.abs(minutes))
  const hours = Math.floor(whole / 60)
  const rest = whole % 60
  return `${minutes < 0 ? '-' : ''}${formatAmount(hours)}:${String(rest).padStart(2, '0')}`
}

/** A labelled figure. `hint` carries the comparison the figure needs. */
export function StatRow({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: string | undefined
}) {
  const { spacing } = useTheme()

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
      }}
    >
      <View style={{ flexShrink: 1, paddingEnd: spacing.md }}>
        <Text variant="body">{label}</Text>
        {hint ? (
          <Text variant="caption" tone="secondary">
            {hint}
          </Text>
        ) : null}
      </View>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text variant="bodyStrong">{String(value)}</Text>
      ) : (
        value
      )}
    </View>
  )
}

export function Section({
  title,
  subtitle,
  trailing,
  children,
}: {
  title: string
  subtitle?: string | undefined
  trailing?: React.ReactNode
  children: React.ReactNode
}) {
  const { spacing } = useTheme()

  return (
    <MobileCard>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
        }}
      >
        <View style={{ flexShrink: 1, paddingEnd: spacing.sm }}>
          <Text variant="subheading">{title}</Text>
          {subtitle ? (
            <Text variant="caption" tone="secondary">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing}
      </View>
      {children}
    </MobileCard>
  )
}

export function StateBadge({ tone, label }: { tone: BadgeTone; label: string }) {
  return <Badge tone={tone} label={label} />
}
