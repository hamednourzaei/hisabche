// ============================================
// Bottom tabs — rendered from the shared navigation contract, so the labels,
// order and destinations are the same ones the web sidebar shows.
//
// The bar seats four of the six primary intents plus «بیشتر»; «خرید» and
// «پول و سود» move to the top of the More screen. That trade-off is decided
// once, in MOBILE_TAB_IDS, and explained there.
// ============================================

import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Redirect, Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '../../src/features/auth/auth.store'
import { usePushRegistration } from '../../src/features/notifications/use-push-registration'
import { AnimatedTabBar } from '../../src/shared/components/animated-tab-bar'
import { TAB_ITEMS, tabRouteName, type MobileNavItem } from '../../src/shared/navigation/nav'

/** Outline when idle, solid when active — the standard iOS/Android cue. */
function tabIcon(item: MobileNavItem) {
  return function TabIcon({ color, focused }: { color: string; focused: boolean }) {
    return <Ionicons name={focused ? item.iconActive : item.icon} color={color} size={22} />
  }
}

export default function TabsLayout() {
  const { t } = useTranslation('common')
  const { t: tMobile } = useTranslation('mobile')
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  usePushRegistration(isAuthenticated)

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />

  return (
    <Tabs tabBar={(props) => <AnimatedTabBar {...props} />} screenOptions={{ headerShown: false }}>
      {TAB_ITEMS.map((item) => (
        <Tabs.Screen
          key={item.id}
          name={tabRouteName(item)}
          options={{ title: t(item.labelKey), tabBarIcon: tabIcon(item) }}
        />
      ))}
      <Tabs.Screen
        name="more"
        options={{
          title: tMobile('tabs.more'),
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <Ionicons
              name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal'}
              color={color}
              size={22}
            />
          ),
        }}
      />
    </Tabs>
  )
}
