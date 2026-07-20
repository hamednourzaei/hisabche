import axios, { AxiosInstance, AxiosError } from 'axios'

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
// ✅ Token Manager (جایگزین supabase session)
// ============================================
let authToken: string | null = null

export function setApiToken(token: string | null) {
  authToken = token
}

export function getApiToken(): string | null {
  return authToken
}

// ============================================
// Client Setup
// ============================================
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://api.hisabche.com/api'
const isDev = process.env.NODE_ENV !== 'production'

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
  params: {
    limit: 50,
  },
})

// ============================================
// Helpers
// ============================================
const isBrowser = (): boolean =>
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'

// ============================================
// Request Interceptor — ✅ فقط از authToken
// ============================================
apiClient.interceptors.request.use(
  async (config) => {
    // ✅ اولویت ۱: authToken (از Zustand store set می‌شه)
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`
      devLog('[API Client] token source: authToken')
    }
    // ✅ اولویت ۲: localStorage fallback (برای hydration)
    else if (isBrowser()) {
      try {
        const stored = localStorage.getItem('hisabche-auth')
        if (stored) {
          const parsed = JSON.parse(stored)
          const token = parsed?.state?.token
          if (token) {
            authToken = token
            config.headers.Authorization = `Bearer ${token}`
            devLog('[API Client] token source: localStorage hisabche-auth')
          }
        }
      } catch {}
    }

    if (!authToken) {
      devLog('[API Client] no token — unauthenticated request')
    }

    const lang = isBrowser()
      ? localStorage.getItem('hisabche-lang') || 'fa-AF'
      : 'fa-AF'
    config.headers['Accept-Language'] = lang

    devLog('[API Client] request:', config.method?.toUpperCase(), config.url)

    return config
  },
  (error) => Promise.reject(error)
)

// ============================================
// Response Interceptor
// ============================================
apiClient.interceptors.response.use(
  (response) => response,
  (
    error: AxiosError<{
      message?: string
      code?: string
      details?: Record<string, string[]>
    }>
  ) => {
    const responseData = error.response?.data as any

    const apiError: ApiError = {
      message:
        responseData?.message ||
        error.message ||
        'An unexpected error occurred',
      code: responseData?.code || 'UNKNOWN_ERROR',
      status: error.response?.status || 500,
      details: responseData?.details,
    }

    if (apiError.status === 401 && isBrowser()) {
      devLog('[API Client] 401 — clearing token')
      authToken = null
      localStorage.removeItem('hisabche-auth')
    }

    return Promise.reject(apiError)
  }
)

export default apiClient