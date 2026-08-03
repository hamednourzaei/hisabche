// ============================================
// Sales trend — sparkline plus the period total.
// ============================================

import React, { memo, useMemo } from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { SalesDataPoint } from '@hisabche/api'
import { MobileCard, Money, Skeleton, Sparkline, Text, useTheme } from '@hisabche/mobile-ui'

export interface SalesTrendCardProps {
  points: readonly SalesDataPoint[]
  total: string
  sign: string
  loading?: boolean | undefined
}

export const SalesTrendCard = memo(function SalesTrendCard({
  points,
  total,
  sign,
  loading = false,
}: SalesTrendCardProps) {
  const { t } = useTranslation('mobile')
  const { spacing } = useTheme()

  const values = useMemo(() => points.map((point) => point.value), [points])
  const range = useMemo(() => {
    if (points.length === 0) return null
    return `${points[0]?.label ?? ''} — ${points[points.length - 1]?.label ?? ''}`
  }, [points])

  return (
    <MobileCard padding="lg">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="label" tone="secondary">
            {t('home.salesTrend')}
          </Text>
          {loading ? <Skeleton height={28} width="60%" /> : <Money amount={total} sign={sign} size="large" />}
        </View>
      </View>

      {values.length > 1 && !loading ? (
        <Sparkline values={values} height={56} style={{ marginTop: spacing.lg }} />
      ) : null}

      {range ? (
        <Text variant="legal" tone="tertiary" style={{ marginTop: spacing.sm }}>
          {range}
        </Text>
      ) : null}
    </MobileCard>
  )
})
