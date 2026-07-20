import axios, { AxiosInstance, AxiosError } from 'axios'
import { getToken } from './tokenProvider'

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
const isBrowser = (): boolean => typeof window !== 'undefined'

// ✅ callback برای ۴۰۱ — بدون import از Store
let onUnauthorized: (() => void) | null = null

export function setOnUnauthorized(callback: () => void): void {
  onUnauthorized = callback
}

// ============================================
// Request Interceptor
// ============================================
apiClient.interceptors.request.use(
  async (config) => {
    // ✅ فقط از Token Provider می‌خوانیم
    const token = getToken()

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    } else {
      devLog('[API Client] no token — unauthenticated request')
    }

    const lang = isBrowser()
      ? localStorage.getItem('hisabche-lang') || 'fa-AF'
      : 'fa-AF'
    config.headers['Accept-Language'] = lang

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

    // ✅ ۴۰۱ → فقط callback صدا می‌شود (بدون logout، بدون loop)
    if (apiError.status === 401 && isBrowser()) {
      devLog('[API Client] 401 — triggering onUnauthorized callback')
      onUnauthorized?.()
    }

    return Promise.reject(apiError)
  }
)

export default apiClient