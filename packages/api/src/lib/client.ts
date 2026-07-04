// ============================================
// packages/api/src/lib/client.ts
// ============================================

import axios, { AxiosInstance, AxiosError } from 'axios'
import { supabaseClient } from '@hisabche/auth'

// ============================================
// Types
// ============================================
export interface ApiResponse<T = unknown> {
  data: T
  message?: string
  status: number
}

export interface ApiError {
  message: string
  code: string
  status: number
  details?: Record<string, string[]>
}

// ============================================
// Client Setup
// ============================================
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://hisabche.onrender.com/api'
const isDev = process.env.NODE_ENV !== 'production'

// Dev-only logger — never prints tokens/headers in production, where
// anyone with devtools open (or a screenshot) could otherwise read a
// live Bearer token straight out of the console.
const devLog = (...args: unknown[]) => {
  if (isDev) console.log(...args)
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ============================================
// Helpers
// ============================================
const isBrowser = (): boolean =>
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'

// ============================================
// Request Interceptor — Shared Supabase JWT
// ============================================
apiClient.interceptors.request.use(
  async (config) => {
    try {
      let token: string | null = null

      // اولویت ۱: Supabase session
      const { data: { session } } = await supabaseClient.auth.getSession()
      if (session?.access_token) {
        token = session.access_token
        devLog('[API Client] token source: supabase session')
      }

      // اولویت ۲: localStorage (fallback)
      if (!token && isBrowser()) {
        const storedToken = localStorage.getItem('hisabche-token')
        if (storedToken) {
          token = storedToken
          devLog('[API Client] token source: localStorage fallback')
        }
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      } else {
        devLog('[API Client] no token found — request sent unauthenticated')
      }
    } catch (err) {
      // خطای getSession نباید کل request رو بلاک کنه — به fallback برمی‌گردیم.
      if (isDev) console.error('[API Client] getSession error:', err)
      if (isBrowser()) {
        const fallbackToken = localStorage.getItem('hisabche-token')
        if (fallbackToken) {
          config.headers.Authorization = `Bearer ${fallbackToken}`
        }
      }
    }

    const lang = isBrowser()
      ? localStorage.getItem('hisabche-lang') || 'fa-AF'
      : 'fa-AF'
    config.headers['Accept-Language'] = lang

    // توجه: هرگز کل config.headers رو لاگ نکن — حتی در dev، چون شامل
    // Authorization می‌شه. اگه نیاز به دیباگ headers داری، فقط کلیدها رو
    // چاپ کن، نه مقادیر:
    devLog('[API Client] request:', config.method?.toUpperCase(), config.url)

    return config
  },
  (error) => Promise.reject(error),
)

// ============================================
// Response Interceptor
// ============================================
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; code?: string; details?: Record<string, string[]> }>) => {
    const responseData = error.response?.data as any

    const apiError: ApiError = {
      message: responseData?.message || error.message || 'An unexpected error occurred',
      code: responseData?.code || 'UNKNOWN_ERROR',
      status: error.response?.status || 500,
      details: responseData?.details,
    }

    if (apiError.status === 401 && isBrowser()) {
      devLog('[API Client] 401 received — clearing stored token')
      localStorage.removeItem('hisabche-token')
    }

    return Promise.reject(apiError)
  },
)

export default apiClient