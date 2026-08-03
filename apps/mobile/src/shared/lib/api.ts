// ============================================
// API bootstrap — reuses the shared axios client from @hisabche/api.
// Only the base URL is re-pointed, because the shared client reads
// NEXT_PUBLIC_API_URL which Expo does not inline into the bundle.
// ============================================

import Constants from 'expo-constants'
import { apiClient } from '@hisabche/api'

const FALLBACK_API_URL = 'https://api.hisabche.com/api'

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL
  if (fromEnv) return fromEnv

  const fromConfig = Constants.expoConfig?.extra?.apiUrl
  return typeof fromConfig === 'string' && fromConfig.length > 0 ? fromConfig : FALLBACK_API_URL
}

export const API_BASE_URL = resolveBaseUrl()

apiClient.defaults.baseURL = API_BASE_URL

export { apiClient }
