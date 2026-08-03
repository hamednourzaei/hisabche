// ============================================
// Dashboard header — greeting, avatar and the offline/sync banner.
// ============================================

import React, { memo } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Avatar, OfflineBanner, Text, useTheme } from '@hisabche/mobile-ui'

import { useCurrentUser } from '../../auth/auth.store'
import { useIsOffline, usePendingCount } from '../../offline/use-outbox'

export const DashboardHeader = memo(function DashboardHeader() {
  const { t } = useTranslation('mobile')
  const { spacing } = useTheme()
  const router = useRouter()

  const user = useCurrentUser()
  const pending = usePendingCount()
  const offline = useIsOffline()

  return (
    <View style={{ gap: spacing.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" tone="tertiary">
            {t('home.greeting')}
          </Text>
          <Text variant="title" numberOfLines={1}>
            {user?.fullName ?? t('home.title')}
          </Text>
        </View>

        {user ? <Avatar name={user.fullName} size={42} /> : null}
      </View>

      <OfflineBanner
        offline={offline}
        pendingCount={pending}
        offlineLabel={t('sync.offlineBanner')}
        pendingLabel={t('sync.pendingBanner', { count: pending })}
        onPress={() => router.push('/sync')}
      />
    </View>
  )
})
