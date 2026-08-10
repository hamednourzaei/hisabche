import { Redirect } from 'expo-router'

import { useAuthStore } from '../src/features/auth/auth.store'

/** Entry gate — session is already hydrated by the root layout. */
export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return <Redirect href={isAuthenticated ? '/(tabs)/dashboard' : '/(auth)/login'} />
}
