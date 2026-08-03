// ============================================
// Brand hero — logo mark, wordmark and brand statement.
//
// The mark is drawn from tokens rather than shipped as an image: it scales
// perfectly, needs no asset pipeline and follows the theme automatically.
// ============================================

import React, { memo, useEffect, useRef } from 'react'
import { Animated, Easing, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Text, useTheme } from '@hisabche/mobile-ui'

const MARK_SIZE = 72

export const BrandHero = memo(function BrandHero() {
  const { t } = useTranslation('mobile')
  const { colors, radius, spacing, elevation, duration } = useTheme()

  const enter = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: duration.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [duration, enter])

  const style = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
    ],
  }

  return (
    <Animated.View style={[{ alignItems: 'center', gap: spacing.lg }, style]}>
      <View
        style={[
          {
            width: MARK_SIZE,
            height: MARK_SIZE,
            borderRadius: radius.xl,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
          },
          elevation.brand,
        ]}
      >
        <Text variant="display" style={{ color: colors.primaryFg }}>
          ح
        </Text>
      </View>

      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Text variant="display">{t('auth.brand')}</Text>
        <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
          {t('auth.tagline')}
        </Text>
      </View>
    </Animated.View>
  )
})
