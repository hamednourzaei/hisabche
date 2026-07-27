import axios, { AxiosInstance, AxiosError } from 'axios'
import { getToken, tokenReady } from './tokenProvider'

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

// حداکثر زمانی که یک درخواست منتظر آماده شدن Auth Store می‌ماند (میلی‌ثانیه)
const TOKEN_READY_TIMEOUT_MS = 2000

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
const isBrowser = (): boolean => typeof window !== 'undefined'

// ✅ callback برای ۴۰۱ — بدون import از Store
let onUnauthorized: (() => void) | null = null

export function setOnUnauthorized(callback: () => void): void {
  onUnauthorized = callback
}

// ✅ صبر با سقف زمانی؛ اگر Store هیچ‌وقت آماده نشد (مثلاً کاربر مهمان)،
// درخواست بعد از timeout بدون توکن ارسال می‌شود (نه اینکه برای همیشه بلاک بماند)
function waitForTokenReady(): Promise<void> {
  return Promise.race([
    tokenReady,
    new Promise<void>((resolve) => setTimeout(resolve, TOKEN_READY_TIMEOUT_MS)),
  ])
}

// ============================================
// Request Interceptor
// ============================================
apiClient.interceptors.request.use(
  async (config) => {
    // ✅ صبر می‌کنیم تا Store توکن‌گیر را ثبت کند (یا سقف زمانی برسد)
    // این کار جلوی 401 کاذب ناشی از race بین mount شدن صفحه و hydrate شدن session را می‌گیرد
    await waitForTokenReady()

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

    // ✅ FIX: قبلاً limit=50 روی axios instance به‌صورت گلوبال ست شده بود و
    // به تمام درخواست‌ها (حتی POST و درخواست‌های تک‌آیتمی مثل GET /:id) اضافه
    // می‌شد. حالا فقط برای GET و فقط وقتی خودِ درخواست limit مشخص نکرده باشد.
    if (config.method?.toLowerCase() === 'get' && config.params?.limit === undefined) {
      config.params = { ...config.params, limit: 50 }
    }

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