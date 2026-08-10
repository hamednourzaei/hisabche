// ============================================
// More — the mobile rendering of the web «بیشتر» menu.
//
// Same destinations, same words, same grouping as the web sidebar's secondary
// menu, because all three come out of the shared navigation contract. The two
// primary intents the bottom bar could not seat («خرید» and «پول و سود») sit
// above the groups so they stay visually primary.
// ============================================

import React, { useCallback } from 'react'
import { ScrollView, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { MobileCard, Text, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { ScreenHeader } from '../../../shared/components/screen-header'
import {
  hrefFor,
  MORE_GROUPS,
  MORE_PRIMARY,
  type MobileNavItem,
} from '../../../shared/navigation/nav'

interface RowProps {
  item: MobileNavItem
  onPress: (item: MobileNavItem) => void
}

function NavRow({ item, onPress }: RowProps) {
  const { t } = useTranslation('common')
  const { colors, spacing } = useTheme()

  return (
    <MobileCard testID={`nav-${item.id}`} onPress={() => onPress(item)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Ionicons name={item.icon} size={22} color={colors.primary} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">{t(item.labelKey)}</Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {t(item.descriptionKey)}
          </Text>
        </View>
        {/* RTL-first product: the forward affordance points to the start edge. */}
        <Ionicons name="chevron-back" size={18} color={colors.fgTertiary} />
      </View>
    </MobileCard>
  )
}

export function MoreScreen() {
  const { t } = useTranslation('common')
  const { t: tMobile } = useTranslation('mobile')
  const { spacing } = useTheme()
  const router = useRouter()

  const open = useCallback((item: MobileNavItem) => router.push(hrefFor(item.path)), [router])

  return (
    <AppScreen>
      <ScreenHeader title={t('nav.more', tMobile('tabs.more'))} />

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
        {MORE_PRIMARY.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {MORE_PRIMARY.map((item) => (
              <NavRow key={item.id} item={item} onPress={open} />
            ))}
          </View>
        ) : null}

        {MORE_GROUPS.map((group) => (
          <View key={group.id} style={{ gap: spacing.sm }}>
            <Text variant="label" tone="secondary">
              {t(group.labelKey)}
            </Text>
            {group.items.map((item) => (
              <NavRow key={item.id} item={item} onPress={open} />
            ))}
          </View>
        ))}
      </ScrollView>
    </AppScreen>
  )
}
