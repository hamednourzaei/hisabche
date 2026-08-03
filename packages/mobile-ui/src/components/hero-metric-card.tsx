// ============================================
// HeroMetricCard — the one number that leads a screen.
// Brand-tinted surface, hero numerals, trend pill and an inline sparkline.
// ============================================

import React, { memo, type ReactNode } from 'react'
import { View } from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { MobileCard } from './mobile-card'
import { Money } from './money'
import { Skeleton } from './skeleton'
import { Sparkline } from './sparkline'
import { Text } from './text'
import { TrendPill } from './trend-pill'

export interface HeroMetricCardProps {
  label: string
  amount: string
  sign?: string | undefined
  trend?: number | undefined
  trendLabel?: string | undefined
  series?: readonly number[] | undefined
  loading?: boolean | undefined
  onPress?: (() => void) | undefined
  action?: ReactNode | undefined
}

export const HeroMetricCard = memo(function HeroMetricCard({
  label,
  amount,
  sign,
  trend,
  trendLabel,
  series,
  loading = false,
  onPress,
  action,
}: HeroMetricCardProps) {
  const { colors, spacing, radius } = useTheme()

  return (
    <MobileCard
      onPress={onPress}
      elevated="brand"
      padding="xl"
      style={{
        backgroundColor: colors.surfaceElevated,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="label" tone="secondary" style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
        {action}
      </View>

      <View style={{ marginTop: spacing.sm }}>
        {loading ? (
          <Skeleton height={44} width="72%" />
        ) : (
          <Money amount={amount} sign={sign} size="hero" />
        )}
      </View>

      {trend !== undefined && !loading ? (
        <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
          <TrendPill value={trend} label={trendLabel} />
        </View>
      ) : null}

      {series && series.length > 1 && !loading ? (
        <Sparkline values={series} height={44} style={{ marginTop: spacing.lg }} />
      ) : null}
    </MobileCard>
  )
})
