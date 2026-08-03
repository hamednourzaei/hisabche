// ============================================
// Bottom tabs — خانه / فروش / انبار / مشتریان / بیشتر
// Rendered by the custom animated tab bar.
// ============================================

import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Redirect, Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '../../src/features/auth/auth.store'
import { usePushRegistration } from '../../src/features/notifications/use-push-registration'
import { AnimatedTabBar } from '../../src/shared/components/animated-tab-bar'

type IconName = keyof typeof Ionicons.glyphMap

/** Outline when idle, solid when active — the standard iOS/Android cue. */
function tabIcon(outline: IconName, solid: IconName) {
  return function TabIcon({ color, focused }: { color: string; focused: boolean }) {
    return <Ionicons name={focused ? solid : outline} color={color} size={22} />
  }
}

export default function TabsLayout() {
  const { t } = useTranslation('mobile')
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  usePushRegistration(isAuthenticated)

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />

  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.home'), tabBarIcon: tabIcon('home-outline', 'home') }}
      />
      <Tabs.Screen
        name="sales"
        options={{ title: t('tabs.sales'), tabBarIcon: tabIcon('receipt-outline', 'receipt') }}
      />
      <Tabs.Screen
        name="inventory"
        options={{ title: t('tabs.inventory'), tabBarIcon: tabIcon('cube-outline', 'cube') }}
      />
      <Tabs.Screen
        name="customers"
        options={{ title: t('tabs.customers'), tabBarIcon: tabIcon('people-outline', 'people') }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('tabs.more'),
          tabBarIcon: tabIcon('ellipsis-horizontal', 'ellipsis-horizontal-circle'),
        }}
      />
    </Tabs>
  )
}
