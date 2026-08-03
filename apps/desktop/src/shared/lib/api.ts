// ============================================
// API bootstrap — reuses the shared axios client from @hisabche/api.
// Only the base URL is re-pointed; Vite does not inline NEXT_PUBLIC_*.
// ============================================

import { apiClient } from '@hisabche/api'

const FALLBACK_API_URL = 'https://api.hisabche.com/api'

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? FALLBACK_API_URL

apiClient.defaults.baseURL = API_BASE_URL

export { apiClient }
