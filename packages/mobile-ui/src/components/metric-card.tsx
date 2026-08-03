// ============================================
// MetricCard — compact secondary tile. Never the hero.
// ============================================

import React, { memo, type ReactNode } from 'react'
import { View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { MobileCard } from './mobile-card'
import { Money } from './money'
import { Skeleton } from './skeleton'
import { Text, type TextTone } from './text'
import { TrendPill } from './trend-pill'

export interface MetricCardProps {
  label: string
  amount: string
  sign?: string | undefined
  trend?: number | undefined
  icon?: ReactNode | undefined
  tone?: TextTone | undefined
  loading?: boolean | undefined
  onPress?: (() => void) | undefined
}

export const MetricCard = memo(function MetricCard({
  label,
  amount,
  sign,
  trend,
  icon,
  tone = 'primary',
  loading = false,
  onPress,
}: MetricCardProps) {
  const { spacing, colors, radius } = useTheme()

  return (
    <MobileCard onPress={onPress} padding="lg" variant="muted" elevated="none">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {icon ? (
          <View
            style={{
              width: 28,
              height: 28,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm,
              backgroundColor: colors.primarySoft,
            }}
          >
            {icon}
          </View>
        ) : null}
        <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </Text>
      </View>

      <View style={{ marginTop: spacing.md }}>
        {loading ? (
          <Skeleton height={24} width="64%" />
        ) : (
          <Money amount={amount} sign={sign} size="default" tone={tone} />
        )}
      </View>

      {trend !== undefined && !loading ? (
        <View style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}>
          <TrendPill value={trend} />
        </View>
      ) : null}
    </MobileCard>
  )
})
