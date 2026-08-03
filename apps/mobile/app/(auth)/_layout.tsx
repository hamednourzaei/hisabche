import { Redirect, Stack } from 'expo-router'

import { useAuthStore } from '../../src/features/auth/auth.store'

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (isAuthenticated) return <Redirect href="/(tabs)" />

  return <Stack screenOptions={{ headerShown: false }} />
}
