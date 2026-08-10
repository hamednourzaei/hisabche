// ============================================
// API bootstrap — reuses the shared axios client from @hisabche/api.
//
// The shared client already reads EXPO_PUBLIC_API_URL, so this exists only for
// the `expoConfig.extra.apiUrl` fallback, which the shared package cannot see.
// Values are pushed through the same `normalizeBaseUrl` the shared client uses:
// re-pointing the base URL here previously bypassed that sanitising entirely,
// so a trailing space from a Windows `set VAR=... && cmd` survived and every
// request went to `/api%20/auth/login`.
// ============================================

import Constants from 'expo-constants'
import { apiClient, normalizeBaseUrl } from '@hisabche/api'

const FALLBACK_API_URL = 'https://api.hisabche.com/api'

function resolveBaseUrl(): string {
  const fromEnv = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL)
  if (fromEnv) return fromEnv

  const fromConfig = Constants.expoConfig?.extra?.apiUrl
  return (
    normalizeBaseUrl(typeof fromConfig === 'string' ? fromConfig : undefined) ?? FALLBACK_API_URL
  )
}

export const API_BASE_URL = resolveBaseUrl()

apiClient.defaults.baseURL = API_BASE_URL

export { apiClient }
