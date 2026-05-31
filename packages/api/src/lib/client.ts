// ============================================
// API Client — Axios instance with Supabase JWT
// ============================================

import axios, { AxiosInstance, AxiosError } from 'axios'
import { createClient } from '@supabase/supabase-js'

// ============================================
// Supabase client (for JWT only)
// ============================================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

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
// Request Interceptor — Supabase JWT
// ============================================
apiClient.interceptors.request.use(
  async (config) => {
    // Get Supabase session token (live)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
      }
    } catch {
      // Fallback: localStorage token
      if (isBrowser()) {
        const token = localStorage.getItem('hisabche-token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }
    }

    // Language header
    const lang = isBrowser()
      ? localStorage.getItem('hisabche-lang') || 'fa-AF'
      : 'fa-AF'
    config.headers['Accept-Language'] = lang

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
      localStorage.removeItem('hisabche-token')
    }

    return Promise.reject(apiError)
  },
)

export default apiClient