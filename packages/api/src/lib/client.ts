// ============================================
// API Client — Axios instance with Shared Supabase JWT
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
      const { data: { session } } = await supabaseClient.auth.getSession()
      console.log('🔍 [API Client] getSession result:', session ? 'SESSION EXISTS' : 'SESSION NULL')
      console.log('🔍 [API Client] token preview:', session?.access_token?.slice(0, 30) + '...')
      console.log('🔍 [API Client] localStorage supabase keys:', Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('auth')))
      
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
        console.log('✅ [API Client] Authorization header SET')
      } else {
        console.log('❌ [API Client] Authorization header NOT SET — session is null')
      }
    } catch (err) {
      console.error('❌ [API Client] getSession ERROR:', err)
      if (isBrowser()) {
        const token = localStorage.getItem('hisabche-token')
        console.log('🔍 [API Client] Fallback localStorage token:', token ? 'EXISTS' : 'NULL')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }
    }

    const lang = isBrowser()
      ? localStorage.getItem('hisabche-lang') || 'fa-AF'
      : 'fa-AF'
    config.headers['Accept-Language'] = lang

    console.log('🔍 [API Client] Final headers:', JSON.stringify(config.headers))
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
      console.log('🔍 [API Client] 401 received, removing token')
      localStorage.removeItem('hisabche-token')
    }

    return Promise.reject(apiError)
  },
)

export default apiClient