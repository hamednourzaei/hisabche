// ============================================
// Root layout — bootstrap order matters:
// 1. storage adapter (the API client reads language/token through it)
// 2. i18n + RTL, then the persisted session
// 3. providers, then the navigator
// ============================================

import React, { useEffect, useState } from 'react'
import { useFonts } from 'expo-font'
import { SplashScreen, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ThemeProvider, useTheme } from '@hisabche/mobile-ui'

import { initMobileI18n } from '../src/shared/i18n'
import { initStorage } from '../src/shared/lib/storage'
import { QueryProvider } from '../src/shared/providers/query-provider'
import { useAuthStore } from '../src/features/auth/auth.store'
import { useSyncOnReconnect } from '../src/features/offline/use-outbox'

void SplashScreen.preventAutoHideAsync()

function useBootstrap(): boolean {
  const [ready, setReady] = useState(false)
  const hydrateAuth = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    let cancelled = false

    async function bootstrap(): Promise<void> {
      await initStorage()
      await initMobileI18n()
      await hydrateAuth()
      if (!cancelled) setReady(true)
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [hydrateAuth])

  return ready
}

function RootNavigator() {
  const { colors } = useTheme()

  // Drains the offline outbox on mount and on every reconnect.
  useSyncOnReconnect()

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surfaceBase },
          animation: 'fade',
        }}
      />
    </>
  )
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Vazirmatn-Regular': require('../assets/fonts/Vazirmatn-Regular.ttf'),
    'Vazirmatn-Bold': require('../assets/fonts/Vazirmatn-Bold.ttf'),
  })
  const bootstrapped = useBootstrap()
  const ready = bootstrapped && (fontsLoaded || Boolean(fontError))

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <ThemeProvider mode="system">
        <QueryProvider>
          <RootNavigator />
        </QueryProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
