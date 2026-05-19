// ============================================
// API Client — Axios instance with interceptors
// ============================================

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
// Request Interceptor
// ============================================
apiClient.interceptors.request.use(
  (config) => {
    if (isBrowser()) {
      const token = localStorage.getItem('hisabche-token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }

    const lang = isBrowser()
      ? localStorage.getItem('hisabche-lang') || 'fa-AF'
      : 'fa-AF'
    config.headers['Accept-Language'] = lang

    return config
  },
  (error) => Promise.reject(error),
)

// ============================================
// Response Interceptor — passthrough, no transform
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