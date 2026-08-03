import React, { memo } from 'react'
import { View } from 'react-native'
import type { AIInsight } from '@hisabche/api'
import { Badge, MobileCard, Text, useTheme, type BadgeTone } from '@hisabche/mobile-ui'

const TONE_BY_TYPE: Record<AIInsight['type'], BadgeTone> = {
  warning: 'warning',
  info: 'info',
  success: 'success',
  tip: 'primary',
}

export const InsightCard = memo(function InsightCard({ insight }: { insight: AIInsight }) {
  const { spacing, colors } = useTheme()
  const tone = TONE_BY_TYPE[insight.type]

  return (
    <MobileCard variant="muted" elevated="none" padding="lg">
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View
          style={{
            width: 3,
            borderRadius: 2,
            backgroundColor:
              tone === 'warning' ? colors.warning : tone === 'success' ? colors.success : colors.primary,
          }}
        />
        <View style={{ flex: 1, gap: spacing.xs }}>
          {insight.metricLabel ? <Badge label={insight.metricLabel} tone={tone} /> : null}
          <Text variant="bodyStrong">{insight.title}</Text>
          <Text variant="caption" tone="secondary">
            {insight.description}
          </Text>
        </View>
      </View>
    </MobileCard>
  )
})
